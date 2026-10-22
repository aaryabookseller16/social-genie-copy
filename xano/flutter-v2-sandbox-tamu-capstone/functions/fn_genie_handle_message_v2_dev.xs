// V2 upgrade of fn_genie_handle_message_dev. Adds query_mode routing, weather awareness, neighborhood context, and ambient cross-table recommendations on top of the existing V1.5 pipeline.
// V2 upgrade of fn_genie_handle_message_dev. Adds query_mode routing, weather awareness, neighborhood context, and ambient cross-table recommendations.
// GEN-013 (2026-10-21), added without changing existing lines: optional device_id; on venue
// turns the user context is read (read-only, never linked here) and rendered for the pick
// prompt; when no location is sent, fn_genie_search_venues_dev re-ranks the shortlist with the
// intent filters and the user's preference keywords. Both have kill switches and try_catch,
// and report in the context / search response keys.
// GEN-014: dislikes (sentiment "dislike") are kept out of the preference keywords and sent to
// the search as avoid_keywords, a small ranking penalty; they are listed in debug as avoid.
// CITY-RESOLUTION: the city is resolved once up front by fn_genie_resolve_city_dev. The user's
// coordinates only reach the inner handler when they are within 80 km of the resolved city
// (geo_used). Missing, outside-area and unsupported-city cases return early with a structured
// response. The resolved city is saved on the session for follow-ups.
// GEN-071 (2026-10-22) MERGED with CITY-RESOLUTION: the model filter extraction, the model event
// fallback and the search-on-every-turn behavior are kept. The city is NOT taken from the model or
// from fn_resolve_nearest_city_dev any more: the resolver above is the single authority. The search
// receives lat/lng only when geo_used is true (the device is within 80 km of the resolved city).
function "genie/fn_genie_handle_message_v2_dev" {
  input {
    // The user's message
    text message
  
    // The messaging channel
    text channel
  
    // The unique identifier for the user on the channel
    text external_user_id
  
    // The user's display name
    text user_name?
  
    // The city context for the conversation
    text city_context?
  
    // The session token if available
    text session_token?
  
    // The user's latitude
    decimal lat?
  
    // The user's longitude
    decimal lng?
  
    // The search radius in meters
    int radius_meters?
  
    // A label for the user's location
    text location_label?
  
    // Current query number in session
    int? session_query_number?=0
  
    // Session ID if available
    text? session_id?
  
    // Device ID from the web app; finds a guest's user context (GEN-013)
    text? device_id? filters=trim
  }

  stack {
    var $v2_started_at {
      value = "now"|to_ms
    }
  
    var $filter_extraction_ms {
      value = 0
    }
  
    var $legacy_handler_ms {
      value = 0
    }
  
    var $search_ms {
      value = 0
    }
  
    var $pick_ms {
      value = 0
    }
  
    var $inner_timings {
      value = {}
    }
  
    var $ranked_search_cards {
      value = []
    }
  
    // 1. Declare variables
    var $final_reply {
      value = null
    }
  
    var $final_use_xano {
      value = false
    }
  
    var $final_reply_mode {
      value = ""
    }
  
    var $final_needs_location {
      value = false
    }
  
    var $final_filters {
      value = {}
    }
  
    var $final_show_intake_prompt {
      value = false
    }
  
    var $final_intake_prompt_copy {
      value = ""
    }
  
    var $final_profile_strength_tier {
      value = null
    }
  
    var $final_debug {
      value = null
    }
  
    var $venue_results {
      value = []
    }
  
    var $final_more_nearby_venues {
      value = []
    }
  
    var $event_results {
      value = []
    }
  
    var $enriched_events {
      value = []
    }
  
    var $query_mode {
      value = "venue"
    }
  
    var $weather_context_text {
      value = ""
    }
  
    var $should_avoid_outdoor {
      value = false
    }
  
    var $should_promote_outdoor {
      value = false
    }
  
    var $neighborhood_context {
      value = null
    }
  
    // City fields below are filled in by the resolver in step 1b.
    var $city_id {
      value = null
    }
  
    var $resolved_city_name {
      value = ""
    }
  
    var $loc_source {
      value = "none"
    }
  
    var $geo_used {
      value = false
    }
  
    var $loc_status {
      value = "ok"
    }
  
    var $supported_cities {
      value = []
    }
  
    var $unsupported_city_name {
      value = ""
    }
  
    var $inner_lat {
      value = 0
    }
  
    var $inner_lng {
      value = 0
    }
  
    // GEN-013: user context and request-first search. Kill switches: set to false to skip.
    var $context_enabled {
      value = true
    }
  
    var $search_enabled {
      value = true
    }
  
    var $user_context_text {
      value = ""
    }
  
    var $preference_keywords {
      value = []
    }
  
    // GEN-014: the user's dislikes ("not into"), a small ranking penalty in the search.
    var $avoid_keywords {
      value = []
    }
  
    var $context_debug {
      value = {enabled: $context_enabled, source: "none"}
    }
  
    var $search_match_quality {
      value = ""
    }
  
    var $search_debug {
      value = {enabled: $search_enabled, used: false}
    }
  
    // GEN-071: model filters (any language) and one ranker. Kill switches: set to false to skip.
    var $filters_model_enabled {
      value = true
    }
  
    var $search_all_turns {
      value = true
    }
  
    var $mf {
      value = {ok: false}
    }
  
    // The resolver only returns "ok" for an active city, so the search city is always usable then.
    var $search_city_ok {
      value = true
    }
  
    var $city_debug {
      value = {source: "none", city_id: null}
    }
  
    var $legacy_events {
      value = []
    }
  
    // 1b. Resolve which supported city this request is about, and whether the
    // user's coordinates apply to it.
    function.run "genie/fn_genie_resolve_city_dev" {
      input = {
        message         : $input.message
        city_context    : $input.city_context
        lat             : $input.lat
        lng             : $input.lng
        session_token   : $input.session_token
        external_user_id: $input.external_user_id
      }
    } as $city_res
  
    var.update $loc_status {
      value = $city_res|get:"location_status":"city_missing"
    }
  
    var.update $city_id {
      value = $city_res|get:"city_id":null
    }
  
    var.update $resolved_city_name {
      value = $city_res|get:"city_name":""
    }
  
    var.update $loc_source {
      value = $city_res|get:"source":"none"
    }
  
    var.update $geo_used {
      value = $city_res|get:"geo_used":false
    }
  
    var.update $supported_cities {
      value = $city_res|get:"supported_cities":[]
    }
  
    var.update $unsupported_city_name {
      value = $city_res|get:"unsupported_city":""
    }
  
    var.update $city_debug {
      value = {
        source  : $loc_source
        city_id : $city_id
        city    : $resolved_city_name
        geo_used: $geo_used
        status  : $loc_status
      }
    }
  
    // Only pass coordinates down when they belong to the resolved city.
    conditional {
      if ($geo_used) {
        var.update $inner_lat {
          value = ($input.lat ?? 0)|to_decimal
        }
      
        var.update $inner_lng {
          value = ($input.lng ?? 0)|to_decimal
        }
      }
    }
  
    // 1c. No usable city: answer with a follow-up question instead of searching.
    conditional {
      if ($loc_status != "ok") {
        var $supported_text {
          value = $supported_cities|join:", "
        }
      
        var $early_reply {
          value = ""
        }
      
        conditional {
          if ($loc_status == "unsupported_city") {
            var.update $early_reply {
              value = ((("I don't cover " ~ $unsupported_city_name) ~ " yet. Right now I can search ") ~ $supported_text) ~ ". Want me to look there?"
            }
          }
        
          elseif ($loc_status == "outside_supported_area") {
            var.update $early_reply {
              value = ("It looks like you're outside the cities I cover right now. I can search " ~ $supported_text) ~ ". Which one should I use?"
            }
          }
        
          else {
            var.update $early_reply {
              value = ("Which city should I search? I can cover " ~ $supported_text) ~ "."
            }
          }
        }
      
        debug.log {
          value = {
            checkpoint      : "V2_CITY_UNRESOLVED"
            location_status : $loc_status
            source          : $loc_source
            unsupported_city: $unsupported_city_name
          }
        }
      
        return {
          value = {
            success               : true
            reply                 : $early_reply
            use_xano              : false
            reply_mode            : $loc_status
            venues                : []
            more_nearby_venues    : []
            events                : []
            query_mode            : "venue"
            needs_location        : ($city_res|get:"wants_near_me":false) && (($city_res|get:"has_geo":false) == false)
            filters               : {}
            show_intake_prompt    : false
            intake_prompt_copy    : ""
            profile_strength_tier : null
            debug                 : null
            weather_context_text  : ""
            should_avoid_outdoor  : false
            should_promote_outdoor: false
            neighborhood_context  : null
            is_outdoor_sensitive  : false
            detected_neighborhood : ""
            pick_reasons          : []
            llm                   : {enabled: false, used: false}
            context               : {enabled: false, source: "none"}
            search                : {enabled: false, used: false}
            resolved_city         : null
            city_source           : $loc_source
            geo_used              : false
            location_status       : $loc_status
            supported_cities      : $supported_cities
            unsupported_city      : $unsupported_city_name
            search_filters        : {ok: false}
            city                  : $city_debug
          }
        }
      }
    }
  
    // 2. Detect query mode
    function.run "genie/fn_genie_detect_query_mode_dev" {
      input = {message: $input.message, city_name: $resolved_city_name}
    } as $mode_result
  
    var.update $query_mode {
      value = $mode_result|get:"query_mode":"venue"
    }
  
    // 2b. GEN-071: the model reads the message in any language and sets the mode and filters.
    // The resolved city is passed as context. On any failure the keyword result above stands.
    conditional {
      if ($filters_model_enabled) {
        try_catch {
          try {
            var $filter_started_at {
              value = "now"|to_ms
            }
          
            function.run "genie/fn_genie_extract_search_filters_dev" {
              input = {
                message     : $input.message
                city_context: $resolved_city_name
              }
            } as $mf_result
          
            var.update $filter_extraction_ms {
              value = ("now"|to_ms) - $filter_started_at
            }
          
            var.update $mf {
              value = $mf_result ?? {ok: false}
            }
          }
        
          catch {
            var.update $mf {
              value = {ok: false, fail_reason: "exception"}
            }
          }
        }
      }
    }
  
    conditional {
      if ($mf|get:"ok") {
        var.update $query_mode {
          value = $mf|get:"mode"
        }
      }
    }
  
    // 3. Get weather context. Wrapped so a weather subsystem failure
    // can't take down the whole chat endpoint; falls back to safe defaults.
    var $weather_result {
      value = null
    }
  
    try_catch {
      try {
        function.run "genie/fn_genie_update_handle_message_weather_dev" {
          input = {city_id: $city_id, message: $input.message}
        } as $weather_result
      }
    
      catch {
        var.update $weather_result {
          value = null
        }
      }
    }
  
    var.update $weather_context_text {
      value = $weather_result|get:"weather_context_text":""
    }
  
    var.update $should_avoid_outdoor {
      value = $weather_result|get:"should_avoid_outdoor":false
    }
  
    var.update $should_promote_outdoor {
      value = $weather_result
        |get:"should_promote_outdoor":false
    }
  
    // 4. Route by query_mode
  
    // VENUE MODE (default)
    conditional {
      if ($query_mode == "venue") {
        var $legacy_started_at {
          value = "now"|to_ms
        }
      
        function.run "genie/fn_genie_handle_message_dev" {
          input = {
            message         : $input.message
            channel         : $input.channel
            external_user_id: $input.external_user_id
            user_name       : $input.user_name
            city_context    : $resolved_city_name
            session_token   : $input.session_token
            lat             : $inner_lat
            lng             : $inner_lng
            radius_meters   : $input.radius_meters
            location_label  : $input.location_label
            session_id      : ($input.session_id ?? "")
          }
        } as $venue_response
      
        var.update $legacy_handler_ms {
          value = ("now"|to_ms) - $legacy_started_at
        }
      
        var.update $inner_timings {
          value = {
            user_ms   : $venue_response|get:"t_user_ms":null
            session_ms: $venue_response|get:"t_session_ms":null
            log_ms    : $venue_response|get:"t_log_ms":null
            intent_ms : $venue_response|get:"t_intent_ms":null
            venues_ms : $venue_response|get:"t_venues_ms":null
            total_ms  : $venue_response|get:"t_total_ms":null
          }
        }
      
        var.update $final_reply {
          value = $venue_response|get:"reply":""
        }
      
        // Update outer query_mode and events from inner response
        var.update $query_mode {
          value = $venue_response|get:"query_mode":"venue"
        }
      
        var.update $event_results {
          value = $venue_response|get:"events":[]
        }
      
        // Keep primary venues and "more nearby" venues as two distinct
        // lists instead of merging them into one.
        var.update $venue_results {
          value = $venue_response|get:"venues":[]
        }
      
        var.update $final_more_nearby_venues {
          value = $venue_response|get:"more_nearby_venues":[]
        }
      
        var.update $final_use_xano {
          value = $venue_response|get:"use_xano":false
        }
      
        var.update $final_reply_mode {
          value = $venue_response|get:"reply_mode":""
        }
      
        var.update $final_needs_location {
          value = $venue_response|get:"needs_location":false
        }
      
        var.update $final_filters {
          value = $venue_response|get:"filters":{}
        }
      
        var.update $final_show_intake_prompt {
          value = $venue_response|get:"show_intake_prompt":false
        }
      
        var.update $final_intake_prompt_copy {
          value = $venue_response|get:"intake_prompt_copy":""
        }
      
        var.update $final_profile_strength_tier {
          value = $venue_response|get:"profile_strength_tier":null
        }
      
        var.update $final_debug {
          value = $venue_response|get:"debug":null
        }
      }
    }
  
    // GEN-071: fn_genie_handle_message_dev has its own English event check ("tonight", "show").
    // When the model said venue, keep venue mode; its events are set aside and come back only if
    // the search finds nothing.
    conditional {
      if (($mf|get:"ok") && ($mf|get:"mode") == "venue" && $query_mode == "event") {
        var.update $legacy_events {
          value = $event_results
        }
      
        var.update $event_results {
          value = []
        }
      
        var.update $query_mode {
          value = "venue"
        }
      }
    }
  
    // NEIGHBORHOOD MODE
    conditional {
      if ($query_mode == "neighborhood") {
        function.run "genie/fn_genie_get_neighborhood_context_dev" {
          input = {
            neighborhood_name: $mode_result|get:"detected_neighborhood":""
            city_id          : $city_id
          }
        } as $hood_context
      
        var.update $neighborhood_context {
          value = $hood_context
        }
      
        function.run "genie/fn_genie_get_neighborhood_venues_dev" {
          input = {
            neighborhood_name: $mode_result|get:"detected_neighborhood":""
            city_id          : $city_id
            limit            : 10
          }
        } as $hood_venues
      
        var.update $venue_results {
          value = $hood_venues|get:"venues":[]
        }
      
        var.update $final_use_xano {
          value = (($venue_results|count) > 0)
        }
      
        conditional {
          if (($venue_results|count) > 0) {
            var.update $final_reply_mode {
              value = "has_results"
            }
          }
        
          else {
            var.update $final_reply_mode {
              value = "supported_no_results"
            }
          }
        }
      
        function.run "genie/fn_genie_get_reply_v2_dev" {
          input = {
            intent           : "general"
            reply_mode       : "neighborhood_intro"
            neighborhood_name: $mode_result|get:"detected_neighborhood":""
          }
        } as $hood_reply
      
        var.update $final_reply {
          value = $hood_reply
        }
      }
    }
  
    // AMBIENT MODE
    conditional {
      if ($query_mode == "ambient") {
        function.run "genie/fn_genie_get_ambient_recommendations_dev" {
          input = {
            city_id            : $city_id
            is_raining_now     : $weather_result|get:"is_raining_now":false
            is_good_for_outdoor: $weather_result|get:"is_good_for_outdoor":true
            limit              : 8
          }
        } as $ambient_result
      
        var.update $venue_results {
          value = $ambient_result|get:"venues":[]
        }
      
        var.update $event_results {
          value = $ambient_result|get:"events":[]
        }
      
        var.update $final_use_xano {
          value = ((($venue_results|count) + ($event_results|count)) > 0)
        }
      
        conditional {
          if ((($venue_results|count) + ($event_results|count)) > 0) {
            var.update $final_reply_mode {
              value = "has_results"
            }
          }
        
          else {
            var.update $final_reply_mode {
              value = "supported_no_results"
            }
          }
        }
      
        function.run "genie/fn_genie_get_reply_v2_dev" {
          input = {intent: "general", reply_mode: "ambient_tonight"}
        } as $ambient_reply
      
        var.update $final_reply {
          value = $ambient_reply
        }
      }
    }
  
    // EVENT MODE
    conditional {
      if ($query_mode == "event") {
        function.run "genie/fn_genie_handle_message_dev" {
          input = {
            message         : $input.message
            channel         : $input.channel
            external_user_id: $input.external_user_id
            user_name       : $input.user_name
            city_context    : $resolved_city_name
            session_token   : $input.session_token
            lat             : $inner_lat
            lng             : $inner_lng
            radius_meters   : $input.radius_meters
            location_label  : $input.location_label
            session_id      : ($input.session_id ?? "")
          }
        } as $event_response
      
        var.update $final_reply {
          value = $event_response|get:"reply":""
        }
      
        // Update outer query_mode and events from inner response
        var.update $query_mode {
          value = $event_response|get:"query_mode":"event"
        }
      
        var.update $event_results {
          value = $event_response|get:"events":[]
        }
      
        // Keep primary venues and "more nearby" venues as two distinct
        // lists instead of merging them into one.
        var.update $venue_results {
          value = $event_response|get:"venues":[]
        }
      
        var.update $final_more_nearby_venues {
          value = $event_response|get:"more_nearby_venues":[]
        }
      
        var.update $final_use_xano {
          value = $event_response|get:"use_xano":false
        }
      
        var.update $final_reply_mode {
          value = $event_response|get:"reply_mode":""
        }
      
        var.update $final_needs_location {
          value = $event_response|get:"needs_location":false
        }
      
        var.update $final_filters {
          value = $event_response|get:"filters":{}
        }
      
        var.update $final_show_intake_prompt {
          value = $event_response|get:"show_intake_prompt":false
        }
      
        var.update $final_intake_prompt_copy {
          value = $event_response|get:"intake_prompt_copy":""
        }
      
        var.update $final_profile_strength_tier {
          value = $event_response|get:"profile_strength_tier":null
        }
      
        var.update $final_debug {
          value = $event_response|get:"debug":null
        }
      }
    }
  
    // GEN-071: an event request the model recognised but the legacy English check did not
    // ("conciertos", "eventos"): run the legacy event query here (active, from today, 10 by date)
    // for the RESOLVED city. No Houston fallback: status "ok" guarantees a resolved city.
    conditional {
      if (($mf|get:"ok") && ($mf|get:"mode") == "event" && $query_mode != "event") {
        var $ev_today {
          value = now|format_timestamp:"Y-m-d":"UTC"
        }
      
        var $ev_city {
          value = $resolved_city_name
        }
      
        db.query genie_social_events {
          where = ($db.genie_social_events.city == $ev_city || $db.genie_social_events.city == ($ev_city|to_lower)) && $db.genie_social_events.status == "active" && $db.genie_social_events.event_date >= $ev_today
          sort = {event_date: "asc"}
          return = {type: "list", paging: {page: 1, per_page: 10}}
        } as $ev_result
      
        var $ev_items {
          value = ($ev_result|get:"items") ?? []
        }
      
        var.update $query_mode {
          value = "event"
        }
      
        var.update $event_results {
          value = $ev_items
        }
      
        var.update $venue_results {
          value = []
        }
      
        conditional {
          if (($ev_items|count) > 0) {
            var.update $final_reply_mode {
              value = "has_results"
            }
          
            var.update $final_use_xano {
              value = true
            }
          
            var.update $final_reply {
              value = (("Here are some events happening in " ~ $ev_city) ~ " that match your vibe.")
            }
          }
        
          else {
            var.update $final_reply_mode {
              value = "supported_no_results"
            }
          
            var.update $final_use_xano {
              value = false
            }
          }
        }
      }
    }
  
    // 4a. User context (GEN-013). Read-only: linking happens at sign-in (merge_guest_profile),
    // never here. A failure leaves the context empty and never blocks the turn.
    conditional {
      if ($context_enabled && $query_mode == "venue") {
        try_catch {
          try {
            var $ctx_ext_id {
              value = ($input.external_user_id ?? "")|trim
            }
          
            var $ctx_user_id {
              value = 0
            }
          
            conditional {
              if ($ctx_ext_id != "" && $ctx_ext_id != "web_guest") {
                db.query genie_user {
                  where = $db.genie_user.external_user_id == $ctx_ext_id
                  return = {type: "single"}
                } as $ctx_user
              
                conditional {
                  if ($ctx_user != null) {
                    var.update $ctx_user_id {
                      value = $ctx_user.id
                    }
                  }
                }
              }
            }
          
            function.run "genie/fn_genie_resolve_user_context_dev" {
              input = {
                user_id         : $ctx_user_id
                device_id       : $input.device_id
                external_user_id: $ctx_ext_id
                link            : false
              }
            } as $ctx_resolved
          
            var $ctx_row {
              value = ($ctx_resolved|get:"row") ?? null
            }
          
            var $ctx_source {
              value = ($ctx_resolved|get:"source") ?? "none"
            }
          
            var $ctx_count {
              value = 0
            }
          
            var $ctx_truncated {
              value = false
            }
          
            conditional {
              if ($ctx_row != null) {
                var $ctx_json {
                  value = ($ctx_row|get:"context_json") ?? {}
                }
              
                function.run "genie/fn_genie_render_user_context_dev" {
                  input = {context: $ctx_json}
                } as $ctx_render
              
                var.update $user_context_text {
                  value = (($ctx_render|get:"text") ?? "")|trim
                }
              
                var.update $ctx_count {
                  value = ($ctx_render|get:"count") ?? 0
                }
              
                var.update $ctx_truncated {
                  value = ($ctx_render|get:"truncated") ?? false
                }
              
                // Preference keywords for the search bonus: live, non-sensitive tastes only.
                var $ctx_prefs {
                  value = ($ctx_json|get:"preferences") ?? []
                }
              
                conditional {
                  if ($ctx_prefs|is_array) {
                    var $ctx_live {
                      value = $ctx_prefs|filter:(($$.status == "active" || $$.status == "user_edited") && $$.sensitivity != "sensitive" && (["atmosphere", "experience", "food", "occasion"]|in:$$.category) && ($$|get:"sentiment") != "dislike")
                    }
                  
                    var.update $preference_keywords {
                      value = ($ctx_live|map:(($$.value|to_lower)|trim))|slice:0:10
                    }
                  
                    // GEN-014: dislikes, same categories; entries without sentiment are likes.
                    var $ctx_dislikes {
                      value = $ctx_prefs|filter:(($$.status == "active" || $$.status == "user_edited") && $$.sensitivity != "sensitive" && (["atmosphere", "experience", "food", "occasion"]|in:$$.category) && ($$|get:"sentiment") == "dislike")
                    }
                  
                    var.update $avoid_keywords {
                      value = ($ctx_dislikes|map:(($$.value|to_lower)|trim))|slice:0:10
                    }
                  }
                }
              }
            }
          
            var.update $context_debug {
              value = {
                enabled  : true
                source   : $ctx_source
                user_id  : $ctx_user_id
                count    : $ctx_count
                chars    : $user_context_text|strlen
                truncated: $ctx_truncated
                keywords : $preference_keywords
                avoid    : $avoid_keywords
              }
            }
          }
        
          catch {
            var.update $user_context_text {
              value = ""
            }
          
            var.update $preference_keywords {
              value = []
            }
          
            var.update $avoid_keywords {
              value = []
            }
          
            var.update $context_debug {
              value = {enabled: true, source: "error"}
            }
          }
        }
      }
    }
  
    // 4a2. Request-first search (Zach's fn_genie_search_venues_dev) on every venue turn (GEN-071).
    // The user's location goes to the search ONLY when geo_used is true (device within 80 km of the
    // resolved city); a device in another city never restricts or distorts the search. When it finds
    // matches, its card rows replace the shortlist sent to the model and its match_quality goes into
    // the prompt; otherwise the legacy result stays. $search_all_turns = false restores the GEN-013
    // rule (only turns with legacy results, and not when the location is in use).
    conditional {
      if ($search_enabled && $query_mode == "venue" && $search_city_ok && ($search_all_turns || ($final_reply_mode == "has_results" && ($venue_results|count) > 0))) {
        conditional {
          if ($geo_used && $search_all_turns == false) {
            var.update $search_debug {
              value = {enabled: true, used: false, skipped: "location_used"}
            }
          }
        
          else {
            try_catch {
              try {
                var $sf {
                  value = $final_filters ?? {}
                }
              
                var $sf_type {
                  value = (($sf|get:"type") ?? "")|to_lower
                }
              
                var $s_meal {
                  value = ""
                }
              
                conditional {
                  if (["brunch", "happy_hour", "late_night", "reverse_happy_hour"]|in:$sf_type) {
                    var.update $s_meal {
                      value = $sf_type
                    }
                  }
                }
              
                var $s_cuisine {
                  value = (($sf|get:"cuisine") ?? "")|replace:"_":" "
                }
              
                var $s_keywords {
                  value = []
                }
              
                var $sf_venue_type {
                  value = ((($sf|get:"venue_type") ?? "")|replace:"_":" ")|trim
                }
              
                conditional {
                  if ($sf_venue_type != "") {
                    array.push $s_keywords {
                      value = $sf_venue_type
                    }
                  }
                }
              
                var $sf_occasion {
                  value = ((($sf|get:"occasion") ?? "")|replace:"_":" ")|trim
                }
              
                conditional {
                  if ($sf_occasion != "") {
                    array.push $s_keywords {
                      value = $sf_occasion
                    }
                  }
                }
              
                var $sf_vibe {
                  value = (($sf|get:"vibe") ?? "")|trim
                }
              
                conditional {
                  if ($sf_vibe != "") {
                    array.push $s_keywords {
                      value = $sf_vibe
                    }
                  }
                }
              
                conditional {
                  if ($sf_type == "hookah" || $sf_type == "patio") {
                    array.push $s_keywords {
                      value = $sf_type
                    }
                  }
                }
              
                // Venue type from the words of the message (bar, club, cafe, restaurant).
                var $msg_tokens {
                  value = ((((($input.message ?? "")|to_lower)|replace:",":" ")|replace:".":" ")|replace:"?":" ")|replace:"!":" "
                }
              
                var $msg_words {
                  value = $msg_tokens|split:" "
                }
              
                var $s_venue_type {
                  value = ""
                }
              
                conditional {
                  if (($msg_words|in:"club") || ($msg_words|in:"clubs") || ($msg_words|in:"nightclub")) {
                    var.update $s_venue_type {
                      value = "club"
                    }
                  }
                
                  elseif (($msg_words|in:"bar") || ($msg_words|in:"bars")) {
                    var.update $s_venue_type {
                      value = "bar"
                    }
                  }
                
                  elseif (($msg_words|in:"cafe") || ($msg_words|in:"coffee")) {
                    var.update $s_venue_type {
                      value = "cafe"
                    }
                  }
                
                  elseif (($msg_words|in:"restaurant") || ($msg_words|in:"restaurants") || ($msg_words|in:"dinner")) {
                    var.update $s_venue_type {
                      value = "restaurant"
                    }
                  }
                }
              
                var $s_open_now {
                  value = (($input.message ?? "")|icontains:"open now") || (($input.message ?? "")|icontains:"right now")
                }
              
                // GEN-071: the model's filters replace the English rules above when it answered.
                var $s_hood {
                  value = ""
                }
              
                var $s_price {
                  value = ""
                }
              
                var $s_energy {
                  value = ""
                }
              
                var $s_language {
                  value = ""
                }
              
                var $s_source {
                  value = "rules"
                }
              
                conditional {
                  if ($mf|get:"ok") {
                    var.update $s_venue_type {
                      value = ($mf|get:"venue_type") ?? ""
                    }
                  
                    var.update $s_cuisine {
                      value = ($mf|get:"cuisine") ?? ""
                    }
                  
                    var.update $s_meal {
                      value = ($mf|get:"meal_service") ?? ""
                    }
                  
                    var.update $s_open_now {
                      value = ($mf|get:"open_now") == true
                    }
                  
                    var.update $s_keywords {
                      value = ($mf|get:"keywords") ?? []
                    }
                  
                    var.update $s_hood {
                      value = ($mf|get:"neighborhood") ?? ""
                    }
                  
                    var.update $s_price {
                      value = ($mf|get:"price_band") ?? ""
                    }
                  
                    var.update $s_energy {
                      value = ($mf|get:"energy") ?? ""
                    }
                  
                    var.update $s_language {
                      value = ($mf|get:"language") ?? ""
                    }
                  
                    var.update $s_source {
                      value = "model"
                    }
                  }
                }
              
                // Location for the search: only when it belongs to the resolved city.
                var $s_lat {
                  value = null
                }
              
                var $s_lng {
                  value = null
                }
              
                var $s_radius {
                  value = null
                }
              
                conditional {
                  if ($geo_used) {
                    var.update $s_lat {
                      value = $inner_lat
                    }
                  
                    var.update $s_lng {
                      value = $inner_lng
                    }
                  }
                }
              
                conditional {
                  if ($geo_used && (($input.radius_meters ?? 0)|to_int) > 0) {
                    var.update $s_radius {
                      value = $input.radius_meters|to_int
                    }
                  }
                }
              
                var $search_started_at {
                  value = "now"|to_ms
                }
              
                function.run "genie/fn_genie_search_venues_dev" {
                  input = {
                    city_id            : $city_id
                    venue_type         : $s_venue_type
                    cuisine            : $s_cuisine
                    meal_service       : $s_meal
                    open_now           : $s_open_now
                    keywords           : $s_keywords
                    preference_keywords: $preference_keywords
                    avoid_keywords     : $avoid_keywords
                    limit              : 10
                    neighborhood       : $s_hood
                    price_band         : $s_price
                    energy             : $s_energy
                    lat                : $s_lat
                    lng                : $s_lng
                    radius_m           : $s_radius
                    language           : $s_language
                  }
                } as $search_result
              
                var.update $search_ms {
                  value = ("now"|to_ms) - $search_started_at
                }
              
                var $s_cards {
                  value = ($search_result|get:"cards") ?? []
                }
              
                var.update $ranked_search_cards {
                  value = $s_cards
                }
              
                var $s_quality {
                  value = ($search_result|get:"match_quality") ?? "empty"
                }
              
                var $s_used {
                  value = false
                }
              
                conditional {
                  if ($s_quality != "empty" && ($s_cards|is_array) && ($s_cards|count) > 0) {
                    var.update $venue_results {
                      value = $s_cards
                    }
                  
                    var.update $search_match_quality {
                      value = $s_quality
                    }
                  
                    var.update $s_used {
                      value = true
                    }
                  
                    var.update $final_reply_mode {
                      value = "has_results"
                    }
                  
                    var.update $final_use_xano {
                      value = true
                    }
                  }
                }
              
                var.update $search_debug {
                  value = {
                    enabled       : true
                    used          : $s_used
                    match_quality : $s_quality
                    relaxed       : ($search_result|get:"relaxed") ?? []
                    count         : ($search_result|get:"count") ?? 0
                    venue_type    : $s_venue_type
                    cuisine       : $s_cuisine
                    meal_service  : $s_meal
                    open_now      : $s_open_now
                    keywords      : $s_keywords
                    pref_keywords : $preference_keywords
                    avoid_keywords: $avoid_keywords
                    source        : $s_source
                    neighborhood  : $s_hood
                    price_band    : $s_price
                    energy        : $s_energy
                    geo_used      : $geo_used
                    ranking       : (($search_result|get:"debug") ?? {})|get:"ranking"
                  }
                }
              }
            
              catch {
                var.update $search_debug {
                  value = {enabled: true, used: false, skipped: "error"}
                }
              }
            }
          }
        }
      }
    }
  
    // GEN-071: the model's filters and the city also go into the search debug, which the chat
    // endpoint already returns.
    var.update $search_debug {
      value = ($search_debug|set:"filters":$mf)|set:"city":$city_debug
    }
  
    // GEN-071: nothing found for a venue request that the legacy handler took as an event
    // request: show its events after all.
    conditional {
      if (($legacy_events|count) > 0 && ($search_debug|get:"used") != true) {
        var.update $event_results {
          value = $legacy_events
        }
      
        var.update $query_mode {
          value = "event"
        }
      }
    }
  
    // 4b. Model-driven picks for has_results turns (replaces LLM commentary).
    // Kill switch: set to false to go back to reply-bank text.
    var $model_call_enabled {
      value = true
    }
  
    var $pick_reasons {
      value = []
    }
  
    var $picked_venue_ids {
      value = []
    }
  
    var $selected_venue_ids {
      value = []
    }
  
    var $more_nearby_source {
      value = []
    }
  
    var $more_nearby_count {
      value = 0
    }
  
    var $llm_debug {
      value = {enabled: $model_call_enabled, used: false}
    }
  
    conditional {
      if ($model_call_enabled && $query_mode == "venue" && $final_reply_mode == "has_results" && ($venue_results|count) > 0) {
        try_catch {
          try {
            var $pick_started_at {
              value = "now"|to_ms
            }
          
            function.run "genie/fn_genie_run_turn_dev" {
              input = {
                message      : $input.message
                venues       : $venue_results
                city         : $resolved_city_name
                match_quality: $search_match_quality
                user_context : $user_context_text
              }
            } as $model_result
          
            var.update $pick_ms {
              value = ("now"|to_ms) - $pick_started_at
            }
          
            conditional {
              if ($model_result|get:"used":false) {
                var.update $final_reply {
                  value = $model_result.reply
                }
              
                var.update $pick_reasons {
                  value = $model_result.pick_reasons
                }
              
                var.update $picked_venue_ids {
                  value = $model_result|get:"picked_ids":[]|safe_array
                }
              
                var.update $venue_results {
                  value = $model_result.venues
                }
              
              }
            }
          
            var.update $llm_debug {
              value = ```
                {
                  enabled        : true
                  used           : $model_result|get:"used":false
                  fail_reason    : $model_result|get:"fail_reason":null
                  model          : $model_result|get:"model":null
                  latency_ms     : $model_result|get:"latency_ms":0
                  candidate_count: $model_result|get:"candidate_count":0
                  picked_ids     : $model_result|get:"picked_ids":[]
                }
                ```
            }
          }
          catch {
            var.update $llm_debug {
              value = {enabled: true, used: false, fail_reason: "exception"}
            }
          }
        }
      }
    }
  
    // Keep the alternatives relevant and small: take the next ranked search cards,
    // excluding the picks already shown as primary venues.
    conditional {
      if (($picked_venue_ids|count) > 0) {
        var.update $selected_venue_ids {
          value = $picked_venue_ids
        }
      }
    
      else {
        foreach ($venue_results|slice:0:3) {
          each as $selected_venue {
            var.update $selected_venue_ids {
              value = $selected_venue_ids|append:(($selected_venue|get:"id":0)|to_int)
            }
          }
        }
      }
    }
  
    conditional {
      if (($ranked_search_cards|count) > 0) {
        var.update $more_nearby_source {
          value = $ranked_search_cards
        }
      }
    
      else {
        var.update $more_nearby_source {
          value = $final_more_nearby_venues
        }
      }
    }
  
    var.update $final_more_nearby_venues {
      value = []
    }
  
    foreach ($more_nearby_source) {
      each as $nearby_venue {
        var $nearby_id {
          value = (($nearby_venue|get:"id":0)|to_int)
        }
      
        conditional {
          if (($nearby_id > 0) && ($selected_venue_ids|in:$nearby_id) == false && $more_nearby_count < 5) {
            conditional {
              if (($ranked_search_cards|count) > 0) {
                var.update $final_more_nearby_venues {
                  value = $final_more_nearby_venues|append:$nearby_venue
                }
              }
            
              else {
                function.run "genie/fn_genie_slim_venue_row_dev" {
                  input = {venue: $nearby_venue}
                } as $nearby_card
              
                var.update $final_more_nearby_venues {
                  value = $final_more_nearby_venues|append:$nearby_card
                }
              }
            }
            
            var.update $more_nearby_count {
              value = $more_nearby_count + 1
            }
          }
        }
      }
    }
  
    debug.log {
      value = {
        checkpoint             : "V2_HANDLER_AFTER_ROUTING"
        query_mode             : $query_mode
        final_reply            : $final_reply
        final_use_xano         : $final_use_xano
        final_reply_mode       : $final_reply_mode
        venue_count            : $venue_results|count
        more_nearby_venue_count: $final_more_nearby_venues|count
        event_count            : $event_results|count
        resolved_city          : $resolved_city_name
        city_source            : $loc_source
        geo_used               : $geo_used
      }
    }
  
    // 5. Post-process events for enrichment
    conditional {
      if (($event_results|count) > 0) {
        foreach ($event_results) {
          each as $evt {
            var $evt_venue {
              value = null
            }
          
            conditional {
              if ((($evt|get:"venue_id":0)|to_int) > 0) {
                db.get genie_venues {
                  field_name = "id"
                  field_value = $evt.venue_id
                } as $evt_venue_record
              
                var.update $evt_venue {
                  value = $evt_venue_record
                }
              }
            }
          
            var $enriched_evt {
              value = $evt|merge:{venue: $evt_venue}
            }
          
            var.update $enriched_events {
              value = $enriched_events|append:$enriched_evt
            }
          }
        }
      }
    }
  
    // 6. Apply weather override
    conditional {
      if ($should_avoid_outdoor && ($mode_result|get:"is_outdoor_sensitive":false) && (($final_reply == null) || (($final_reply|trim) == ""))) {
        function.run "genie/fn_genie_get_reply_v2_dev" {
          input = {
            intent        : "general"
            reply_mode    : "weather_raining"
            is_raining_now: true
          }
        } as $weather_reply
      
        var.update $final_reply {
          value = $weather_reply
        }
      }
    }
  
    // 7. Final fallback
    conditional {
      if (($final_reply == null) || (($final_reply|trim) == "")) {
        var.update $final_reply {
          value = "Let me find something great for you."
        }
      }
    }
  
    // 8. Remember the resolved city on the session so follow-ups ("what about brunch?")
    // stay in the same city. Never touches the profile. A failure here never blocks the reply.
    var $persist_token {
      value = ($input.session_token ?? "")|trim
    }
  
    conditional {
      if ($loc_status == "ok" && $persist_token != "" && $resolved_city_name != "" && $loc_source != "session") {
        try_catch {
          try {
            db.query genie_session {
              where = $db.genie_session.session_token == $persist_token
              return = {type: "single"}
            } as $persist_sess
          
            conditional {
              if ($persist_sess != null && ((($persist_sess|get:"city_context":"") ?? "")|to_lower) != ($resolved_city_name|to_lower)) {
                db.edit genie_session {
                  field_name = "id"
                  field_value = $persist_sess.id
                  data = {city_context: $resolved_city_name}
                } as $persist_updated
              }
            }
          }
        
          catch {
            debug.log {
              value = {checkpoint: "V2_SESSION_CITY_PERSIST_FAILED", city: $resolved_city_name}
            }
          }
        }
      }
    }
  
    debug.log {
      value = {
        checkpoint             : "V2_HANDLER_FINAL_STATE"
        final_reply            : $final_reply
        venue_count            : $venue_results|count
        more_nearby_venue_count: $final_more_nearby_venues|count
        event_count            : $enriched_events|count
        query_mode             : $query_mode
        final_use_xano         : $final_use_xano
      }
    }
  }

  response = {
    success               : true
    reply                 : $final_reply
    use_xano              : $final_use_xano
    reply_mode            : $final_reply_mode
    venues                : $venue_results
    more_nearby_venues    : $final_more_nearby_venues
    events                : $enriched_events
    query_mode            : $query_mode
    needs_location        : $final_needs_location
    filters               : $final_filters
    show_intake_prompt    : $final_show_intake_prompt
    intake_prompt_copy    : $final_intake_prompt_copy
    profile_strength_tier : $final_profile_strength_tier
    debug                 : $final_debug
    weather_context_text  : $weather_context_text
    should_avoid_outdoor  : $should_avoid_outdoor
    should_promote_outdoor: $should_promote_outdoor
    neighborhood_context  : $neighborhood_context
    is_outdoor_sensitive  : $mode_result|get:"is_outdoor_sensitive":false
    detected_neighborhood : $mode_result|get:"detected_neighborhood":""
    pick_reasons          : $pick_reasons
    timings               : {
      v2_total_ms          : ("now"|to_ms) - $v2_started_at
      filter_extraction_ms : $filter_extraction_ms
      legacy_handler_ms    : $legacy_handler_ms
      inner                : $inner_timings
      search_ms            : $search_ms
      pick_ms              : $pick_ms
    }
    llm                   : $llm_debug
    context               : $context_debug
    search                : $search_debug
    resolved_city         : {id: $city_id, name: $resolved_city_name}
    city_source           : $loc_source
    geo_used              : $geo_used
    location_status       : $loc_status
    supported_cities      : $supported_cities
    unsupported_city      : $unsupported_city_name
    search_filters        : $mf
    city                  : $city_debug
  }
}
