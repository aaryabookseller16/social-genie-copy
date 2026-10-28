// Applies preference ops to the right user context (GEN-013). Used by the endpoints that write
// genie_user_social_profile or behavior signals, so genie_user_context stays the one source of
// preferences. Owner: the verified genie_user found by external_user_id (never "web_guest"),
// otherwise the device. Web guests also have a genie_user row, but it is unverified, so their
// writes go to the device row, the same rule the resolver uses for linking. Creates the context when missing and sends the ops in chunks of 40 (the per-call
// cap of fn_genie_update_user_context_dev). Never throws: a failure is returned in `error`, so
// callers are never blocked.
// profile_fields (optional): the social profile fields a save sent. The ops are then built by
// fn_genie_profile_diff_ops_dev against the owner's current context, and `ops` is ignored.
function "genie/fn_genie_apply_context_ops_dev" {
  input {
    text? external_user_id? filters=trim
    text? device_id? filters=trim

    // [{op: "add"|"remove", category, value, source?, confidence?}]
    json? ops?

    // Social profile fields as sent by a save (see above)
    json? profile_fields?
  }

  stack {
    var $ops {
      value = []
    }

    conditional {
      if ($input.ops|is_array) {
        var.update $ops {
          value = $input.ops
        }
      }
    }

    var $ext_id {
      value = ($input.external_user_id ?? "")|trim
    }

    var $dev_id {
      value = ($input.device_id ?? "")|trim
    }

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

    var $owner {
      value = "none"
    }

    conditional {
      if ($user_id > 0) {
        var.update $owner {
          value = "user"
        }
      }

      elseif ($dev_id != "") {
        var.update $owner {
          value = "device"
        }
      }
    }

    var $applied {
      value = 0
    }

    var $skipped {
      value = 0
    }

    var $version {
      value = 0
    }

    var $error {
      value = null
    }

    conditional {
      if ($owner != "none" && (($ops|count) > 0 || $input.profile_fields != null)) {
        try_catch {
          try {
            // A user's write never goes to a device row: only user_id is passed for users.
            var $c_device {
              value = ""
            }

            conditional {
              if ($owner == "device") {
                var.update $c_device {
                  value = $dev_id
                }
              }
            }

            function.run "genie/fn_genie_create_user_context_dev" {
              input = {user_id: $user_id, device_id: $c_device}
            } as $ctx_row

            var.update $version {
              value = $ctx_row.version
            }

            conditional {
              if ($input.profile_fields != null) {
                var $ctx_json {
                  value = ($ctx_row|get:"context_json") ?? {}
                }

                var $ctx_prefs {
                  value = ($ctx_json|get:"preferences") ?? []
                }

                function.run "genie/fn_genie_profile_diff_ops_dev" {
                  input = {after: $input.profile_fields, current: $ctx_prefs}
                } as $diff_ops

                var.update $ops {
                  value = $diff_ops ?? []
                }
              }
            }

            var $chunk {
              value = []
            }

            var $op_index {
              value = 0
            }

            var $op_total {
              value = $ops|count
            }

            foreach ($ops) {
              each as $op {
                array.push $chunk {
                  value = $op
                }

                math.add $op_index {
                  value = 1
                }

                conditional {
                  if (($chunk|count) == 40 || $op_index == $op_total) {
                    function.run "genie/fn_genie_update_user_context_dev" {
                      input = {
                        user_id         : $user_id
                        device_id       : $c_device
                        expected_version: $version
                        ops             : $chunk
                      }
                    } as $upd

                    var.update $version {
                      value = $upd.version
                    }

                    var $upd_applied {
                      value = ($upd|get:"applied") ?? []
                    }

                    var $upd_skipped {
                      value = ($upd|get:"skipped") ?? []
                    }

                    math.add $applied {
                      value = $upd_applied|count
                    }

                    math.add $skipped {
                      value = $upd_skipped|count
                    }

                    var.update $chunk {
                      value = []
                    }
                  }
                }
              }
            }
          }

          catch {
            var.update $error {
              value = "apply_failed"
            }
          }
        }
      }
    }
  }

  response = {
    owner  : $owner
    user_id: $user_id
    applied: $applied
    skipped: $skipped
    version: $version
    error  : $error
  }
}
