// One Genie model turn: candidates -> prompt -> model -> validate -> reply + ordered list.
// Contains no prompt text, no field lists and no parsing; it only sequences the steps and
// carries the failure reason. On any failure used=false and the caller keeps its existing
// reply and order.
//
// Future steps slot in here without rewriting it: user context (extra input to the prompt
// builder), the tool loop (between the model call and validation) and the shortlist cache
// (as the source of `venues`).
// =====================================================================================
function "genie/fn_genie_run_turn_dev" {
  input {
    // The user's message for this turn
    text message

    // Ranked venue rows in display order (only their ids are used)
    json venues

    text detected_language?
    text city?

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

    var $model {
      value = $input.model|first_notempty:"gpt-4o"
    }

    // 1) Candidates
    function.run "genie/fn_genie_load_candidate_venues_dev" {
      input = {venues: $input.venues, max_candidates: $input.max_candidates}
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
            prompt_type      : $input.prompt_type
            message          : $input.message
            candidates       : $candidates
            detected_language: $input.detected_language
            city             : $input.city
          }
        } as $prompt

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
        function.run "genie/fn_genie_call_ai_dev" {
          input = {
            ai_payload: {
              messages: [{role: "system", content: $prompt.system_text}, {role: "user", content: $prompt.user_text}]
            }
            model     : $model
            max_tokens: ($input.max_tokens|first_notempty:800)
            timeout   : ($input.timeout|first_notempty:30)
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
          input = {
            intro: $validation.intro
            picks: $validation.picks
          }
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
      }
    }

    debug.log {
      value = {
        checkpoint     : "GENIE_RUN_TURN"
        used           : $used
        fail_reason    : $fail_reason
        model          : $model
        latency_ms     : $latency_ms
        candidate_count: $candidate_count
        picked_ids     : $picked_ids
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
    latency_ms     : $latency_ms
  }
}