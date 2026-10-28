// Batch job: learns signed-in users' likes and dislikes from recent chat sessions (2026-10-28).
// Called every 10 minutes by .github/workflows/learn-user-context.yml (Xano runs scheduled
// tasks only on the live branch, so the schedule lives outside Xano), or on demand by tests.
// - Always works on the tamu_capstone datasource (db.set_datasource), whatever the caller sends.
// - Picks sessions with a user message newer than their meta.learned_through_message_id, from
//   the last lookback_hours (default 48), oldest pending first, at most cap (default 25) per run.
//   The rest wait for the next run.
// - Runs fn_genie_learn_from_session_dev for each inside a try_catch, so one bad session never
//   stops the run.
// - $job_enabled is the kill switch (set it to false here to stop learning); tests can pass
//   enabled = false to check it.
// Test inputs: session_ids (only these sessions), only_user_ids (pick only sessions owned by
// these genie_user ids, so tests never touch real users' chats), fail_session_id (that session
// gets a bad model name, to force a failure), dry_run (pick sessions, learn nothing).
query "genie/ep_learn_job_run_dev" verb=POST {
  api_group = "Genie_Dev"

  input {
    int? cap?=25
    int? lookback_hours?=48
    int[]? session_ids?
    int[]? only_user_ids?
    int? fail_session_id?=0
    bool? enabled?=true
    bool? dry_run?=false
  }

  stack {
    db.set_datasource {
      value = "tamu_capstone"
    }

    var $job_enabled {
      value = true
    }

    var $t_start {
      value = now|to_ms
    }

    var $picked {
      value = []
    }

    var $results {
      value = []
    }

    var $pending_total {
      value = 0
    }

    var $run_enabled {
      value = $job_enabled && ($input.enabled ?? true)
    }

    conditional {
      if ($run_enabled) {
        var $cap {
          value = ($input.cap ?? 25)|to_int
        }

        conditional {
          if ($cap < 1 || $cap > 100) {
            var.update $cap {
              value = 25
            }
          }
        }

        var $requested {
          value = $input.session_ids ?? []
        }

        conditional {
          if (($requested|count) > 0) {
            var.update $picked {
              value = $requested|slice:0:$cap
            }

            var.update $pending_total {
              value = $requested|count
            }
          }

          else {
            var $hours {
              value = ($input.lookback_hours ?? 48)|to_int
            }

            var $lookback_ms {
              value = $hours * 3600000
            }

            var $since_ms {
              value = (now|to_ms) - $lookback_ms
            }

            db.query genie_message {
              where = $db.genie_message.sender_type == "user" && $db.genie_message.created_at > $since_ms
              sort = {id: "asc"}
              return = {type: "list", paging: {page: 1, per_page: 5000}}
            } as $recent

            // Newest user message per session.
            api.lambda {
              code = """
                const items = ($var.recent && $var.recent.items) || [];
                const newest = {};
                for (const m of items) {
                  const s = Number(m.session) || 0;
                  if (!s) continue;
                  newest[s] = Math.max(newest[s] || 0, Number(m.id));
                }
                const ids = Object.keys(newest).map(Number);
                return {ids, newest, min_id: ids.length ? Math.min(...ids) : 0};
                """
              timeout = 5
            } as $grouped

            var $min_session {
              value = ($grouped|get:"min_id") ?? 0
            }

            var $sessions {
              value = []
            }

            conditional {
              if ($min_session > 0) {
                db.query genie_session {
                  where = $db.genie_session.id >= $min_session
                  sort = {id: "asc"}
                  return = {type: "list", paging: {page: 1, per_page: 2000}}
                } as $session_rows

                var.update $sessions {
                  value = $session_rows.items ?? []
                }
              }
            }

            // Pending = newest user message is past the session's marker. Oldest pending first.
            api.lambda {
              code = """
                const newest = ($var.grouped && $var.grouped.newest) || {};
                const only = ($input.only_user_ids || []).map(Number);
                const pending = [];
                for (const s of ($var.sessions || [])) {
                  const top = newest[s.id];
                  if (!top) continue;
                  if (only.length && !only.includes(Number(s.user))) continue;
                  const meta = (s.meta && typeof s.meta === "object" && !Array.isArray(s.meta)) ? s.meta : {};
                  const marker = Number(meta.learned_through_message_id) || 0;
                  if (top > marker) pending.push({id: s.id, marker});
                }
                pending.sort((a, b) => a.marker - b.marker || a.id - b.id);
                return {ids: pending.map((p) => p.id), total: pending.length};
                """
              timeout = 5
            } as $pending

            var $pending_ids {
              value = ($pending|get:"ids") ?? []
            }

            var.update $pending_total {
              value = ($pending|get:"total") ?? 0
            }

            var.update $picked {
              value = $pending_ids|slice:0:$cap
            }
          }
        }

        conditional {
          if ($input.dry_run != true) {
            foreach ($picked) {
              each as $sid {
                var $model_for {
                  value = ""
                }

                conditional {
                  if ($sid == ($input.fail_session_id ?? 0)) {
                    var.update $model_for {
                      value = "not-a-real-model"
                    }
                  }
                }

                try_catch {
                  try {
                    function.run "genie/fn_genie_learn_from_session_dev" {
                      input = {session_id: $sid, model: $model_for}
                    } as $one

                    array.push $results {
                      value = $one
                    }
                  }

                  catch {
                    var $err_row {
                      value = {session_id: $sid, status: "error", fail_reason: $error.message}
                    }

                    array.push $results {
                      value = $err_row
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    var $duration_ms {
      value = (now|to_ms) - $t_start
    }
  }

  response = {
    enabled      : $run_enabled
    pending_total: $pending_total
    picked       : $picked
    results      : $results
    duration_ms  : $duration_ms
  }
}
