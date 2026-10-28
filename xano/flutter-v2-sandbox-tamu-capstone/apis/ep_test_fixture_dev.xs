// Test fixtures for the user context learning tests (xano/tests/learning, 2026-10-28).
// Capstone branch only. Always works on the tamu_capstone datasource (db.set_datasource), and
// only touches genie_user rows whose external_user_id starts with "test-learn-" and device
// contexts whose device_id starts with "test-learn-". Anything else is refused.
// Actions:
//   create_user  {external_user_id, verified}     -> adds a test genie_user (is_test_user true)
//   verify_user  {external_user_id}                -> sets verified = true (a "sign-in")
//   seed_context {external_user_id, ops}           -> writes ops through fn_genie_apply_context_ops_dev
//   seed_session {external_user_id, session_token, messages: [{sender, text}]}
//                                                  -> a genie_session with genie_message rows
//   session      {session_token}                   -> the session row (id, user, meta)
//   delete_user_only {external_user_id}           -> deletes only the genie_user row (its sessions
//                                                     stay, to test a session without an owner)
//   cleanup      {external_user_ids, device_ids, session_tokens}
//                                                  -> deletes those test users, their contexts,
//                                                     sessions and messages, the device contexts and
//                                                     the listed sessions (tokens must start with
//                                                     test-learn-)
query "genie/ep_test_fixture_dev" verb=POST {
  api_group = "Genie_Dev"

  input {
    text action filters=trim
    text? external_user_id? filters=trim
    bool? verified?=true
    json? ops?
    text? session_token? filters=trim
    json? messages?
    text[]? external_user_ids?
    text[]? device_ids?
    text[]? session_tokens?
  }

  stack {
    db.set_datasource {
      value = "tamu_capstone"
    }

    var $prefix {
      value = "test-learn-"
    }

    var $ext {
      value = ($input.external_user_id ?? "")|trim
    }

    var $ext_ok {
      value = ($ext|starts_with:$prefix)
    }

    var $out {
      value = {ok: false, error: "unknown_action"}
    }

    conditional {
      if ($input.action == "create_user") {
        precondition ($ext_ok) {
          error_type = "inputerror"
          error = "external_user_id must start with test-learn-"
        }

        db.add genie_user {
          enforce_hidden_fields = false
          data = {
            external_user_id: $ext
            verified        : ($input.verified ?? true)
            is_test_user    : true
            channel         : "test"
            status          : "active"
            display_name    : $ext
          }
        } as $new_user

        var.update $out {
          value = {ok: true, user_id: $new_user.id, external_user_id: $ext, verified: $new_user.verified}
        }
      }

      elseif ($input.action == "verify_user") {
        precondition ($ext_ok) {
          error_type = "inputerror"
          error = "external_user_id must start with test-learn-"
        }

        db.query genie_user {
          where = $db.genie_user.external_user_id == $ext
          return = {type: "single"}
        } as $vu

        precondition ($vu != null) {
          error_type = "notfound"
          error = "test user not found"
        }

        db.edit genie_user {
          field_name = "id"
          field_value = $vu.id
          enforce_hidden_fields = false
          data = {verified: true}
        } as $verified_user

        var.update $out {
          value = {ok: true, user_id: $vu.id, verified: true}
        }
      }

      elseif ($input.action == "seed_context") {
        precondition ($ext_ok) {
          error_type = "inputerror"
          error = "external_user_id must start with test-learn-"
        }

        function.run "genie/fn_genie_apply_context_ops_dev" {
          input = {external_user_id: $ext, ops: $input.ops ?? []}
        } as $seeded

        var.update $out {
          value = {ok: true, applied: $seeded}
        }
      }

      elseif ($input.action == "seed_session") {
        precondition ($ext_ok) {
          error_type = "inputerror"
          error = "external_user_id must start with test-learn-"
        }

        db.query genie_user {
          where = $db.genie_user.external_user_id == $ext
          return = {type: "single"}
        } as $su

        precondition ($su != null) {
          error_type = "notfound"
          error = "test user not found"
        }

        db.add genie_session {
          enforce_hidden_fields = false
          data = {
            user            : $su.id
            session_token   : $input.session_token
            channel         : "test"
            external_user_id: $ext
            start_time      : now
            last_active_at  : now
            meta            : {}
          }
        } as $new_session

        var $message_ids {
          value = []
        }

        foreach (($input.messages ?? [])|safe_array) {
          each as $m {
            conditional {
              if ($m != null) {
                db.add genie_message {
                  enforce_hidden_fields = false
                  data = {
                    session           : $new_session.id
                    sender_type       : ($m|get:"sender") ?? "user"
                    message_text      : ($m|get:"text") ?? ""
                    raw_payload       : {}
                    is_visible_to_user: true
                  }
                } as $new_message

                array.push $message_ids {
                  value = $new_message.id
                }
              }
            }
          }
        }

        var.update $out {
          value = {ok: true, session_id: $new_session.id, message_ids: $message_ids}
        }
      }

      elseif ($input.action == "delete_user_only") {
        precondition ($ext_ok) {
          error_type = "inputerror"
          error = "external_user_id must start with test-learn-"
        }

        db.query genie_user {
          where = $db.genie_user.external_user_id == $ext
          return = {type: "single"}
        } as $du

        var $du_deleted {
          value = false
        }

        conditional {
          if ($du != null) {
            db.del genie_user {
              field_name = "id"
              field_value = $du.id
            }

            var.update $du_deleted {
              value = true
            }
          }
        }

        var.update $out {
          value = {ok: true, deleted: $du_deleted}
        }
      }

      elseif ($input.action == "session") {
        db.query genie_session {
          where = $db.genie_session.session_token == $input.session_token
          return = {type: "single"}
        } as $srow

        var $srow_out {
          value = null
        }

        conditional {
          if ($srow != null) {
            var.update $srow_out {
              value = {id: $srow.id, user: $srow.user, meta: $srow.meta}
            }
          }
        }

        var.update $out {
          value = {ok: true, session: $srow_out}
        }
      }

      elseif ($input.action == "cleanup") {
        var $n_users {
          value = 0
        }

        var $n_contexts {
          value = 0
        }

        var $n_sessions {
          value = 0
        }

        var $n_messages {
          value = 0
        }

        var $n_devices {
          value = 0
        }

        foreach (($input.external_user_ids ?? [])) {
          each as $cx {
            conditional {
              if (($cx|starts_with:$prefix)) {
                db.query genie_user {
                  where = $db.genie_user.external_user_id == $cx
                  return = {type: "list"}
                } as $cu_list

                foreach ($cu_list) {
                  each as $cu {
                    db.query genie_user_context {
                      where = $db.genie_user_context.genie_user_id == $cu.id
                      return = {type: "list"}
                    } as $cu_ctx

                    foreach ($cu_ctx) {
                      each as $c1 {
                        db.del genie_user_context {
                          field_name = "id"
                          field_value = $c1.id
                        }

                        math.add $n_contexts {
                          value = 1
                        }
                      }
                    }

                    db.query genie_session {
                      where = $db.genie_session.user == $cu.id
                      return = {type: "list"}
                    } as $cu_sessions

                    foreach ($cu_sessions) {
                      each as $s1 {
                        db.query genie_message {
                          where = $db.genie_message.session == $s1.id
                          return = {type: "list"}
                        } as $s1_msgs

                        foreach ($s1_msgs) {
                          each as $m1 {
                            db.del genie_message {
                              field_name = "id"
                              field_value = $m1.id
                            }

                            math.add $n_messages {
                              value = 1
                            }
                          }
                        }

                        db.del genie_session {
                          field_name = "id"
                          field_value = $s1.id
                        }

                        math.add $n_sessions {
                          value = 1
                        }
                      }
                    }

                    db.del genie_user {
                      field_name = "id"
                      field_value = $cu.id
                    }

                    math.add $n_users {
                      value = 1
                    }
                  }
                }
              }
            }
          }
        }

        foreach (($input.device_ids ?? [])) {
          each as $dx {
            conditional {
              if (($dx|starts_with:$prefix)) {
                db.query genie_user_context {
                  where = $db.genie_user_context.device_id == $dx
                  return = {type: "list"}
                } as $dx_ctx

                foreach ($dx_ctx) {
                  each as $c2 {
                    db.del genie_user_context {
                      field_name = "id"
                      field_value = $c2.id
                    }

                    math.add $n_devices {
                      value = 1
                    }
                  }
                }
              }
            }
          }
        }

        foreach (($input.session_tokens ?? [])) {
          each as $tx {
            conditional {
              if (($tx|starts_with:$prefix)) {
                db.query genie_session {
                  where = $db.genie_session.session_token == $tx
                  return = {type: "list"}
                } as $tx_sessions

                foreach ($tx_sessions) {
                  each as $s2 {
                    db.query genie_message {
                      where = $db.genie_message.session == $s2.id
                      return = {type: "list"}
                    } as $s2_msgs

                    foreach ($s2_msgs) {
                      each as $m2 {
                        db.del genie_message {
                          field_name = "id"
                          field_value = $m2.id
                        }

                        math.add $n_messages {
                          value = 1
                        }
                      }
                    }

                    db.del genie_session {
                      field_name = "id"
                      field_value = $s2.id
                    }

                    math.add $n_sessions {
                      value = 1
                    }
                  }
                }
              }
            }
          }
        }

        var.update $out {
          value = {ok: true, users: $n_users, contexts: $n_contexts, sessions: $n_sessions, messages: $n_messages, device_contexts: $n_devices}
        }
      }
    }
  }

  response = $out
}
