// V2 upgrade of fn_genie_handle_message_dev. Adds query_mode routing, weather awareness, neighborhood context, and ambient cross-table recommendations on top of the existing V1.5 pipeline.
// V2 upgrade of fn_genie_handle_message_dev. Adds query_mode routing, weather awareness, neighborhood context, and ambient cross-table recommendations.
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
  }

  stack {
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
  
    var $city_id {
      value = 1
    }
  
    var $session_query_count {
      value = ($input.session_query_number ?? 1)|to_int
    }
  
    var $v_detected_language {
      value = "en"
    }
  
    conditional {
      if ($session_query_count <= 1) {
        function.run "genie/fn_detect_query_language_dev" {
          input = {
            message   : $input.message
            session_id: ($input.session_id ?? "")
          }
        } as $lang_result
      
        var.update $v_detected_language {
          value = $lang_result|get:"detected_language":"en"
        }
      }
    }
  
    // 2. Detect query mode
    function.run "genie/fn_genie_detect_query_mode_dev" {
      input = {message: $input.message, city_name: $input.city_context}
    } as $mode_result
  
    var.update $query_mode {
      value = $mode_result|get:"query_mode":"venue"
    }
  
    // 3. Get weather context — wrapped so a weather subsystem failure
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
        function.run "genie/fn_genie_handle_message_dev" {
          input = {
            message          : $input.message
            channel          : $input.channel
            external_user_id : $input.external_user_id
            user_name        : $input.user_name
            city_context     : $input.city_context
            session_token    : $input.session_token
            lat              : $input.lat
            lng              : $input.lng
            radius_meters    : $input.radius_meters
            location_label   : $input.location_label
            detected_language: $v_detected_language
            session_id       : ($input.session_id ?? "")
          }
        } as $venue_response
      
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
            message          : $input.message
            channel          : $input.channel
            external_user_id : $input.external_user_id
            user_name        : $input.user_name
            city_context     : $input.city_context
            session_token    : $input.session_token
            lat              : $input.lat
            lng              : $input.lng
            radius_meters    : $input.radius_meters
            location_label   : $input.location_label
            detected_language: $v_detected_language
            session_id       : ($input.session_id ?? "")
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
  }
}
