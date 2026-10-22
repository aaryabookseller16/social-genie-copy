// V2 Genie chat endpoint. Replaces ep_external_genie_message_dev as the primary chat endpoint.
// Adds weather awareness, neighborhood routing, and ambient recommendations.
// Version: 1.6.0 (city resolution contract, device_id, real error responses)
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
  
    // Device ID from the web app; finds a guest's user context (GEN-013)
    text? device_id? filters=trim
  
    // Include diagnostic blocks and stage timings when explicitly requested
    bool debug?=false
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
            device_id           : $input.device_id
          }
        } as $genie_response
      
        // --- 5. Assemble final response ---
        var.update $final_result {
          value = {
            success               : true
            reply                 : $genie_response|get:"reply":""
            venues                : $genie_response|get:"venues":[]
            more_nearby_venues    : $genie_response|get:"more_nearby_venues":[]
            events                : $genie_response|get:"events":[]
            query_mode            : $genie_response|get:"query_mode":"venue"
            reply_mode            : $genie_response|get:"reply_mode":""
            use_xano              : $genie_response|get:"use_xano":false
            needs_location        : $genie_response|get:"needs_location":false
            filters               : $genie_response|get:"filters":{}
            pick_reasons          : $genie_response|get:"pick_reasons":[]
            show_intake_prompt    : $genie_response|get:"show_intake_prompt":false
            intake_prompt_copy    : $genie_response|get:"intake_prompt_copy":""
            profile_strength_tier : $genie_response|get:"profile_strength_tier":null
            weather_context_text  : $genie_response|get:"weather_context_text":""
            should_avoid_outdoor  : $genie_response|get:"should_avoid_outdoor":false
            should_promote_outdoor: $genie_response|get:"should_promote_outdoor":false
            neighborhood_context  : $genie_response|get:"neighborhood_context":null
            is_outdoor_sensitive  : $genie_response|get:"is_outdoor_sensitive":false
            detected_neighborhood : $genie_response|get:"detected_neighborhood":""
            resolved_city         : $genie_response|get:"resolved_city":null
            city_source           : $genie_response|get:"city_source":"none"
            geo_used              : $genie_response|get:"geo_used":false
            location_status       : $genie_response|get:"location_status":"ok"
            supported_cities      : $genie_response|get:"supported_cities":[]
            unsupported_city      : $genie_response|get:"unsupported_city":""
            session_id            : $final_session_id
            session_token         : $v_session_token
          }
        }
      
        conditional {
          if ($input.debug == true) {
            var.update $final_result {
              value = $final_result
                |set:"search":($genie_response|get:"search":null)
                |set:"search_filters":($genie_response|get:"search_filters":null)
                |set:"city":($genie_response|get:"city":null)
                |set:"llm":($genie_response|get:"llm":null)
                |set:"context":($genie_response|get:"context":null)
                |set:"timings":($genie_response|get:"timings":{})
            }
          }
        }
      }
    
      catch {
        // Log the full error, then rethrow so the caller gets a real error
        // response instead of an HTTP 200 with success:false and a null message.
        debug.log {
          value = {checkpoint: "EP_GENIE_CHAT_V2_FAILED", error: $error}
        }
      
        throw {
          name = "GenieChatError"
          value = "Genie chat failed: " ~ ($error|json_encode)
        }
      }
    }
  }

  response = $final_result
}
