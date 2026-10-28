// Learns the user's likes and dislikes from one chat message and saves them to their user
// context (GEN-014). Called by the web app after each chat reply (Next.js after()), so chat is
// never slowed down; the Flutter app can call it the same way. The model decides what, if
// anything, the message says about the user's tastes (fn_genie_extract_preferences_dev); the
// writes go through fn_genie_apply_context_ops_dev (verified account, otherwise the device).
// dry_run = true extracts without writing (for tests). No auth, like the other Genie guest
// endpoints.
// 2026-10-28 (batch learning): with session_token, a message from a verified user in a session
// that belongs to that same user (same external_user_id; sessions point at a per-channel
// genie_user row, so ids are not compared) is skipped (skipped: "batch_job"), because
// ep_learn_job_run_dev learns it from genie_message. Guests, and users who signed in during a
// guest-owned session, are still learned here right away. $batch_job_on must match the job's
// kill switch ($job_enabled in ep_learn_job_run_dev).
query "genie/ep_learn_from_message_dev" verb=POST {
  api_group = "genie_v15"

  input {
    text message
    text? previous_reply?
    text? external_user_id? filters=trim
    text? device_id? filters=trim
    bool? dry_run?=false

    // The chat's session token (optional; enables the batch_job skip above)
    text? session_token? filters=trim
  }

  stack {
    var $ext_id {
      value = ($input.external_user_id ?? "")|trim
    }

    var $dev_id {
      value = ($input.device_id ?? "")|trim
    }

    // Owner for reading, same rule as the writes: a verified account, otherwise the device.
    var $user_id {
      value = 0
    }

    conditional {
      if ($ext_id != "" && $ext_id != "web_guest") {
        // Verified rows only: the chat lifecycle adds an unverified per-channel row with the
        // same external_user_id, which must not hide the account (2026-10-28).
        db.query genie_user {
          where = $db.genie_user.external_user_id == $ext_id && $db.genie_user.verified == true
          return = {type: "single"}
        } as $owner_user

        conditional {
          if ($owner_user != null && $owner_user.verified == true) {
            var.update $user_id {
              value = $owner_user.id
            }
          }
        }
      }
    }

    // Batch learning: skip when the job will learn this message (see header). Off until the
    // GitHub Actions schedule (.github/workflows/learn-user-context.yml) is pushed; with it off,
    // every message is learned here as before (2026-10-28).
    var $batch_job_on {
      value = false
    }

    var $skip_reason {
      value = null
    }

    conditional {
      if ($batch_job_on && $user_id > 0 && ($input.session_token ?? "") != "") {
        db.query genie_session {
          where = $db.genie_session.session_token == $input.session_token
          return = {type: "single"}
        } as $chat_session

        conditional {
          if ($chat_session != null && ($chat_session.user ?? 0) > 0) {
            db.get genie_user {
              field_name = "id"
              field_value = $chat_session.user
            } as $session_user

            conditional {
              if ($session_user != null && ($session_user.external_user_id ?? "") == $ext_id) {
                var.update $skip_reason {
                  value = "batch_job"
                }
              }
            }
          }
        }
      }
    }

    var $current_text {
      value = ""
    }

    conditional {
      if ($skip_reason == null && ($user_id > 0 || $dev_id != "")) {
        function.run "genie/fn_genie_resolve_user_context_dev" {
          input = {user_id: $user_id, device_id: $dev_id, external_user_id: $ext_id, link: false}
        } as $resolved

        var $row {
          value = ($resolved|get:"row") ?? null
        }

        conditional {
          if ($row != null) {
            function.run "genie/fn_genie_render_user_context_dev" {
              input = {context: ($row|get:"context_json") ?? {}}
            } as $rendered

            var.update $current_text {
              value = ($rendered|get:"text") ?? ""
            }
          }
        }
      }
    }

    var $extracted {
      value = {}
    }

    conditional {
      if ($skip_reason == null) {
        function.run "genie/fn_genie_extract_preferences_dev" {
          input = {
            message       : $input.message
            previous_reply: $input.previous_reply
            current       : $current_text
          }
        } as $extracted_run

        var.update $extracted {
          value = $extracted_run
        }
      }
    }

    var $ops {
      value = ($extracted|get:"ops") ?? []
    }

    var $applied {
      value = null
    }

    conditional {
      if ($input.dry_run != true && ($ops|count) > 0 && ($user_id > 0 || $dev_id != "")) {
        function.run "genie/fn_genie_apply_context_ops_dev" {
          input = {
            external_user_id: $ext_id
            device_id       : $dev_id
            ops             : $ops
          }
        } as $applied
      }
    }
  }

  response = {
    saved      : $ops
    dropped    : ($extracted|get:"dropped") ?? []
    fail_reason: ($extracted|get:"fail_reason") ?? null
    applied    : $applied
    dry_run    : $input.dry_run == true
    skipped    : $skip_reason
  }
}
