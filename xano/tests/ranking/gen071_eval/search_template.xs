// Searches active venues in a city and ranks them for the request (GEN-071). The top 10 are the
// shortlist the model picks from, so this step caps answer quality.
// Steps: load the city's open venues -> one ranking step (api.lambda) that excludes unsuitable
// records, tests the filters, scores every venue and relaxes filters when too few match -> the
// model-safe venue objects and app cards for the top 10, plus a per-venue score breakdown.
// What it reads (from the 2026-10-28 fill-rate audit of tamu_capstone, 704 Houston venues):
//   - name, vibe_notes (61%), cuisine_tags (24%), meal_services and dietary_tags flags, patio and
//     hookah (yes/no), google_types, as strong evidence;
//   - crowd, music, best_time_to_go, energy_level (58%), as medium evidence (music is often "Jazz"
//     on venues that are not jazz bars, so it counts less);
//   - Google review text (review_highlights_json, 96%: 272 of the 278 venues without vibe notes have
//     reviews), as weaker evidence: 4-5 star reviews only, and a mention right after "no", "not",
//     "without"... does not count;
//   - Google rating (Bayesian), review count, hours (open now, late night), price_band (price_level
//     when empty), location.
//   Not used: the ms_* meal flags (ms_brunch is true for 80% of venues: defaulted) and every
//   has_* / good_for_* / Yelp / Foursquare / google_serves_* field (empty in the data).
// Scoring (weights in one W object at the top of the ranking step; each venue's breakdown adds up to
// its score): rating, popularity, data completeness, keyword fit (synonyms included, mood words such
// as "cozy" count half), cuisine fit, meal-service fit, venue type, energy, exact price, the venue's
// name carrying a requested word, saved likes (bonus) and dislikes (penalty, never a filter),
// distance, rain (outdoor-led venues), and a bonus for relaxed filters the venue still meets.
// Relaxing: meal service, open now, price, radius x2, radius, venue type, neighborhood, cuisine, until
// 3 match; and the area (neighborhood / radius) also widens when fewer than 3 venues in it have what
// was asked for ("rooftop bar in Midtown": Midtown has one rooftop).
// Never shortlisted: already shown in this conversation (exclude_ids), lodging, listings (Airbnb-style
// names, no Google types and no rating), blocked names (vape, smoke shop...), no data at all, not a
// hospitality business, rating under 3.0 with 30+ reviews, strip clubs unless asked for.
// No paid-placement, vendor or sb_* field is read.
// Each model venue gets `matches` (only when something matched): what was asked for and where it
// was found ("karaoke: in 2 reviews", "fits your saved taste: chill & intimate"). GEN-073 will add
// a pick-prompt rule to use it.
// Offline eval (2026-10-28, xano/tests/ranking/gen071_eval): 19/22 labelled requests vs 11/22 for the
// previous version; the 3 misses are label strictness (see the eval README).
function "genie/fn_genie_search_venues_dev" {
  input {
    // City to search (genie_venues.city_id)
    int city_id

    // bar, restaurant, club or cafe
    text venue_type?

    // e.g. steakhouse, sushi, tacos, soul food
    text cuisine?

    // Matched against neighborhood and address, then venues near those
    text neighborhood?

    // $, $$, $$$ or $$$$ (matched by bucket: budget $-$$, upscale $$$-$$$$)
    text price_band?

    // brunch, happy_hour, late_night or reverse_happy_hour
    text meal_service?

    // Only venues open right now (Central time)
    bool open_now?

    // Soft terms the venue should have, e.g. rooftop, live music, romantic
    text[] keywords?

    // Preferred energy level: Chill, Medium or High
    text energy?

    // relevance (default) or rating
    text sort_by?

    // Venues to return, 1 to 10 (default 10)
    int limit?

    // Below this many matches the filters are relaxed (default 3)
    int min_results?

    // Saved likes from the user context (small bonus, never a filter)
    text[]? preference_keywords?

    // Saved dislikes from the user context (penalty, never a filter)
    text[]? avoid_keywords?

    // The user's location, only when it belongs to the searched city
    decimal? lat?

    decimal? lng?

    // Search radius in meters around lat/lng (default 5000)
    int? radius_m?

    // Language of the request (not used for ranking; keywords arrive in English)
    text? language?

    // Venue ids already shown in this conversation ("show me more")
    int[]? exclude_ids?

    // Rain is forecast: outdoor-led venues rank a little lower unless outdoors was asked for
    bool? avoid_outdoor?
  }

  stack {
    // Central time right now, for open-now and late-night (day 0 is Sunday, as in Google periods).
    var $c_dow {
      value = (now|format_timestamp:"w":"America/Chicago")|to_int
    }

    var $c_hour {
      value = (now|format_timestamp:"G":"America/Chicago")|to_int
    }

    var $c_min {
      value = (now|format_timestamp:"i":"America/Chicago")|to_int
    }

    var $c_minute {
      value = ($c_hour * 60) + $c_min
    }

    var $clock {
      value = {dow: $c_dow, minute: $c_minute}
    }

    var $sort_by {
      value = (($input.sort_by|first_notempty:"relevance")|trim)|to_lower
    }

    // ---------- Load: active, open-for-business venues in the city ----------
    db.query genie_venues {
      where = $db.genie_venues.city_id == $input.city_id && $db.genie_venues.status == "active" && $db.genie_venues.google_business_status != "CLOSED_PERMANENTLY" && $db.genie_venues.google_business_status != "CLOSED_TEMPORARILY" && $db.genie_venues.is_permanently_closed == false && $db.genie_venues.is_temporarily_closed == false
      sort = {id: "asc"}
      return = {type: "list"}
    } as $rows

    // Every input in one object for the ranking step (plain references only).
    var $args {
      value = {
        venue_type         : $input.venue_type
        cuisine            : $input.cuisine
        neighborhood       : $input.neighborhood
        price_band         : $input.price_band
        meal_service       : $input.meal_service
        open_now           : $input.open_now
        keywords           : $input.keywords
        energy             : $input.energy
        sort_by            : $sort_by
        limit              : $input.limit
        min_results        : $input.min_results
        preference_keywords: $input.preference_keywords
        avoid_keywords     : $input.avoid_keywords
        lat                : $input.lat
        lng                : $input.lng
        radius_m           : $input.radius_m
        exclude_ids        : $input.exclude_ids
        avoid_outdoor      : $input.avoid_outdoor
        clock              : $clock
      }
    }

    // ---------- Rank (one step; the same code is tested offline in xano/tests/ranking/gen071_eval) ----------
    var $ranked {
      value = null
    }

    try_catch {
      try {
        api.lambda {
          code = """
__RANKER_CORE__
            return rank($var.args, $var.rows);
            """
          timeout = 20
        } as $ranked_out

        var.update $ranked {
          value = $ranked_out
        }
      }

      catch {
        debug.log {
          value = {
            checkpoint: "SEARCH_RANK_FAILED"
            error     : $error.message
          }
        }
      }
    }

    // The handler reports a thrown search as reply_mode "search_error".
    conditional {
      if ($ranked == null) {
        throw {
          name = "SearchRankError"
          value = "The venue ranking step failed"
        }
      }
    }

    var $top {
      value = ($ranked|get:"top":[]) ?? []
    }

    // ---------- Build the outputs for the top venues ----------
    var $venues {
      value = []
    }

    var $cards {
      value = []
    }

    var $ranking {
      value = []
    }

    foreach ($top) {
      each as $t {
        var $t_row {
          value = $t|get:"row":null
        }

        var $t_open_now {
          value = $t|get:"open_now":null
        }

        var $t_today {
          value = $t|get:"today_hours":null
        }

        var $t_open_info {
          value = {open_now: $t_open_now, today_hours: $t_today}
        }

        function.run "genie/fn_genie_format_venue_for_model_dev" {
          input = {venue: $t_row, open_info: $t_open_info}
        } as $formatted

        // Why the venue fits, where the evidence is ("karaoke: in 2 reviews"); review text is not
        // in the formatted fields, so without this the model cannot explain review-only matches.
        var $t_matches {
          value = $t|get:"matches":[]
        }

        conditional {
          if (($t_matches|count) > 0) {
            var.update $formatted {
              value = $formatted|set:"matches":$t_matches
            }
          }
        }

        function.run "genie/fn_genie_slim_venue_row_dev" {
          input = {venue: $t_row}
        } as $card

        array.push $venues {
          value = $formatted
        }

        array.push $cards {
          value = $card
        }

        var $t_id {
          value = $t|get:"id":0
        }

        var $t_score {
          value = $t|get:"score":0
        }

        var $t_breakdown {
          value = $t|get:"breakdown":{}
        }

        var $t_matched {
          value = $t|get:"matched":{}
        }

        var $t_km {
          value = $t|get:"km":null
        }

        var $t_gaps {
          value = $t|get:"gaps":[]
        }

        var $rank_row {
          value = {
            id       : $t_id
            score    : $t_score
            breakdown: $t_breakdown
            matched  : $t_matched
            km       : $t_km
            gaps     : $t_gaps
          }
        }

        array.push $ranking {
          value = $rank_row
        }
      }
    }

    var $n_rows {
      value = $rows|count
    }

    var $r_candidates {
      value = $ranked|get:"candidates":0
    }

    var $r_excluded {
      value = $ranked|get:"excluded":{}
    }

    var $r_requested {
      value = $ranked|get:"requested":[]
    }

    var $match_quality {
      value = $ranked|get:"match_quality":"empty"
    }

    var $relaxed {
      value = $ranked|get:"relaxed":[]
    }

    var $pool_count {
      value = $ranked|get:"pool_count":0
    }

    var $fail_reason {
      value = $ranked|get:"fail_reason":null
    }

    var $debug_out {
      value = {
        base_rows : $n_rows
        candidates: $r_candidates
        excluded  : $r_excluded
        requested : $r_requested
        sort_by   : $sort_by
        ranking   : $ranking
      }
    }
  }

  response = {
    venues       : $venues
    cards        : $cards
    match_quality: $match_quality
    relaxed      : $relaxed
    count        : $pool_count
    fail_reason  : $fail_reason
    debug        : $debug_out
  }
}
