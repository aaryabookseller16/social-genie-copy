// Learns a signed-in user's likes and dislikes from one chat session, in the background
// (2026-10-28). Run by the batch job (ep_learn_job_run_dev) for sessions with new user messages.
// - Owner: the verified genie_user with the same external_user_id as the session's user row
//   (same owner rule as fn_genie_apply_context_ops_dev). The chat lifecycle's identify_user
//   keys users by channel + external_user_id, so genie_session.user is usually a per-channel,
//   unverified row even for a signed-in user; the account is found by external_user_id.
//   Guests (no verified account with that id) are skipped; their messages are learned per message
//   by ep_learn_from_message_dev, because a session does not record the device. A session's
//   owner never changes, so a skipped session's marker is moved past its messages (otherwise
//   every run would pick it again).
// - Reads the session's genie_message rows after meta.learned_through_message_id, groups the
//   user messages into chunks of at most 6 (the extractor saves at most 5 updates per call) and
//   sends each chunk to fn_genie_extract_preferences_dev as one message, one line per user
//   message, with Genie's reply just before the chunk as previous_reply (for "the first one").
//   Earlier user messages are never resent, so an entry is not reinforced twice by one message.
// - Writes go through fn_genie_apply_context_ops_dev, like every other writer.
// - The marker moves after each chunk that succeeds, so a failed model call is retried by the
//   next run from that chunk on.
// - Claim: meta.learning_claim is written, then re-read after 1 s; only the run whose claim
//   survived goes on, so two overlapping runs do not learn the same messages twice.
// Never throws: errors are returned in fail_reason.
function "genie/fn_genie_learn_from_session_dev" {
  input {
    int session_id

    // Model override for the extractor (tests use a bad name to force a failure)
    text? model?
  }

  stack {
    var $status {
      value = "skipped"
    }

    var $reason {
      value = null
    }

    var $fail_reason {
      value = null
    }

    var $marker_from {
      value = 0
    }

    var $marker_to {
      value = 0
    }

    var $ops_total {
      value = 0
    }

    var $chunks_done {
      value = 0
    }

    var $chunk_count {
      value = 0
    }

    var $owner_id {
      value = 0
    }

    var $owner_account_id {
      value = 0
    }

    try_catch {
      try {
        db.get genie_session {
          field_name = "id"
          field_value = $input.session_id
        } as $session

        conditional {
          if ($session == null) {
            var.update $reason {
              value = "no_session"
            }
          }

          else {
            var.update $owner_id {
              value = ($session.user ?? 0)|to_int
            }

            var $owner {
              value = null
            }

            var $session_user_found {
              value = false
            }

            conditional {
              if ($owner_id > 0) {
                db.get genie_user {
                  field_name = "id"
                  field_value = $owner_id
                } as $session_user

                conditional {
                  if ($session_user != null) {
                    var.update $session_user_found {
                      value = true
                    }

                    var $session_ext {
                      value = ($session_user.external_user_id ?? "")|trim
                    }

                    conditional {
                      if ($session_ext != "" && $session_ext != "web_guest") {
                        db.query genie_user {
                          where = $db.genie_user.external_user_id == $session_ext && $db.genie_user.verified == true
                          return = {type: "single"}
                        } as $account

                        var.update $owner {
                          value = $account
                        }
                      }
                    }
                  }
                }
              }
            }

            conditional {
              if ($owner == null) {
                var.update $reason {
                  value = "not_verified"
                }

                conditional {
                  if ($session_user_found == false) {
                    var.update $reason {
                      value = "no_user"
                    }
                  }
                }

                // Skipped for good: move the marker past the session's messages.
                db.query genie_message {
                  where = $db.genie_message.session == $session.id
                  sort = {id: "desc"}
                  return = {type: "single"}
                } as $last_row

                api.lambda {
                  code = """
                    const m = $var.session && $var.session.meta;
                    const meta = (m && typeof m === "object" && !Array.isArray(m)) ? m : {};
                    const before = Number(meta.learned_through_message_id) || 0;
                    const last = ($var.last_row && Number($var.last_row.id)) || before;
                    return {meta: Object.assign({}, meta, {learned_through_message_id: Math.max(before, last)}), before, last: Math.max(before, last)};
                    """
                  timeout = 5
                } as $skip_meta

                var.update $marker_from {
                  value = ($skip_meta|get:"before") ?? 0
                }

                var.update $marker_to {
                  value = ($skip_meta|get:"last") ?? 0
                }

                var $skip_meta_value {
                  value = ($skip_meta|get:"meta") ?? {}
                }

                conditional {
                  if ($marker_to > $marker_from) {
                    db.edit genie_session {
                      field_name = "id"
                      field_value = $session.id
                      enforce_hidden_fields = false
                      data = {meta: $skip_meta_value}
                    } as $skip_write
                  }
                }
              }

              else {
                var.update $owner_account_id {
                  value = $owner.id
                }

                // Marker and claim from meta (meta may be null, a list or an object).
                api.lambda {
                  code = """
                    const m = $var.session && $var.session.meta;
                    const meta = (m && typeof m === "object" && !Array.isArray(m)) ? m : {};
                    const marker = Number(meta.learned_through_message_id) || 0;
                    return {meta, marker};
                    """
                  timeout = 5
                } as $meta_info

                var $meta {
                  value = ($meta_info|get:"meta") ?? {}
                }

                var.update $marker_from {
                  value = ($meta_info|get:"marker") ?? 0
                }

                var.update $marker_to {
                  value = $marker_from
                }

                // Claim the session for this run.
                security.create_uuid as $claim

                var $claimed_meta {
                  value = $meta|set:"learning_claim":$claim
                }

                db.edit genie_session {
                  field_name = "id"
                  field_value = $session.id
                  enforce_hidden_fields = false
                  data = {meta: $claimed_meta}
                } as $claim_write

                util.sleep {
                  value = 1
                }

                db.get genie_session {
                  field_name = "id"
                  field_value = $session.id
                } as $session_check

                var $claim_now {
                  value = (($session_check.meta ?? {})|get:"learning_claim") ?? ""
                }

                conditional {
                  if ($claim_now != $claim) {
                    var.update $reason {
                      value = "claimed_by_other_run"
                    }
                  }

                  else {
                    db.query genie_message {
                      where = $db.genie_message.session == $session.id && $db.genie_message.id > $marker_from
                      sort = {id: "asc"}
                      return = {type: "list", paging: {page: 1, per_page: 200}}
                    } as $new_rows

                    db.query genie_message {
                      where = $db.genie_message.session == $session.id && $db.genie_message.id <= $marker_from && $db.genie_message.sender_type == "genie"
                      sort = {id: "desc"}
                      return = {type: "single"}
                    } as $genie_before

                    // Chunks of up to 6 user messages, each with the Genie reply just before it.
                    api.lambda {
                      code = """
                        const rows = ($var.new_rows && $var.new_rows.items) || [];
                        let lastGenie = ($var.genie_before && $var.genie_before.message_text) || "";
                        const chunks = [];
                        let cur = null;
                        let maxId = 0;
                        for (const r of rows) {
                          maxId = Math.max(maxId, Number(r.id) || 0);
                          const text = String(r.message_text || "").trim();
                          if (r.sender_type === "user") {
                            if (text === "") continue;
                            if (!cur || cur.lines.length >= 6) {
                              cur = {lines: [], previous: String(lastGenie).slice(0, 1500), last_id: 0};
                              chunks.push(cur);
                            }
                            cur.lines.push(text);
                            cur.last_id = Number(r.id);
                          } else if (r.sender_type === "genie") {
                            lastGenie = text;
                            cur = null;
                          }
                        }
                        // Genie replies after the last user message are covered by the last chunk.
                        if (chunks.length) chunks[chunks.length - 1].last_id = maxId;
                        return {
                          chunks: chunks.map((c) => ({message: c.lines.join("\n"), previous: c.previous, last_id: c.last_id, count: c.lines.length})),
                          max_id: maxId
                        };
                        """
                      timeout = 5
                    } as $plan

                    var $chunks {
                      value = ($plan|get:"chunks") ?? []
                    }

                    var $max_id {
                      value = ($plan|get:"max_id") ?? 0
                    }

                    var.update $chunk_count {
                      value = $chunks|count
                    }

                    // The owner's current preferences, so known entries are only reinforced
                    // and likes can flip to dislikes.
                    var $current_text {
                      value = ""
                    }

                    conditional {
                      if ($chunk_count > 0) {
                        function.run "genie/fn_genie_resolve_user_context_dev" {
                          input = {user_id: $owner.id, external_user_id: $owner.external_user_id, link: false}
                        } as $resolved

                        var $ctx_row {
                          value = ($resolved|get:"row") ?? null
                        }

                        conditional {
                          if ($ctx_row != null) {
                            function.run "genie/fn_genie_render_user_context_dev" {
                              input = {context: ($ctx_row|get:"context_json") ?? {}}
                            } as $rendered

                            var.update $current_text {
                              value = ($rendered|get:"text") ?? ""
                            }
                          }
                        }
                      }
                    }

                    var $failed {
                      value = false
                    }

                    foreach ($chunks) {
                      each as $chunk {
                        conditional {
                          if ($failed == false) {
                            function.run "genie/fn_genie_extract_preferences_dev" {
                              input = {
                                message       : $chunk.message
                                previous_reply: $chunk.previous
                                current       : $current_text
                                model         : $input.model
                              }
                            } as $extracted

                            var $x_fail {
                              value = ($extracted|get:"fail_reason") ?? ""
                            }

                            var $x_ops {
                              value = ($extracted|get:"ops") ?? []
                            }

                            conditional {
                              if ($x_fail == "no_model_reply" || $x_fail == "model_call_failed" || $x_fail == "bad_json") {
                                var.update $failed {
                                  value = true
                                }

                                var.update $fail_reason {
                                  value = $x_fail
                                }
                              }

                              else {
                                var $apply_error {
                                  value = null
                                }

                                conditional {
                                  if (($x_ops|count) > 0) {
                                    function.run "genie/fn_genie_apply_context_ops_dev" {
                                      input = {external_user_id: $owner.external_user_id, ops: $x_ops}
                                    } as $applied

                                    var.update $apply_error {
                                      value = ($applied|get:"error") ?? null
                                    }
                                  }
                                }

                                conditional {
                                  if ($apply_error != null) {
                                    var.update $failed {
                                      value = true
                                    }

                                    var.update $fail_reason {
                                      value = "apply_failed"
                                    }
                                  }

                                  else {
                                    var $x_count {
                                      value = $x_ops|count
                                    }

                                    math.add $ops_total {
                                      value = $x_count
                                    }

                                    math.add $chunks_done {
                                      value = 1
                                    }

                                    var.update $marker_to {
                                      value = $chunk.last_id
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }

                    // No user messages to learn from (only Genie rows): move past them.
                    conditional {
                      if ($chunk_count == 0 && $max_id > $marker_from) {
                        var.update $marker_to {
                          value = $max_id
                        }
                      }
                    }

                    var.update $status {
                      value = "done"
                    }

                    conditional {
                      if ($failed) {
                        var.update $status {
                          value = "partial"
                        }
                      }
                    }

                    // Save the marker and release the claim.
                    var $done_meta {
                      value = ($meta|set:"learned_through_message_id":$marker_to)|set:"learning_claim":""
                    }

                    db.edit genie_session {
                      field_name = "id"
                      field_value = $session.id
                      enforce_hidden_fields = false
                      data = {meta: $done_meta}
                    } as $done_write
                  }
                }
              }
            }
          }
        }
      }

      catch {
        var.update $status {
          value = "error"
        }

        var.update $fail_reason {
          value = $error.message
        }
      }
    }
  }

  response = {
    session_id : $input.session_id
    status     : $status
    reason     : $reason
    owner_id   : $owner_id
    account_id : $owner_account_id
    chunks     : $chunk_count
    chunks_done: $chunks_done
    ops        : $ops_total
    marker_from: $marker_from
    marker_to  : $marker_to
    fail_reason: $fail_reason
  }
}
