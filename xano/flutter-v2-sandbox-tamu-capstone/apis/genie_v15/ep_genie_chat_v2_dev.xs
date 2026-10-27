// V2 Genie chat endpoint. Replaces ep_external_genie_message_dev as the primary chat endpoint.
// Adds weather awareness, neighborhood routing, and ambient recommendations.
// Version: 1.7.0 (conversation v1: request vs follow-up turns in one conversation)
// Conversation v1: one session_token is one conversation. Send the token from the last reply to
// continue it; send new_conversation = true (or no token) to start a new one. turn_hint
// ("request" | "followup") lets the client force the turn kind (e.g. quick chips = request).
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
    bool debug?
  
    // Conversation v1: start a new conversation even if a session_token is sent
    bool new_conversation?
  
    // Conversation v1: optional turn kind hint, "request" | "followup"
    text? turn_hint? filters=trim
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
      
        // Conversation v1: a new conversation always gets a new token.
        conditional {
          if ($input.new_conversation) {
            var.update $v_session_token {
              value = ""
            }
          }
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
            turn_hint           : $input.turn_hint
          }
        } as $genie_response
      
        // --- 5. Assemble final response ---
        // Conversation v1: the handler already returns every field (with its own defaults), so the
        // response is the handler's object plus the endpoint's session fields. Built with |set and
        // |unpick on whole objects, not a ``` block of per-field |get defaults, which came back
        // null or dropped keys in testing.
        var $base_result {
          value = $genie_response ?? {}
        }
      
        var.update $final_result {
          value = (((($base_result|set:"success":true)|set:"session_id":$final_session_id)|set:"session_token":$v_session_token)|set:"conversation_id":$v_session_token)
        }
      
        // Diagnostic blocks only when debug is requested.
        conditional {
          if ($input.debug != true) {
            var.update $final_result {
              value = $final_result
                |unpick:["search", "search_filters", "city", "llm", "context", "timings", "turn", "debug", "genie_message_id"]
            }
          }
        }
      }
    
      catch {
        // Log the full error, then rethrow so the caller gets a real error
        // response instead of an HTTP 200 with success:false and a null message.
        debug.log {
          value = {
            checkpoint: "EP_GENIE_CHAT_V2_FAILED"
            error     : $error.message
          }
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