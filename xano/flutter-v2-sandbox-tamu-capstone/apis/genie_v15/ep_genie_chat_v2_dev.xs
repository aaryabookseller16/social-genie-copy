// V2 Genie chat endpoint. Replaces ep_external_genie_message_dev as the primary chat endpoint.
// Adds weather awareness, neighborhood routing, and ambient recommendations.
// Version: 1.5.5 (Final Stability)
query "genie/ep_genie_chat_v2_dev" verb=POST {
  api_group = "genie_v15"

  input {
    // The user's message
    text message
  
    // The messaging channel (default: app)
    text channel?=app
  
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
    // Declare the final response variable at the top level of the stack to ensure scope
    var $final_result {
      value = {success: false, error: "Endpoint failed to initialize"}
    }
  
    try_catch {
      try {
        // --- 1. Session Token Initialization ---
        var $v_session_token {
          value = ($input.session_token ?? "")|trim
        }
      
        conditional {
          if ($v_session_token == "") {
            security.create_uuid as $v_session_token
          }
        }
      
        // --- 2. Context Calculation ---
        var $is_wc {
          value = false
        }
      
        var $now_date {
          value = now|format_timestamp:"Y-m-d":"UTC"
        }
      
        conditional {
          if (($now_date >= "2026-06-14") && ($now_date <= "2026-07-19")) {
            var.update $is_wc {
              value = true
            }
          }
        }
      
        var $nearest_match_id {
          value = null
        }
      
        db.query worldcup_matches {
          where = $db.worldcup_matches.is_houston_match == true
          sort = {match_date: "asc"}
          return = {type: "list", paging: {page: 1, per_page: 10}}
        } as $matches_result
      
        foreach ($matches_result.items) {
          each as $um {
            var $m_date {
              value = $um|get:"match_date":""
            }
          
            var $m_time {
              value = $um|get:"kickoff_time_local":"00:00"
            }
          
            conditional {
              if ($m_date != "" && $nearest_match_id == null) {
                var $match_ms {
                  value = ((($m_date ~ "T") ~ ($m_time|to_text)) ~ ":00")|to_timestamp|to_ms
                }
              
                var $diff_ms {
                  value = (($match_ms - (now|to_ms))|abs)
                }
              
                conditional {
                  if ($diff_ms <= 86400000) {
                    var.update $nearest_match_id {
                      value = $um.id
                    }
                  }
                }
              }
            }
          }
        }
      
        // --- 3. Atomic Session Management ---
        db.query genie_temp_sessions {
          where = $db.genie_temp_sessions.session_token == $v_session_token
          return = {type: "single"}
        } as $session_rec
      
        var $final_session_id {
          value = 0
        }
      
        conditional {
          if ($session_rec == null) {
            db.add genie_temp_sessions {
              enforce_hidden_fields = false
              data = {
                session_token            : $v_session_token
                preferences_json         : {}
                conversation_history_json: []
                is_worldcup_window       : $is_wc
                nearest_match_id         : $nearest_match_id
                created_at               : now
              }
            } as $new_s
          
            var.update $final_session_id {
              value = $new_s.id
            }
          }
        
          else {
            db.edit genie_temp_sessions {
              field_name = "id"
              field_value = $session_rec.id
              enforce_hidden_fields = false
              data = {
                is_worldcup_window: $is_wc
                nearest_match_id  : $nearest_match_id
              }
            } as $up_s
          
            var.update $final_session_id {
              value = $session_rec.id
            }
          }
        }
      
        // --- 4. Run the V2 message handler ---
        function.run "genie/fn_genie_handle_message_v2_dev" {
          input = {
            message             : $input.message
            channel             : $input.channel
            external_user_id    : $input.external_user_id
            user_name           : $input.user_name
            city_context        : $input.city_context
            session_token       : $v_session_token
            lat                 : $input.lat
            lng                 : $input.lng
            radius_meters       : $input.radius_meters
            location_label      : $input.location_label
            session_query_number: $input.session_query_number
            session_id          : $final_session_id|to_text
          }
        } as $genie_response
      
        debug.log {
          value = {
            checkpoint    : "ENDPOINT_RECEIVED_GENIE_RESPONSE"
            genie_response: $genie_response
          }
        }
      
        // --- 5. Assemble final response ---
        // Extract each field into its own variable first (one small
        // expression per statement) instead of evaluating many chained
        // |get calls against $genie_response inside a single large
        // backtick literal block.
        var $r_reply {
          value = $genie_response|get:"reply":""
        }
      
        var $r_use_xano {
          value = $genie_response|get:"use_xano":false
        }
      
        var $r_reply_mode {
          value = $genie_response|get:"reply_mode":""
        }
      
        var $r_venues {
          value = $genie_response|get:"venues":[]
        }
      
        var $r_more_nearby_venues {
          value = $genie_response|get:"more_nearby_venues":[]
        }
      
        var $r_events {
          value = $genie_response|get:"events":[]
        }
      
        var $r_query_mode {
          value = $genie_response|get:"query_mode":"venue"
        }
      
        var $r_needs_location {
          value = $genie_response|get:"needs_location":false
        }
      
        var $r_filters {
          value = $genie_response|get:"filters":{}
        }
      
        var $r_show_intake_prompt {
          value = $genie_response|get:"show_intake_prompt":false
        }
      
        var $r_intake_prompt_copy {
          value = $genie_response|get:"intake_prompt_copy":""
        }
      
        var $r_weather_context_text {
          value = $genie_response|get:"weather_context_text":""
        }
      
        var $r_should_avoid_outdoor {
          value = $genie_response|get:"should_avoid_outdoor":false
        }
      
        var $r_should_promote_outdoor {
          value = $genie_response
            |get:"should_promote_outdoor":false
        }
      
        var $r_neighborhood_context {
          value = $genie_response|get:"neighborhood_context":null
        }
      
        var $r_is_outdoor_sensitive {
          value = $genie_response|get:"is_outdoor_sensitive":false
        }
      
        var $r_detected_neighborhood {
          value = $genie_response|get:"detected_neighborhood":""
        }
      
        var $r_pick_reasons {
          value = $genie_response|get:"pick_reasons":[]
        }
      
        var $r_llm {
          value = $genie_response|get:"llm":null
        }
      
        debug.log {
          value = {
            checkpoint                : "ENDPOINT_AFTER_FIELD_EXTRACTION"
            r_reply                   : $r_reply
            r_reply_mode              : $r_reply_mode
            r_use_xano                : $r_use_xano
            r_query_mode              : $r_query_mode
            r_venues_count            : $r_venues|count
            r_more_nearby_venues_count: $r_more_nearby_venues|count
            r_filters                 : $r_filters
            r_intake_prompt_copy      : $r_intake_prompt_copy
          }
        }
      
        var.update $final_result {
          value = {
            success               : true
            reply                 : $r_reply
            use_xano              : $r_use_xano
            reply_mode            : $r_reply_mode
            venues                : $r_venues
            more_nearby_venues    : $r_more_nearby_venues
            events                : $r_events
            query_mode            : $r_query_mode
            needs_location        : $r_needs_location
            filters               : $r_filters
            show_intake_prompt    : $r_show_intake_prompt
            intake_prompt_copy    : $r_intake_prompt_copy
            weather_context_text  : $r_weather_context_text
            should_avoid_outdoor  : $r_should_avoid_outdoor
            should_promote_outdoor: $r_should_promote_outdoor
            neighborhood_context  : $r_neighborhood_context
            is_outdoor_sensitive  : $r_is_outdoor_sensitive
            detected_neighborhood : $r_detected_neighborhood
            pick_reasons          : $r_pick_reasons
            llm                   : $r_llm
            session_id            : $final_session_id
            session_token         : $v_session_token
          }
        }
      }
    
      catch {
        var.update $final_result {
          value = {
            success   : false
            error     : "Genie request failed"
            error_type: "exception"
          }
        }
      
        debug.log {
          value = {checkpoint: "ENDPOINT_CAUGHT_ERROR", error: $error}
        }
      }
    }
  
    debug.log {
      value = {
        checkpoint  : "ENDPOINT_FINAL_RESULT"
        final_result: $final_result
      }
    }
  }

  response = $final_result
}