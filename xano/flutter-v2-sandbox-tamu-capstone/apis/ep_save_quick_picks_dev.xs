// Saves the quick-pick onboarding result (GEN-012). Creates the user context if
// needed, adds the picked preferences as source = stated, records the
// onboarding status, and logs onboarding_completed / onboarding_skipped to
// genie_onboarding_question_log.
query "genie/ep_save_quick_picks_dev" verb=POST {
  api_group = "Genie_Dev"

  input {
    text? external_user_id? filters=trim
    text? device_id? filters=trim

    // completed or skipped
    text status filters=trim|lower

    // Card ids the user picked, for the log
    text[] card_ids?

    // [{category, value}] derived from the picked cards
    json? picks?
  }

  stack {
    precondition ($input.status == "completed" || $input.status == "skipped") {
      error_type = "inputerror"
      error = "status must be completed or skipped"
    }

    var $external_user_id_eff {
      value = ($input.external_user_id ?? "")|trim
    }

    var $device_id_eff {
      value = ($input.device_id ?? "")|trim
    }

    precondition ($external_user_id_eff != "" || $device_id_eff != "") {
      error_type = "inputerror"
      error = "external_user_id or device_id is required"
    }

    var $user_id {
      value = 0
    }

    conditional {
      if ($external_user_id_eff != "") {
        db.query genie_user {
          where = $db.genie_user.external_user_id == $external_user_id_eff
          return = {type: "single"}
        } as $user_row

        conditional {
          if ($user_row != null) {
            var.update $user_id {
              value = $user_row.id
            }
          }
        }
      }
    }

    function.run "genie/fn_genie_create_user_context_dev" {
      input = {user_id: $user_id, device_id: $device_id_eff}
    } as $row

    var $ops {
      value = []
    }

    conditional {
      if ($input.status == "completed") {
        foreach ((($input.picks ?? [])|safe_array)|slice:0:40) {
          each as $pick {
            var $pick_category {
              value = $pick|get:"category"
            }

            var $pick_value {
              value = $pick|get:"value"
            }

            array.push $ops {
              value = {op: "add", category: $pick_category, value: $pick_value, source: "stated"}
            }
          }
        }
      }
    }

    var $card_ids {
      value = ($input.card_ids ?? [])|safe_array
    }

    var $now_ts {
      value = now
    }

    var $onboarding {
      value = {status: $input.status, at: $now_ts, cards: $card_ids}
    }

    function.run "genie/fn_genie_update_user_context_dev" {
      input = {
        user_id         : $user_id
        device_id       : $device_id_eff
        expected_version: $row.version
        ops             : $ops
        onboarding      : $onboarding
      }
    } as $result

    var $trigger {
      value = "onboarding_" ~ $input.status
    }

    var $response_text {
      value = $card_ids|join:","
    }

    var $signal_written {
      value = ($result.applied|count) > 0
    }

    var $ignored {
      value = $input.status == "skipped"
    }

    db.add genie_onboarding_question_log {
      data = {
        user_id        : $user_id
        question_id    : "quick_pick_onboarding"
        question_text  : "Which of these sounds like a good night?"
        channel        : "chat"
        context_trigger: $trigger
        response       : $response_text
        response_at    : $now_ts
        signal_written : $signal_written
        ignored        : $ignored
      }
    } as $log_row

    function.run "genie/fn_genie_render_user_context_dev" {
      input = {context: $result.context}
    } as $rendered
  }

  response = {
    success   : true
    version   : $result.version
    onboarding: $onboarding
    applied   : $result.applied
    skipped   : $result.skipped
    rendered  : $rendered.text
  }
}
