//  One Genie model turn: candidates -> prompt -> model -> validate -> reply + ordered list.
//  Contains no prompt text, no field lists and no parsing; it only sequences the steps and
//  carries the failure reason. On any failure used=false and the caller keeps its existing
//  reply and order.
// 
//  Future steps slot in here without rewriting it: user context (extra input to the prompt
//  builder), the tool loop (between the model call and validation) and the shortlist cache
//  (as the source of `venues`).
// 
//  Changes in this version (v2.1b):
//   1. The model request is built variables-first (message objects, messages list, payload),
//      the pattern that fixed the missing-key bugs in the helper, slim row and formatter.
//   2. reason_flags: after validation, each pick's reason is scanned for phrases the prompt
//      forbids (lacks, though, "but it", currently closed, opens later...). It only REPORTS
//      matches in the response and the debug log; it never changes the reply or fails the
//      turn. Use it to measure how often the model breaks the grounding rules.
//  The grounding rules themselves live in fn_genie_build_prompt_dev, not here.
//  =====================================================================================
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
  
    // Prompt type for the shared prompt module (default "pick")
    text prompt_type?
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
  
    // 1) Candidates
    function.run "genie/fn_genie_load_candidate_venues_dev" {
      input = {
        venues        : $input.venues
        max_candidates: $input.max_candidates
      }
    } as $loaded
  
    var $candidates {
      value = $loaded|get:"candidates":[]
    }
  
    var.update $candidate_count {
      value = $candidates|count
    }
  
    var.update $fail_reason {
      value = $loaded|get:"fail_reason":null
    }
  
    // 2) Prompt
    var $prompt {
      value = null
    }
  
    conditional {
      if ($fail_reason == null) {
        function.run "genie/fn_genie_build_prompt_dev" {
          input = {
            prompt_type  : $input.prompt_type
            message      : $input.message
            candidates   : $candidates
            city         : $input.city
            now_text     : $input.now_text
            weather_text : $input.weather_text
            match_quality: $input.match_quality
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
      
        var $messages {
          value = [$sys_msg, $usr_msg]
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
          input = {raw_reply: $raw_reply, candidates: $candidates}
        } as $validation
      
        var.update $fail_reason {
          value = $validation|get:"fail_reason":null
        }
      }
    }
  
    // 5) Reply text and venue order
    conditional {
      if ($fail_reason == null) {
        function.run "genie/fn_genie_compose_reply_dev" {
          input = {intro: $validation.intro, picks: $validation.picks}
        } as $composed
      
        var.update $reply {
          value = $composed
        }
      
        var.update $pick_reasons {
          value = $validation.picks
        }
      
        foreach ($validation.picks) {
          each as $pk {
            var.update $picked_ids {
              value = $picked_ids|append:$pk.venue_id
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
              value = $pk2|get:"venue_id":0
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
        checkpoint     : "GENIE_RUN_TURN"
        used           : $used
        fail_reason    : $fail_reason
        model          : $model
        prompt_version : $prompt_version
        latency_ms     : $latency_ms
        candidate_count: $candidate_count
        picked_ids     : $picked_ids
        reason_flags   : $reason_flags
      }
    }
  }

  response = {
    used           : $used
    reply          : $reply
    pick_reasons   : $pick_reasons
    picked_ids     : $picked_ids
    venues         : $ordered_venues
    candidate_count: $candidate_count
    fail_reason    : $fail_reason
    model          : $model
    prompt_version : $prompt_version
    latency_ms     : $latency_ms
    reason_flags   : $reason_flags
  }
}
