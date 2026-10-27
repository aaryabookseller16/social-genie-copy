// Runs one venue-picking model turn: prepares candidates and prompts, calls the model, validates picks, and orders venues.
// On failure, returns the original venue list and a failure reason so the caller can preserve its response.
// Conversation v1:
// - history ([{role, content}] from fn_genie_load_conversation_dev) goes between the system prompt
//   and the current user message, so the model sees the conversation.
// - prompt_type "pick" (new request, default) keeps the old contract: intro + exactly 3 picks,
//   composed into the numbered reply.
// - prompt_type "converse" (follow-up): venues and events already shown are the candidates,
//   the validator runs in "followup" mode (0-3 picks), the reply is the model's own text (not the numbered list), and no
//   candidates is fine (plain chat).
function "genie/fn_genie_run_turn_dev" {
  input {
    // The user's message for this turn
    text message
  
    // Ranked venue rows in display order (only their ids are used)
    json venues
  
    // Resolved city name (not the raw client string)
    text city?
  
    // Local date/time text and weather text for the prompt (both optional)
    text now_text?
  
    text weather_text?
  
    // How well the shortlist fits the request: strong | loose | empty | unknown
    text match_quality?
  
    // Model options (defaults: gpt-4o, 800 tokens, 30s)
    text model?
  
    int timeout?
    int max_tokens?
  
    // How many candidates the model sees (default 10)
    int max_candidates?
  
    // Prompt type for the shared prompt module: "pick" (default) or "converse"
    text prompt_type?
  
    // Conversation v1: earlier messages as chat messages [{role: "user"|"assistant", content}]
    json history?
  
    // Conversation v1: saved preferences as text
    text user_context?
  
    // Conversation v1: earlier requests with their numbered picks
    text conversation_text?
  
    // Conversation v1: which request the follow-up is most likely about, e.g. "2"
    text turn_note?
  
    // Conversation v1: genie_social_events rows the model may talk about (converse only)
    json event_rows?
  }

  stack {
    var $used {
      value = false
    }
  
    var $reply {
      value = null
    }
  
    var $pick_reasons {
      value = []
    }
  
    var $picked_ids {
      value = []
    }
  
    var $picked_event_ids {
      value = []
    }
  
    var $ordered_venues {
      value = $input.venues|safe_array
    }
  
    var $candidate_count {
      value = 0
    }
  
    var $fail_reason {
      value = null
    }
  
    var $latency_ms {
      value = 0
    }
  
    var $prompt_version {
      value = null
    }
  
    var $reason_flags {
      value = []
    }
  
    var $model {
      value = $input.model|first_notempty:"gpt-4o"
    }
  
    var $prompt_type {
      value = $input.prompt_type|first_notempty:"pick"
    }
  
    var $is_converse {
      value = $prompt_type == "converse"
    }
  
    var $validate_mode {
      value = $is_converse ? "followup" : "request"
    }
  
    // 1) Candidates
    var $candidates {
      value = []
    }
  
    conditional {
      if ((($input.venues|safe_array)|count) > 0) {
        function.run "genie/fn_genie_load_candidate_venues_dev" {
          input = {
            venues        : $input.venues
            max_candidates: $input.max_candidates
          }
        } as $loaded
      
        var.update $candidates {
          value = $loaded|get:"candidates":[]
        }
      
        var.update $fail_reason {
          value = $loaded|get:"fail_reason":null
        }
      }
    
      else {
        var.update $fail_reason {
          value = "no_candidates"
        }
      }
    }
  
    var $event_candidates {
      value = []
    }
  
    conditional {
      if ($is_converse) {
        foreach (($input.event_rows ?? [])|safe_array) {
          each as $erow {
            conditional {
              if ($erow != null && (($erow|get:"id":0)|to_int) > 0) {
                function.run "genie/fn_genie_format_event_for_model_dev" {
                  input = {event: $erow}
                } as $ev_formatted
              
                var.update $event_candidates {
                  value = $event_candidates|append:$ev_formatted
                }
              }
            }
          }
        }
      
        // A follow-up can be plain chat: no shown items is not a failure.
        var.update $fail_reason {
          value = null
        }
      }
    }
  
    var.update $candidate_count {
      value = ($candidates|count) + ($event_candidates|count)
    }
  
    // 2) Prompt
    var $prompt {
      value = null
    }
  
    conditional {
      if ($fail_reason == null) {
        function.run "genie/fn_genie_build_prompt_dev" {
          input = {
            prompt_type      : $prompt_type
            message          : $input.message
            candidates       : $candidates
            event_candidates : $event_candidates
            city             : $input.city
            now_text         : $input.now_text
            weather_text     : $input.weather_text
            match_quality    : $input.match_quality
            user_context     : $input.user_context
            conversation_text: $input.conversation_text
            turn_note        : $input.turn_note
          }
        } as $prompt
      
        var.update $prompt_version {
          value = $prompt|get:"prompt_version":null
        }
      
        var.update $fail_reason {
          value = $prompt|get:"fail_reason":null
        }
      }
    }
  
    // 3) Model request
    var $raw_reply {
      value = null
    }
  
    conditional {
      if ($fail_reason == null) {
        // Variables first: each message and the payload are built from plain references.
        var $sys_text {
          value = $prompt|get:"system_text":""
        }
      
        var $usr_text {
          value = $prompt|get:"user_text":""
        }
      
        var $sys_msg {
          value = {role: "system", content: $sys_text}
        }
      
        var $usr_msg {
          value = {role: "user", content: $usr_text}
        }
      
        // Conversation v1: system, then the earlier messages, then this turn.
        var $history_msgs {
          value = []
        }
      
        foreach (($input.history ?? [])|safe_array) {
          each as $hm {
            var $hm_role {
              value = ($hm|get:"role":"")|to_lower
            }
          
            var $hm_content {
              value = (($hm|get:"content":"") ?? "")|trim
            }
          
            conditional {
              if (($hm_role == "user" || $hm_role == "assistant") && $hm_content != "") {
                var $hm_msg {
                  value = {role: $hm_role, content: $hm_content}
                }
              
                array.push $history_msgs {
                  value = $hm_msg
                }
              }
            }
          }
        }
      
        var $messages {
          value = (([$sys_msg]|merge:$history_msgs)|merge:[$usr_msg])
        }
      
        var $ai_payload {
          value = {messages: $messages}
        }
      
        function.run "genie/fn_genie_call_ai_dev" {
          input = {
            ai_payload: $ai_payload
            model     : $model
            max_tokens: $input.max_tokens|first_notempty:800
            timeout   : $input.timeout|first_notempty:30
            json_mode : true
          }
        } as $ai_resp
      
        var.update $latency_ms {
          value = $ai_resp|get:"latency_ms":0
        }
      
        var.update $raw_reply {
          value = $ai_resp|get:"assistant_reply":null
        }
      
        conditional {
          if ($raw_reply == null || ($raw_reply|trim)|is_empty) {
            var.update $fail_reason {
              value = "ai_no_reply_status_" ~ (($ai_resp|get:"status_code":0)|to_text)
            }
          }
        }
      }
    }
  
    // 4) Validate the picks
    var $validation {
      value = null
    }
  
    conditional {
      if ($fail_reason == null) {
        function.run "genie/fn_genie_validate_picks_dev" {
          input = {
            raw_reply       : $raw_reply
            candidates      : $candidates
            event_candidates: $event_candidates
            mode            : $validate_mode
          }
        } as $validation
      
        var.update $fail_reason {
          value = $validation|get:"fail_reason":null
        }
      }
    }
  
    // 5) Reply text and venue order
    conditional {
      if ($fail_reason == null) {
        // A request gets the numbered reply; a follow-up keeps the model's own words.
        conditional {
          if ($is_converse) {
            var.update $reply {
              value = $validation.intro
            }
          }
        
          else {
            function.run "genie/fn_genie_compose_reply_dev" {
              input = {intro: $validation.intro, picks: $validation.picks}
            } as $composed
          
            var.update $reply {
              value = $composed
            }
          }
        }
      
        var.update $pick_reasons {
          value = $validation.picks
        }
      
        foreach ($validation.picks) {
          each as $pk {
            conditional {
              if (($pk|get:"kind":"venue") == "event") {
                var.update $picked_event_ids {
                  value = $picked_event_ids|append:$pk.event_id
                }
              }
            
              else {
                var.update $picked_ids {
                  value = $picked_ids|append:$pk.venue_id
                }
              }
            }
          }
        }
      
        function.run "genie/fn_genie_order_venues_dev" {
          input = {venues: $input.venues, picked_ids: $picked_ids}
        } as $ordered
      
        var.update $ordered_venues {
          value = $ordered
        }
      
        // Report-only check: phrases the prompt forbids. Never changes the reply.
        var $flag_terms {
          value = [
            "lacks"
            "though"
            "but it"
            "currently closed"
            "now closed"
            "opens later"
            "opens at"
            "does not have"
            "doesn't have"
          ]
        }
      
        foreach ($validation.picks) {
          each as $pk2 {
            var $pk2_id {
              value = ($pk2|get:"venue_id":0)|first_notempty:($pk2|get:"event_id":0)
            }
          
            var $pk2_reason {
              value = $pk2|get:"reason":""
            }
          
            foreach ($flag_terms) {
              each as $ft {
                conditional {
                  if ($pk2_reason|icontains:$ft) {
                    var $flag_row {
                      value = {venue_id: $pk2_id, term: $ft}
                    }
                  
                    array.push $reason_flags {
                      value = $flag_row
                    }
                  }
                }
              }
            }
          }
        }
      
        // Conversation v1: a follow-up reply is free text, so check it as a whole too.
        conditional {
          if ($is_converse) {
            foreach ($flag_terms) {
              each as $ft2 {
                conditional {
                  if (($reply ?? "")|icontains:$ft2) {
                    var $flag_row2 {
                      value = {venue_id: null, term: $ft2, where: "reply"}
                    }
                  
                    array.push $reason_flags {
                      value = $flag_row2
                    }
                  }
                }
              }
            }
          }
        }
      
        var.update $used {
          value = true
        }
      }
    }
  
    // On any failure, hand back the untouched input so the caller keeps its own output.
    conditional {
      if ($used == false) {
        var.update $reply {
          value = null
        }
      
        var.update $pick_reasons {
          value = []
        }
      
        var.update $picked_ids {
          value = []
        }
      
        var.update $picked_event_ids {
          value = []
        }
      
        var.update $ordered_venues {
          value = $input.venues|safe_array
        }
      
        var.update $reason_flags {
          value = []
        }
      }
    }
  
    debug.log {
      value = {
        checkpoint      : "GENIE_RUN_TURN"
        prompt_type     : $prompt_type
        used            : $used
        fail_reason     : $fail_reason
        model           : $model
        prompt_version  : $prompt_version
        latency_ms      : $latency_ms
        candidate_count : $candidate_count
        history_count   : (($input.history ?? [])|safe_array)|count
        picked_ids      : $picked_ids
        picked_event_ids: $picked_event_ids
        reason_flags    : $reason_flags
      }
    }
  }

  response = {
    used            : $used
    reply           : $reply
    pick_reasons    : $pick_reasons
    picked_ids      : $picked_ids
    picked_event_ids: $picked_event_ids
    venues          : $ordered_venues
    candidate_count : $candidate_count
    fail_reason     : $fail_reason
    model           : $model
    prompt_version  : $prompt_version
    latency_ms      : $latency_ms
    reason_flags    : $reason_flags
  }
}