// Searches active venues in a city and ranks them for the request. The top 10 are the
// shortlist the model picks from, so this step caps answer quality.
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
            // ---- GEN-071 ranker core. Shared by the Xano lambda (inlined by build_xs.js) and the Node eval. ----
            // rank(args, rows) -> {top, pool_count, relaxed, requested, match_quality, fail_reason, excluded, stats}
            // args: {venue_type, cuisine, neighborhood, price_band, meal_service, open_now, keywords[], energy,
            //        preference_keywords[], avoid_keywords[], lat, lng, radius_m, exclude_ids[], avoid_outdoor,
            //        sort_by, limit, min_results, clock: {dow, minute}}
            function rank(args, rows) {
              // ---------- Weights (one place; every part shows up in each venue's breakdown) ----------
              const W = {
                rating: 6,          // x (Bayesian rating - 3.5), 0 below 3.5. About 0-9.
                rating_prior: 4.3,  // Bayesian prior mean
                rating_weight: 25,  // reviews it takes to move away from the prior
                popularity: 0.25,   // x log10(review count + 1). About 0-1.
                keywords: 10,       // x average keyword fit (0-1). A full match beats the rating gap of 4.3 vs 4.8.
                cuisine: 6,         // x cuisine fit (0-1)
                meal: 4,            // x meal-service fit (0-1)
                type: 1,            // x venue-type fit (0-1)
                energy: 2,          // requested energy matches; -1 for the opposite energy
                price_exact: 1,     // exact price band (the filter itself is by bucket)
                pref: 1,            // x fit per saved like, at most pref_cap in total
                pref_cap: 2,
                avoid: 2,           // x fit per saved dislike (subtracted), at most avoid_cap in total
                avoid_cap: 4,
                km_free: 1,         // no distance penalty within this many km
                per_km: 0.5,        // penalty per km beyond km_free, at most km_cap
                km_cap: 3,
                rain: 1,            // outdoor-led venues when rain is forecast and the user did not ask for outdoors
                relaxed_fit: 8,     // per relaxed filter the venue still meets
                relaxed_area: 5,    // same, for neighborhood and radius (a nearby exact match may beat an in-area miss)
                area_free_km: 1.5,  // after the area is relaxed: no penalty within this distance of the area's centre
                name_hit: 2,        // a requested word (or cuisine) is in the venue's name: "PJ's Sports Bar", "La Lupita Taco"
                kw_scarce: 0.5,     // a venue "has" the keywords when its average fit reaches this
                kw_soft: 0.5,       // weight of a mood or generic word ("cozy", "lounge") next to a concrete one ("wine")
                exclude_adult: true, // strip clubs are left out unless the request asks for one
                data_vibe: 1, data_energy: 0.3, data_hours: 0.3, data_photo: 0.2, data_reviews: 0.2,
              };
              // Credit for where a term was found.
              const FIELD = { strong: 1, medium: 0.7, review1: 0.5, review2: 0.7, review3: 0.8, synonym: 0.9 };

              // ---------- Vocabulary ----------
              // Concepts: a request word (or a saved preference) -> words that venue text uses for it.
              const CONCEPTS = {
                "rooftop": ["rooftop", "roof top", "roof deck", "roof-top", "rooftop bar", "rooftop lounge"],
                "patio": ["patio", "outdoor seating", "outdoor", "terrace", "beer garden", "outside seating", "open air", "garden"],
                "outdoor": ["patio", "outdoor seating", "outdoor", "terrace", "beer garden", "open air"],
                "live music": ["live music", "live band", "live bands", "live performance", "live entertainment", "musicians", "open mic", "live jazz"],
                "live band": ["live band", "live music", "live bands", "live performance"],
                "jazz": ["jazz", "live jazz", "saxophone", "jazz night"],
                "dancing": ["dancing", "dance floor", "dance", "dj"],
                "dance": ["dancing", "dance floor", "dance", "dj"],
                "dj": ["dj", "djs", "deejay"],
                "karaoke": ["karaoke"],
                "hookah": ["hookah", "shisha", "hooka"],
                "sports": ["sports", "sports bar", "game day", "watch the game", "watching games", "big screen", "tvs", "football", "basketball", "ufc", "nfl", "nba"],
                "sports bar": ["sports bar", "sports", "game day", "watch the game", "watching games", "big screen", "tvs"],
                "watch the game": ["sports", "sports bar", "watch the game", "watching games", "game day", "big screen", "tvs"],
                "game day": ["sports", "sports bar", "game day", "watch the game", "watching games", "tailgate"],
                "watch sports": ["sports", "sports bar", "watch the game", "watching games", "game day", "big screen"],
                "cocktails": ["cocktail", "cocktails", "mixology", "mixologist", "craft drinks", "craft cocktails"],
                "craft cocktails": ["craft cocktails", "cocktail", "cocktails", "mixology", "mixologist"],
                "wine": ["wine", "wine bar", "sommelier", "wines"],
                "beer": ["beer", "craft beer", "brewery", "taps", "ipa", "draft"],
                "whiskey": ["whiskey", "whisky", "bourbon"],
                "romantic": ["romantic", "date night", "intimate", "candlelit", "cozy", "date"],
                "date night": ["date night", "romantic", "intimate", "date", "cozy"],
                "date": ["date night", "romantic", "intimate", "date"],
                "intimate": ["intimate", "cozy", "romantic", "quiet"],
                "chill": ["chill", "relaxed", "laid-back", "laid back", "low-key", "mellow", "calm", "relaxing"],
                "relaxed": ["relaxed", "chill", "laid-back", "laid back", "low-key", "calm"],
                "quiet": ["quiet", "calm", "low-key", "conversation", "intimate"],
                "lively": ["lively", "energetic", "vibrant", "packed", "high energy", "buzzing"],
                "upscale": ["upscale", "elegant", "sophisticated", "fine dining", "classy", "luxurious", "high-end"],
                "fancy": ["upscale", "elegant", "sophisticated", "fine dining", "classy", "luxurious", "high-end"],
                "cheap": ["cheap", "affordable", "inexpensive", "budget", "great prices", "reasonable prices"],
                "view": ["view", "views", "skyline", "city views"],
                "views": ["view", "views", "skyline", "city views"],
                "speakeasy": ["speakeasy", "hidden bar", "hidden entrance", "secret bar"],
                "games": ["games", "arcade", "pool table", "darts", "board games", "shuffleboard", "bowling", "game night"],
                "trivia": ["trivia", "quiz night"],
                "dog friendly": ["dog friendly", "dog-friendly", "dogs", "pet friendly", "pup"],
                "family friendly": ["family", "kids", "family-friendly", "family friendly"],
                "brunch": ["brunch"],
                "mimosas": ["mimosa", "mimosas", "bottomless"],
                "bottomless mimosas": ["bottomless", "mimosa", "mimosas"],
                "happy hour": ["happy hour"],
                "late night": ["late night", "late-night", "open late", "after midnight"],
                "vegan": ["vegan", "plant-based", "plant based"],
                "vegetarian": ["vegetarian", "veggie", "vegan"],
                "tacos": ["taco", "tacos", "taqueria", "birria"],
                "sushi": ["sushi", "sashimi", "omakase", "nigiri"],
                "bbq": ["bbq", "barbecue", "brisket"],
                "burgers": ["burger", "burgers"],
                "seafood": ["seafood", "oysters", "crawfish", "shrimp"],
                "pizza": ["pizza"],
                "steak": ["steak", "steaks", "steakhouse"],
                "lounge": ["lounge"],
                "cigar": ["cigar", "cigars"],
                "latin": ["latin", "salsa", "bachata", "reggaeton", "latin music"],
                "hip hop": ["hip hop", "hip-hop", "r&b", "rnb"],
                "comedy": ["comedy", "stand-up", "standup", "comedian"],
                "drag": ["drag", "drag show", "drag brunch"],
                "gay": ["gay", "lgbtq", "queer", "lgbt"],
                "birthday": ["birthday", "celebration", "celebrate", "party"],
                "groups": ["groups", "large group", "big group", "group"],
                "dive bar": ["dive bar", "dive", "no frills"],
                "club": ["club", "nightclub", "night club", "dancing", "dance floor"],
                "nightclub": ["nightclub", "night club", "club", "dancing", "dance floor"],
              };
              // Saved preference values (quick-pick vocabulary, lower case) -> concept words found in venue text.
              const PREF_TERMS = {
                "loud & lit": ["loud", "lit", "energetic", "high energy", "packed", "rowdy", "turnt"],
                "chill & intimate": ["chill", "intimate", "cozy", "quiet", "relaxed", "laid-back"],
                "speakeasy vibe": CONCEPTS["speakeasy"],
                "dive bar vibes": CONCEPTS["dive bar"],
                "club vibe": CONCEPTS["club"],
                "dancing allowed": CONCEPTS["dancing"],
                "indoor cozy": ["cozy", "indoor"],
                "outdoor / open air": CONCEPTS["outdoor"],
                "live dj": CONCEPTS["dj"],
                "live band": CONCEPTS["live band"],
                "rooftop bars": CONCEPTS["rooftop"],
                "rooftop": CONCEPTS["rooftop"],
                "patio": CONCEPTS["patio"],
                "upscale": CONCEPTS["upscale"],
                "lounges": CONCEPTS["lounge"],
                "lounge": CONCEPTS["lounge"],
                "game night": CONCEPTS["games"],
                "bowling / arcade": ["bowling", "arcade"],
                "trivia night": CONCEPTS["trivia"],
                "hookah nights": CONCEPTS["hookah"],
                "comedy shows": CONCEPTS["comedy"],
                "theme nights": ["theme night", "themed night"],
                "day party": ["day party", "day parties"],
                "signature cocktails": CONCEPTS["cocktails"],
                "bottomless mimosas": CONCEPTS["bottomless mimosas"],
                "whiskey / bourbon bars": CONCEPTS["whiskey"],
                "wine focused": CONCEPTS["wine"],
                "tapas / small plates": ["tapas", "small plates"],
                "street food": ["street food", "food truck"],
                "comfort food": ["comfort food"],
                "soul food": ["soul food"],
                "tex-mex": ["tex-mex", "tex mex", "taco", "tacos"],
                "mexican": ["mexican", "taco", "tacos", "taqueria"],
                "barbecue": CONCEPTS["bbq"],
              };
              // Energy words a saved taste implies (matched against energy_level).
              const PREF_ENERGY = { "loud & lit": "high", "club vibe": "high", "chill & intimate": "chill", "indoor cozy": "chill" };
              // Cuisine request -> cuisine_tags value.
              const CUISINE_TAG = {
                "sushi": "japanese", "ramen": "japanese", "japanese": "japanese",
                "tacos": "tex_mex", "taco": "tex_mex", "mexican": "tex_mex", "tex-mex": "tex_mex", "tex mex": "tex_mex",
                "pho": "vietnamese", "vietnamese": "vietnamese", "banh mi": "vietnamese",
                "pizza": "italian", "pasta": "italian", "italian": "italian",
                "barbecue": "bbq", "bbq": "bbq", "brisket": "bbq",
                "burger": "burgers", "burgers": "burgers",
                "steak": "steakhouse", "steakhouse": "steakhouse", "steaks": "steakhouse",
                "seafood": "seafood", "oysters": "seafood", "crawfish": "seafood",
                "soul food": "soul_food", "mediterranean": "mediterranean", "greek": "mediterranean",
                "thai": "thai", "chinese": "chinese", "indian": "indian", "brunch": "brunch",
              };
              const HOOD_ALIASES = {
                "downtown": ["downtown", "central business district"], "eado": ["east downtown", "eado"],
                "east downtown": ["east downtown", "eado"], "heights": ["heights"], "the heights": ["heights"],
                "galleria": ["galleria", "uptown"], "uptown": ["uptown", "galleria"],
                "washington ave": ["washington avenue", "washington ave"], "washington avenue": ["washington avenue", "washington ave"],
                "museum district": ["museum district"], "rice village": ["rice village", "west university"],
                "upper kirby": ["upper kirby", "greenway"], "midtown": ["midtown"], "montrose": ["montrose"],
                "fourth ward": ["fourth ward"], "third ward": ["third ward"],
              };
              const ALLOWED_TYPES = ["bar", "restaurant", "night_club", "cafe", "bakery", "food", "meal_takeaway", "meal_delivery"];
              const BLOCK_TERMS = ["vape", "smoke shop", "dispensary", "party supply", "party house", "supply", "event center", "wedding",
                "airbnb", "apartment", "condo", "bedroom", "studio dt", "pool, gym", " suite ", "suite -", "townhome"];
              const HOSPITALITY_TERMS = ["lounge", "loung", "bar", "grill", "cantina", "tavern", "pub", "kitchen", "cigar", "hookah", "hooka",
                "club", "cafe", "coffee", "restaurant", "bistro", "brewery", "taproom", "cocktail", "eatery", "diner", "ice house", "icehouse",
                "taqueria", "steakhouse", "wings", "pizza", "bbq", "saloon"];
              // Mood and generic words: they describe how a place feels, not what it is, so they count less.
              const SOFT_WORDS = ["cozy", "chill", "relaxed", "lively", "upscale", "fancy", "romantic", "quiet", "intimate", "trendy",
                "casual", "vibrant", "laid-back", "laid back", "sophisticated", "fun", "nice", "good", "lounge", "spot", "place", "drinks", "vibes", "vibe"];
              const ADULT_TEXT = /\b(cabaret|gentlem[ae]n'?s club|gentlem[ae]n’s club|strip club|adult entertainment|exotic dancers?)\b/i;
              const ADULT_REVIEW = /\b(strip club|strippers?|topless|lap dances?)\b/i;
              const NEGATORS = /\b(no|not|never|without|isn't|wasn't|aren't|weren't|don't|doesn't|didn't|lack|lacks|zero)\b[^.!?]{0,25}$/i;

              // ---------- Helpers ----------
              const lc = (s) => (typeof s === "string" ? s : s == null ? "" : String(s)).toLowerCase();
              // Escapes regex characters. Written without a literal dollar-brace or dollar-ampersand, which Xano could read as its own variables.
              const esc = (s) => s.replace(/[.*+?^\x24{}()|[\]\\]/g, (c) => "\\" + c);
              const reCache = {};
              // Whole words, singular or plural ("taco" finds "tacos", "tacos" finds "taco").
              const termRe = (t) => {
                if (!reCache[t]) {
                  const base = /[^s]s$/.test(t) && t.length > 3 ? t.slice(0, -1) : t;
                  reCache[t] = new RegExp("(^|[^a-z0-9])" + esc(base).replace(/\s+/g, "[\\s-]+") + "(s|es)?(?=$|[^a-z0-9])", "i");
                }
                return reCache[t];
              };
              const has = (text, t) => text !== "" && termRe(t).test(text);
              // Review hit that is not negated just before it ("no rooftop", "not a sports bar").
              const reviewHit = (text, t) => {
                const re = termRe(t);
                const m = re.exec(text);
                if (!m) return false;
                const before = text.slice(Math.max(0, m.index - 30), m.index + (m[1] ? m[1].length : 0));
                return !NEGATORS.test(before);
              };
              const num = (v) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
              const round2 = (x) => Math.round(x * 100) / 100;
              const arr = (v) => (Array.isArray(v) ? v : []);
              const trueKeys = (v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).filter((k) => v[k] === true) : []);

              function expand(word) {
                const w = lc(word).trim();
                if (!w) return [];
                const out = [{ t: w, f: 1 }];
                for (const s of CONCEPTS[w] || []) if (s !== w) out.push({ t: s, f: FIELD.synonym });
                // Multi-word keyword without a concept: also try its main words ("live jazz" -> "jazz").
                if (!CONCEPTS[w] && w.includes(" ")) for (const part of w.split(/\s+/)) if (part.length > 3 && CONCEPTS[part]) for (const s of CONCEPTS[part]) out.push({ t: s, f: 0.8 });
                return out;
              }

              // Where a term appears in a venue, as credit 0-1.
              function termCredit(doc, t) {
                if (has(doc.strong, t)) return FIELD.strong;
                let best = has(doc.medium, t) ? FIELD.medium : 0;
                let n = 0;
                for (const rv of doc.reviews) if (reviewHit(rv, t)) n++;
                const rc = n >= 3 ? FIELD.review3 : n === 2 ? FIELD.review2 : n === 1 ? FIELD.review1 : 0;
                return Math.max(best, rc);
              }
              function wordFit(doc, word) {
                let best = 0, where = "";
                for (const e of expand(word)) {
                  const c = termCredit(doc, e.t) * e.f;
                  if (c > best) { best = c; where = e.t; }
                  if (best >= 1) break;
                }
                return { fit: best, term: where };
              }
              // Where a matched term was found, in words the model can quote ("venue info", "2 reviews").
              function whereFound(doc, t) {
                if (has(doc.strong, t) || has(doc.medium, t)) return "venue info";
                let n = 0;
                for (const rv of doc.reviews) if (reviewHit(rv, t)) n++;
                return n ? n + (n === 1 ? " review" : " reviews") : "";
              }
              function matchNote(doc, asked, f) {
                const where = whereFound(doc, f.term);
                if (!where) return null;
                return asked + ": " + (f.term === lc(asked).trim() ? "" : "as " + f.term + ", ") + "in " + where;
              }
              function termsFit(doc, terms) {
                let best = 0;
                for (const t of terms) { const c = termCredit(doc, lc(t)); if (c > best) best = c; if (best >= 1) break; }
                return best;
              }

              // ---------- Inputs ----------
              const venueType = lc(args.venue_type).trim();
              const cuisine = lc(args.cuisine).trim().replace(/_/g, " ");
              const hood = lc(args.neighborhood).trim().replace(/^the\s+/, "");
              const priceBand = String(args.price_band || "").trim();
              const meal = lc(args.meal_service).trim();
              const wantOpen = args.open_now === true;
              const energy = lc(args.energy).trim();
              const sortBy = lc(args.sort_by || "relevance");
              let limit = Math.round(num(args.limit) || 10); limit = Math.max(1, Math.min(10, limit));
              const minN = Math.round(num(args.min_results) || 3);
              const keywords = [...new Set(arr(args.keywords).map((k) => lc(k).trim()).filter(Boolean))];
              const prefs = [...new Set(arr(args.preference_keywords).map((k) => lc(k).trim()).filter(Boolean))];
              const avoids = [...new Set(arr(args.avoid_keywords).map((k) => lc(k).trim()).filter(Boolean))];
              const excludeIds = new Set(arr(args.exclude_ids).map(Number).filter((n) => n > 0));
              const lat = num(args.lat), lng = num(args.lng);
              const hasGeo = lat !== 0 && lng !== 0;
              const radiusKm = hasGeo ? (num(args.radius_m) > 0 ? num(args.radius_m) / 1000 : 5) : 0;
              const clock = args.clock || { dow: 0, minute: 0 };
              const outdoorAsked = keywords.some((k) => ["patio", "rooftop", "outdoor", "terrace", "beer garden"].includes(k));
              const avoidOutdoor = args.avoid_outdoor === true && !outdoorAsked;
              const adultAsked = keywords.some((k) => /strip|gentlem|adult|cabaret|exotic/.test(k));

              const requested = [];
              if (venueType) requested.push("venue_type");
              if (cuisine) requested.push("cuisine");
              if (hood) requested.push("neighborhood");
              if (priceBand) requested.push("price_band");
              if (meal) requested.push("meal_service");
              if (wantOpen) requested.push("open_now");
              if (hasGeo) requested.push("radius");

              // ---------- Hours ----------
              const nowWeek = clock.dow * 1440 + clock.minute;
              function openInfo(hj) {
                const periods = arr(hj && hj.periods);
                const wk = arr(hj && hj.weekday_text);
                let open = null, late = false;
                if (periods.length) {
                  open = false;
                  for (const p of periods) {
                    if (!p || !p.close) { open = true; late = true; continue; }
                    const ot = String((p.open && p.open.time) || "0000"), ct = String(p.close.time || "0000");
                    const om = num(p.open && p.open.day) * 1440 + num(ot.slice(0, 2)) * 60 + num(ot.slice(2, 4));
                    let cm = num(p.close.day) * 1440 + num(ct.slice(0, 2)) * 60 + num(ct.slice(2, 4));
                    if (cm <= om) cm += 10080;
                    if ((om <= nowWeek && nowWeek < cm) || (om <= nowWeek + 10080 && nowWeek + 10080 < cm)) open = true;
                    // Late night: closes after midnight (at most 6 AM the next morning).
                    const closeDayMin = cm % 1440;
                    if (Math.floor(cm / 1440) !== Math.floor(om / 1440) && closeDayMin <= 360) late = true;
                  }
                }
                const idx = (clock.dow + 6) % 7;
                return { open_now: open, today_hours: wk.length > idx ? wk[idx] : null, late, has_hours: periods.length > 0 };
              }
              const km = (a1, o1, a2, o2) => {
                const r = Math.PI / 180, dA = (a2 - a1) * r, dO = (o2 - o1) * r;
                const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2;
                return 12742 * Math.asin(Math.sqrt(h));
              };

              // ---------- Pass 1: exclude, build the venue text, test filters, score ----------
              const excluded = {};
              const bump = (k) => { excluded[k] = (excluded[k] || 0) + 1; };
              const docs = [];
              for (const r of rows) {
                const id = num(r.id);
                const name = lc(r.venue_name).trim();
                const types = arr(r.google_types).map(lc);
                const tags = arr(r.cuisine_tags).filter((t) => typeof t === "string").map(lc);
                const vibe = lc(r.vibe_notes).trim();
                const rating = num(r.google_rating), nRatings = num(r.google_user_ratings_total);
                const reviewsAll = arr(r.review_highlights_json).filter((x) => x && typeof x === "object");
                const reviews = reviewsAll.filter((x) => num(x.rating) >= 4).map((x) => lc(x.text)).filter(Boolean);
                const hospitalityName = HOSPITALITY_TERMS.some((t) => name.includes(t));
                const typed = types.some((t) => ALLOWED_TYPES.includes(t));

                let reason = "";
                if (excludeIds.has(id)) reason = "already_shown";
                else if (!name) reason = "no_name";
                else if (types.includes("lodging")) reason = "lodging";
                else if (BLOCK_TERMS.some((t) => (" " + name + " ").includes(t))) reason = "blocked_name";
                else if (types.length === 0 && rating <= 0 && nRatings === 0) reason = "unverified_listing";
                else if (rating <= 0 && !vibe && tags.length === 0 && reviews.length === 0) reason = "no_data";
                else if (!typed && !hospitalityName) reason = "not_hospitality";
                else if (rating > 0 && nRatings >= 30 && rating < 3.0) reason = "low_rated";
                else if (W.exclude_adult && !adultAsked && (ADULT_TEXT.test(name + " " + vibe) || reviews.some((t) => ADULT_REVIEW.test(t)))) reason = "adult";
                if (reason) { bump(reason); continue; }

                const meals = trueKeys(r.meal_services).map((k) => k.replace(/_/g, " "));
                const diet = trueKeys(r.dietary_tags);
                const patio = lc(r.patio).trim(), hookah = lc(r.hookah).trim();
                const features = [];
                if (patio === "yes") features.push("patio outdoor seating");
                if (hookah === "yes") features.push("hookah");
                if (types.includes("night_club")) features.push("nightclub club");
                const doc = {
                  strong: [name, vibe, tags.join(" ").replace(/_/g, " "), meals.join(" "), diet.join(" "), features.join(" ")].join(" | "),
                  medium: [lc(r.crowd), lc(r.music), lc(r.best_time_to_go), lc(r.energy_level)].join(" | "),
                  reviews,
                };
                const hours = openInfo(r.hours_json);

                // Filters (fit 0-1; a filter that was not asked for passes).
                let fType = 1;
                if (venueType) {
                  const nm = (re) => re.test(name);
                  if (venueType === "bar") fType = types.includes("bar") ? 1 : nm(/\b(bar|pub|tavern|saloon|ice ?house|lounge)\b/) ? 0.7 : 0;
                  else if (venueType === "club") fType = types.includes("night_club") ? 1 : nm(/\bclub\b/) ? 0.7 : 0;
                  else if (venueType === "restaurant") fType = types.some((t) => ["restaurant", "food", "meal_takeaway"].includes(t)) || tags.length ? 1 : nm(/\b(kitchen|grill|bistro|eatery|diner|steakhouse|taqueria)\b/) ? 0.7 : 0;
                  else if (venueType === "cafe") fType = types.includes("cafe") || types.includes("bakery") ? 1 : nm(/\b(cafe|coffee)\b/) ? 0.7 : 0;
                  else fType = types.includes(venueType) || has(doc.strong, venueType) ? 1 : 0;
                }
                // Short notes for the model on why the venue fits ("karaoke: in 2 reviews"), since review
                // evidence is not in the fields it sees.
                const matches = [];
                let fCuisine = 1;
                if (cuisine) {
                  const tag = CUISINE_TAG[cuisine] || cuisine.replace(/\s+/g, "_");
                  if (tags.includes(tag) || tags.includes(tag + "s") || tags.includes(tag.replace(/s$/, ""))) fCuisine = 1;
                  else {
                    const cf = wordFit(doc, cuisine);
                    fCuisine = cf.fit;
                    const note = cf.fit > 0 ? matchNote(doc, cuisine, cf) : null;
                    if (note) matches.push(note);
                  }
                }
                let fHood = 1, hoodNamed = false;
                if (hood) {
                  const names = HOOD_ALIASES[hood] || [hood];
                  const hoodText = lc(r.area_neighborhood) + " | " + lc(r.neighborhood_text) + " | " + lc(r.address);
                  hoodNamed = names.some((n) => hoodText.includes(n));
                  fHood = hoodNamed ? 1 : 0; // nearby venues are added after the centroid is known
                }
                let fPrice = 1, bandEff = String(r.price_band || "").trim();
                if (!bandEff && num(r.price_level) > 0) bandEff = "$".repeat(Math.min(4, num(r.price_level)));
                if (priceBand) {
                  const bucket = (b) => (b === "$" || b === "$$" ? "budget" : b === "$$$" || b === "$$$$" ? "upscale" : "");
                  fPrice = bandEff && bucket(bandEff) === bucket(priceBand) ? 1 : 0;
                }
                let fMeal = 1;
                if (meal) {
                  const rm = (t) => { let n = 0; for (const rv of reviews) if (reviewHit(rv, t)) n++; return n >= 2 ? 0.8 : n === 1 ? 0.6 : 0; };
                  const mflags = trueKeys(r.meal_services);
                  if (meal === "brunch") fMeal = mflags.includes("brunch") || tags.includes("brunch") ? 1 : rm("brunch");
                  else if (meal === "happy_hour") fMeal = mflags.includes("happy_hour") || lc(r.happy_hour_details).trim() ? 1 : rm("happy hour");
                  else if (meal === "late_night") fMeal = mflags.includes("late_night") || hours.late ? 1 : rm("late night");
                  else if (meal === "reverse_happy_hour") fMeal = r.ms_reverse_happy_hour === true ? 1 : rm("reverse happy hour");
                  else fMeal = wordFit(doc, meal.replace(/_/g, " ")).fit;
                }
                const okOpen = !wantOpen || hours.open_now === true;
                let dist = null;
                const vLat = num(r.latitude), vLng = num(r.longitude);
                if (hasGeo && vLat && vLng) dist = km(lat, lng, vLat, vLng);

                // Score parts.
                const bd = {};
                const bayes = rating > 0 ? (rating * nRatings + W.rating_prior * W.rating_weight) / (nRatings + W.rating_weight) : 0;
                bd.rating = bayes > 3.5 ? W.rating * (bayes - 3.5) : 0;
                bd.popularity = W.popularity * Math.log10(nRatings + 1);
                bd.data = (vibe ? W.data_vibe : 0) + (lc(r.energy_level).trim() ? W.data_energy : 0) + (hours.has_hours ? W.data_hours : 0)
                  + (lc(r.image_primary_url).trim() ? W.data_photo : 0) + (reviews.length ? W.data_reviews : 0);
                const matched = {};
                let kwAvg = 0;
                if (keywords.length) {
                  let sum = 0, wsum = 0;
                  for (const k of keywords) {
                    const wk = SOFT_WORDS.includes(k) ? W.kw_soft : 1;
                    const f = wordFit(doc, k);
                    sum += wk * f.fit; wsum += wk;
                    if (f.fit > 0) {
                      matched[k] = f.term;
                      const note = matchNote(doc, k, f);
                      if (note) matches.push(note);
                    }
                  }
                  kwAvg = sum / wsum;
                  bd.keywords = W.keywords * kwAvg;
                }
                // The venue's name carries a requested word: a strong identity signal ("PJ's Sports Bar").
                const GENERIC = ["bar", "bars", "restaurant", "cafe", "club", "lounge", "grill", "kitchen", "pub"];
                const nameWords = keywords.concat(cuisine ? [cuisine] : []);
                if (nameWords.some((k) => expand(k).some((e) => e.t.length > 2 && !GENERIC.includes(e.t) && has(name, e.t)))) bd.name_hit = W.name_hit;
                if (cuisine) bd.cuisine = W.cuisine * fCuisine;
                if (meal) bd.meal = W.meal * fMeal;
                if (venueType) bd.type = W.type * fType;
                const vEnergy = lc(r.energy_level).trim().replace("energetic", "high").replace("low", "chill");
                if (energy && vEnergy) bd.energy = vEnergy === energy ? W.energy : (vEnergy === "high" && energy === "chill") || (vEnergy === "chill" && energy === "high") ? -1 : 0;
                if (priceBand && bandEff === priceBand) bd.price = W.price_exact;
                if (prefs.length) {
                  let p = 0;
                  for (const pr of prefs) {
                    let f = termsFit(doc, PREF_TERMS[pr] || CONCEPTS[pr] || [pr]);
                    if (PREF_ENERGY[pr] && vEnergy === PREF_ENERGY[pr]) f = Math.max(f, 1);
                    if (f > 0) { p += W.pref * f; matched["pref:" + pr] = true; matches.push("fits your saved taste: " + pr); }
                  }
                  bd.prefs = Math.min(W.pref_cap, p);
                }
                if (avoids.length) {
                  let a = 0;
                  for (const av of avoids) {
                    let f = termsFit(doc, PREF_TERMS[av] || CONCEPTS[av] || [av]);
                    if (PREF_ENERGY[av] && vEnergy === PREF_ENERGY[av]) f = Math.max(f, 1);
                    if (f >= 0.7) { a += W.avoid * f; matched["avoid:" + av] = true; }
                  }
                  bd.avoid = -Math.min(W.avoid_cap, a);
                }
                if (dist !== null) bd.distance = -Math.min(W.km_cap, Math.max(0, dist - W.km_free) * W.per_km);
                if (avoidOutdoor && (has(name + " " + vibe, "rooftop") || has(name + " " + vibe, "patio") || has(name, "beer garden") || has(name, "ice house"))) bd.rain = -W.rain;

                const gaps = [];
                if (!vibe) gaps.push("vibe");
                if (!hours.has_hours) gaps.push("hours");
                if (!bandEff) gaps.push("price");
                if (rating <= 0) gaps.push("rating");

                docs.push({
                  id, row: r, bd, matched, matches, kwAvg, dist, gaps, name,
                  fit: { venue_type: fType, cuisine: fCuisine, neighborhood: fHood, price_band: fPrice, meal_service: fMeal },
                  // Cuisine needs more than one passing review mention (0.5): two reviews (0.7) or venue text.
                  ok: { venue_type: fType > 0, cuisine: fCuisine >= 0.6, neighborhood: fHood > 0, price_band: fPrice > 0, meal_service: fMeal >= 0.5, open_now: okOpen, radius: true },
                  hoodNamed, open: hours,
                });
              }

              // Neighborhood area: venues within 1.5 km of the centre of the venues that name it.
              let cLat = 0, cLng = 0;
              if (hood) {
                const named = docs.filter((d) => d.hoodNamed && num(d.row.latitude) && num(d.row.longitude));
                if (named.length) {
                  cLat = named.reduce((s, d) => s + num(d.row.latitude), 0) / named.length;
                  cLng = named.reduce((s, d) => s + num(d.row.longitude), 0) / named.length;
                  for (const d of docs) {
                    if (!d.hoodNamed && num(d.row.latitude) && km(cLat, cLng, num(d.row.latitude), num(d.row.longitude)) <= 1.5) {
                      d.ok.neighborhood = true; d.fit.neighborhood = 0.7;
                    }
                  }
                }
              }

              // ---------- Relax the least important filters until there are enough matches ----------
              const relaxed = [];
              let radiusNow = radiusKm;
              const passes = (d) => {
                for (const k of ["venue_type", "cuisine", "neighborhood", "price_band", "meal_service", "open_now"]) {
                  if (requested.includes(k) && !relaxed.includes(k) && !d.ok[k]) return false;
                }
                if (hasGeo && !relaxed.includes("radius") && (d.dist === null || d.dist > radiusNow)) return false;
                return true;
              };
              let pool = docs.filter(passes);
              for (const step of ["meal_service", "open_now", "price_band", "radius_x2", "radius", "venue_type", "neighborhood", "cuisine"]) {
                if (pool.length >= minN) break;
                if (step === "radius_x2") { if (!hasGeo) continue; radiusNow = radiusKm * 2; relaxed.push("radius_x2"); }
                else { if (!requested.includes(step)) continue; relaxed.push(step); }
                pool = docs.filter(passes);
              }
              // Too few venues in the area have what was asked for ("rooftop bar in Midtown", where Midtown has
              // one rooftop): widen the area too, so nearby exact matches can compete. In-area venues keep a bonus
              // and out-of-area venues lose points with distance from the area.
              const kwScarce = () => keywords.length > 0 && pool.filter((d) => d.kwAvg >= W.kw_scarce).length < minN;
              for (const step of ["neighborhood", "radius_x2", "radius"]) {
                if (!kwScarce()) break;
                if (relaxed.includes(step)) continue;
                if (step === "neighborhood" && !requested.includes("neighborhood")) continue;
                if (step !== "neighborhood" && !hasGeo) continue;
                if (step === "radius_x2") radiusNow = radiusKm * 2;
                relaxed.push(step);
                pool = docs.filter(passes);
              }
              // A relaxed filter still counts: venues that meet it stay ahead.
              const AREA = ["neighborhood", "radius_x2", "radius"];
              for (const d of pool) {
                let fitBonus = 0;
                for (const k of relaxed) {
                  const w = AREA.includes(k) ? W.relaxed_area : W.relaxed_fit;
                  if (k === "radius_x2" || k === "radius") { if (d.dist !== null && d.dist <= radiusKm) fitBonus += w; continue; }
                  if (d.ok[k]) fitBonus += w * (k in d.fit ? d.fit[k] : 1);
                }
                if (fitBonus) d.bd.relaxed_fit = fitBonus;
                if (relaxed.includes("neighborhood") && !d.ok.neighborhood && cLat && num(d.row.latitude)) {
                  const away = km(cLat, cLng, num(d.row.latitude), num(d.row.longitude));
                  d.bd.area = -Math.min(W.km_cap, Math.max(0, away - W.area_free_km) * W.per_km);
                }
              }

              // ---------- Rank: score, one venue per name, top N ----------
              for (const d of pool) {
                for (const k of Object.keys(d.bd)) d.bd[k] = round2(d.bd[k]);
                d.score = round2(Object.values(d.bd).reduce((s, x) => s + x, 0));
                if (sortBy === "rating") d.sortKey = d.bd.rating + d.bd.popularity; else d.sortKey = d.score;
              }
              pool.sort((a, b) => b.sortKey - a.sortKey || num(b.row.google_user_ratings_total) - num(a.row.google_user_ratings_total) || a.id - b.id);
              const seen = new Set(), top = [];
              for (const d of pool) {
                const key = d.name.replace(/\s*\(.*\)\s*$/, "").replace(/\s+-\s+.*$/, "").trim();
                if (seen.has(key)) continue;
                seen.add(key);
                top.push(d);
                if (top.length >= limit) break;
              }

              // ---------- Match quality ----------
              let matchQuality = "strong", failReason = null;
              if (pool.length === 0) { matchQuality = "empty"; failReason = "no_matches"; }
              else if (relaxed.length > 0 || pool.length < minN) matchQuality = "loose";
              else if (keywords.length && top.length && Math.max(...top.map((d) => d.kwAvg)) < 0.34) matchQuality = "loose";

              return {
                top: top.map((d) => ({
                  id: d.id, row: d.row, score: d.score, breakdown: d.bd, matched: d.matched, matches: d.matches,
                  km: d.dist === null ? null : round2(d.dist), gaps: d.gaps,
                  open_now: d.open.open_now, today_hours: d.open.today_hours,
                })),
                pool_count: pool.length, relaxed, requested, match_quality: matchQuality, fail_reason: failReason,
                excluded, candidates: docs.length,
              };
            }
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

        // GEN-073: distance from the user in km, only when their location was used.
        var $t_dist {
          value = $t|get:"km":null
        }

        conditional {
          if ($t_dist != null) {
            var.update $formatted {
              value = $formatted|set:"distance_km":$t_dist
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
