// Converts a venue row into a model-safe object using an explicit field whitelist.
// Computes open status when needed and omits fields that are empty or unavailable.
function "genie/fn_genie_format_venue_for_model_dev" {
  input {
    json venue
  
    // Optional {open_now, today_hours} already worked out by the caller (the search does
    // this in bulk). When missing, it is computed here from the venue's hours.
    json open_info?
  }

  stack {
    var $v {
      value = $input.venue
    }
  
    var $info {
      value = $input.open_info
    }
  
    var $f_id {
      value = $v|get:"id":0
    }
  
    var $f_name {
      value = $v|get:"venue_name":""
    }
  
    var $f_hours {
      value = $v|get:"hours_json":null
    }
  
    var $open_item {
      value = {id: $f_id, hours_json: $f_hours}
    }
  
    var $open_items {
      value = [$open_item]
    }
  
    conditional {
      if ((($info|get:"open_now":null) == null) && (($info|get:"today_hours":"") == "")) {
        function.run "genie/fn_genie_venue_open_now_dev" {
          input = {items: $open_items}
        } as $open_rows
      
        var.update $info {
          value = $open_rows|first
        }
      }
    }
  
    var $out {
      value = {venue_id: $f_id, venue_name: $f_name}|set_ifnotempty:"neighborhood":(($v|get:"area_neighborhood":"")|first_notempty:($v|get:"neighborhood_text":""))|set_ifnotempty:"address":($v|get:"address":"")|set_ifnotempty:"vibe_notes":($v|get:"vibe_notes":"")|set_ifnotempty:"summary":($v|get:"google_editorial_summary":"")|set_ifnotempty:"review_summary":($v|get:"review_summary":"")|set_ifnotempty:"energy_level":($v|get:"energy_level":"")|set_ifnotempty:"crowd":($v|get:"crowd":"")|set_ifnotempty:"music":($v|get:"music":"")|set_ifnotempty:"noise_level":($v|get:"noise_level":"")|set_ifnotempty:"price_band":($v|get:"price_band":"")|set_ifnotempty:"rating":($v|get:"google_rating":0)|set_ifnotempty:"rating_count":($v|get:"google_user_ratings_total":0)|set_ifnotempty:"hours_text":($v|get:"hours_text":"")|set_ifnotempty:"happy_hour_details":($v|get:"happy_hour_details":"")|set_ifnotempty:"best_time_to_go":($v|get:"best_time_to_go":"")|set_ifnotempty:"dress_code":($v|get:"dress_code":"")|set_ifnotempty:"cover_charge_details":($v|get:"cover_charge_details":"")|set_ifnotempty:"has_rooftop":($v|get:"has_rooftop":false)|set_ifnotempty:"has_outdoor_seating":($v|get:"has_outdoor_seating":false)|set_ifnotempty:"has_live_music":($v|get:"has_live_music":false)|set_ifnotempty:"has_dj":($v|get:"has_dj":false)|set_ifnotempty:"has_dance_floor":($v|get:"has_dance_floor":false)|set_ifnotempty:"has_karaoke":($v|get:"has_karaoke":false)|set_ifnotempty:"has_sports_tv":($v|get:"has_sports_tv":false)|set_ifnotempty:"good_for_groups":($v|get:"good_for_groups":false)|set_ifnotempty:"good_for_dates":($v|get:"good_for_dates":false)|set_ifnotempty:"good_for_first_dates":($v|get:"good_for_first_dates":false)|set_ifnotempty:"good_for_celebrations":($v|get:"good_for_celebrations":false)|set_ifnotempty:"good_for_birthdays":($v|get:"good_for_birthdays":false)|set_ifnotempty:"family_friendly":($v|get:"family_friendly":false)|set_ifnotnull:"open_now":($info|get:"open_now":null)|set_ifnotempty:"today_hours":($info|get:"today_hours":"")
    }
  
    // Patio is free text in the data: yes, no, Unknown, or empty. Only yes and no mean something.
    var $patio {
      value = (($v|get:"patio":"")|trim)|to_lower
    }
  
    conditional {
      if ($patio == "yes" || $patio == "no") {
        var.update $out {
          value = $out|set:"patio":$patio
        }
      }
    }
  
    // Duplicates in the data ("brunch", "brunch") are removed. Some rows store cuisine_tags as
    // something other than a list, so only a list is used.
    var $t_cuisine_raw {
      value = ($v|get:"cuisine_tags":[]) ?? []
    }

    var $t_cuisine {
      value = []
    }

    conditional {
      if ($t_cuisine_raw|is_array) {
        var.update $t_cuisine {
          value = ($t_cuisine_raw|filter:($$|is_text))|unique
        }
      }

      elseif (($t_cuisine_raw|is_text) && (($t_cuisine_raw|trim) != "")) {
        var.update $t_cuisine {
          value = [$t_cuisine_raw|trim]
        }
      }
    }
  
    var $t_diet {
      value = $v|get:"dietary_tags":[]
    }
  
    var $t_occasion {
      value = $v|get:"occasion_tags":[]
    }
  
    conditional {
      if (($t_cuisine|count) > 0) {
        var.update $out {
          value = $out|set:"cuisine_tags":$t_cuisine
        }
      }
    }
  
    conditional {
      if (($t_diet|count) > 0) {
        var.update $out {
          value = $out|set:"dietary_tags":$t_diet
        }
      }
    }
  
    conditional {
      if (($t_occasion|count) > 0) {
        var.update $out {
          value = $out|set:"occasion_tags":$t_occasion
        }
      }
    }

    // GEN-073: basic facts the prompt's field guide refers to.
    // kind: what sort of place it is, from the Google types (so a venue with no vibe notes can still
    // be described as "a bar in Midtown"). Google also tags many bars and lounges night_club
    // (PJ's Sports Bar, karaoke bars), so "nightclub" is used only when it is not a bar or a
    // restaurant.
    var $g_types_raw {
      value = ($v|get:"google_types":[]) ?? []
    }

    var $g_types {
      value = []
    }

    conditional {
      if ($g_types_raw|is_array) {
        var.update $g_types {
          value = $g_types_raw
        }
      }
    }

    var $kind {
      value = ""
    }

    conditional {
      if (($g_types|in:"bar") && ($g_types|in:"restaurant")) {
        var.update $kind {
          value = "bar and restaurant"
        }
      }

      elseif ($g_types|in:"bar") {
        var.update $kind {
          value = "bar"
        }
      }

      elseif ($g_types|in:"restaurant") {
        var.update $kind {
          value = "restaurant"
        }
      }

      elseif ($g_types|in:"night_club") {
        var.update $kind {
          value = "nightclub"
        }
      }

      elseif (($g_types|in:"cafe") || ($g_types|in:"bakery")) {
        var.update $kind {
          value = "cafe"
        }
      }
    }

    conditional {
      if ($kind != "") {
        var.update $out {
          value = $out|set:"kind":$kind
        }
      }
    }

    // serves: the meal services marked true (brunch, happy hour, late night...). The ms_* columns
    // are not used: they are defaulted in the data (ms_brunch is true for 80% of venues).
    var $serves {
      value = []
    }

    try_catch {
      try {
        var $ms {
          value = ($v|get:"meal_services":{}) ?? {}
        }

        foreach ($ms|keys) {
          each as $ms_key {
            conditional {
              if (($ms|get:$ms_key:false) == true) {
                array.push $serves {
                  value = $ms_key|replace:"_":" "
                }
              }
            }
          }
        }
      }

      catch {
        var.update $serves {
          value = []
        }
      }
    }

    conditional {
      if (($serves|count) > 0) {
        var.update $out {
          value = $out|set:"serves":$serves
        }
      }
    }

    // Hookah is free text like patio: only "yes" is sent.
    var $hookah {
      value = ((($v|get:"hookah":"") ?? "")|trim)|to_lower
    }

    conditional {
      if ($hookah == "yes") {
        var.update $out {
          value = $out|set:"hookah":"yes"
        }
      }
    }

    // Price: price_level stands in when price_band is empty (both mean the same scale).
    var $p_band {
      value = (($v|get:"price_band":"") ?? "")|trim
    }

    var $p_level {
      value = (($v|get:"price_level":0) ?? 0)|to_int
    }

    conditional {
      if ($p_band == "" && $p_level > 0 && $p_level <= 4) {
        var.update $out {
          value = $out|set:"price_band":(["", "$", "$$", "$$$", "$$$$"]|get:$p_level:"")
        }
      }
    }

    // GEN-071: data_gaps names what this venue has no data for (vibe, hours, price, rating), so the
    // model can see that a field is missing instead of guessing. Left out when nothing is missing.
    var $gaps {
      value = []
    }

    var $g_vibe {
      value = (($v|get:"vibe_notes":"") ?? "")|trim
    }

    conditional {
      if ($g_vibe == "") {
        array.push $gaps {
          value = "vibe"
        }
      }
    }

    var $g_periods {
      value = ($f_hours ?? {})|get:"periods":null
    }

    var $g_has_hours {
      value = false
    }

    conditional {
      if ($g_periods|is_array) {
        var.update $g_has_hours {
          value = ($g_periods|count) > 0
        }
      }
    }

    conditional {
      if ($g_has_hours == false) {
        array.push $gaps {
          value = "hours"
        }
      }
    }

    var $g_band {
      value = (($v|get:"price_band":"") ?? "")|trim
    }

    var $g_level {
      value = (($v|get:"price_level":0) ?? 0)|to_int
    }

    conditional {
      if ($g_band == "" && $g_level <= 0) {
        array.push $gaps {
          value = "price"
        }
      }
    }

    var $g_rating {
      value = (($v|get:"google_rating":0) ?? 0)|to_decimal
    }

    conditional {
      if ($g_rating <= 0) {
        array.push $gaps {
          value = "rating"
        }
      }
    }

    conditional {
      if (($gaps|count) > 0) {
        var.update $out {
          value = $out|set:"data_gaps":$gaps
        }
      }
    }
  }

  response = $out
}