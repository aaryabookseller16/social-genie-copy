// Finds the user context for a chat turn and, when link is true, connects a guest's
// device context to their account (GEN-013).
//   - external_user_id "web_guest" is a shared fallback id, so it never resolves by user.
//   - User row and device row both exist: the device row's live stated entries are merged
//     into the user row (at most 40) and the device row is marked "merged".
//   - Only a device row exists and the user is verified: the device row is claimed
//     (genie_user_id set). Unverified users are not linked, because guests also get
//     genie_user rows and would strand the context when they sign in.
//   - No rows and the user is verified: an empty context is created (created = true).
// Returns {row, source: "user"|"device"|"none", linked, merged, created}.
// 2026-10-22 fix: the merge now carries each entry's sentiment. Before, a guest's dislikes
// arrived on the account as likes.
// 2026-10-27 fix: an unverified genie_user is ignored (treated as a guest), the same owner
// rule as fn_genie_apply_context_ops_dev.
function "genie/fn_genie_resolve_user_context_dev" {
  input {
    int? user_id?=0
    text? device_id? filters=trim
    text? external_user_id? filters=trim
    bool? link?=true
  }

  stack {
    var $user_id_eff {
      value = ($input.user_id ?? 0)|to_int
    }

    conditional {
      if (($input.external_user_id ?? "") == "web_guest") {
        var.update $user_id_eff {
          value = 0
        }
      }
    }

    // Only a verified account owns a context (2026-10-27). Web guests get an unverified
    // genie_user row on their first chat turn; treating it as an account split a guest's
    // preferences between that hidden row and the device row.
    conditional {
      if ($user_id_eff > 0) {
        db.get genie_user {
          field_name = "id"
          field_value = $user_id_eff
        } as $owner_check

        conditional {
          if ($owner_check == null || $owner_check.verified != true) {
            var.update $user_id_eff {
              value = 0
            }
          }
        }
      }
    }

    var $device_id_eff {
      value = ($input.device_id ?? "")|trim
    }

    var $link {
      value = $input.link ?? true
    }

    var $user_row {
      value = null
    }

    var $device_row {
      value = null
    }

    var $linked {
      value = false
    }

    var $merged {
      value = false
    }

    conditional {
      if ($user_id_eff > 0) {
        db.query genie_user_context {
          where = $db.genie_user_context.genie_user_id == $user_id_eff && $db.genie_user_context.status == "active"
          return = {type: "single"}
        } as $by_user

        var.update $user_row {
          value = $by_user
        }
      }
    }

    conditional {
      if ($device_id_eff != "") {
        db.query genie_user_context {
          where = $db.genie_user_context.device_id == $device_id_eff && $db.genie_user_context.genie_user_id == 0 && $db.genie_user_context.status == "active"
          return = {type: "single"}
        } as $by_device

        var.update $device_row {
          value = $by_device
        }
      }
    }

    // Both rows: merge the device's stated entries into the user row.
    conditional {
      if ($link && $user_row != null && $device_row != null) {
        var $device_prefs {
          value = []
        }

        conditional {
          if ((($device_row.context_json ?? {})|get:"preferences")|is_array) {
            var.update $device_prefs {
              value = $device_row.context_json|get:"preferences"
            }
          }
        }

        array.filter ($device_prefs) if ($this.source == "stated" && ($this.status == "active" || $this.status == "user_edited")) as $device_stated

        var $merge_ops {
          value = []
        }

        foreach (($device_stated|slice:0:40)) {
          each as $pref {
            // Keep the like/dislike (GEN-014); entries without one are likes. A guest's newer
            // statement flips an opposite one already on the account.
            var $pref_sentiment {
              value = ($pref|get:"sentiment") ?? "like"
            }

            array.push $merge_ops {
              value = {op: "add", category: $pref.category, value: $pref.value, source: "stated", sentiment: $pref_sentiment}
            }
          }
        }

        conditional {
          if (($merge_ops|count) > 0) {
            function.run "genie/fn_genie_update_user_context_dev" {
              input = {user_id: $user_id_eff, expected_version: $user_row.version, ops: $merge_ops}
            } as $merge_result
          }
        }

        db.edit genie_user_context {
          field_name = "id"
          field_value = $device_row.id
          data = {status: "merged", updated_at: now}
        } as $merged_device

        db.get genie_user_context {
          field_name = "id"
          field_value = $user_row.id
        } as $user_row_fresh

        var.update $user_row {
          value = $user_row_fresh
        }

        var.update $merged {
          value = true
        }
      }
    }

    // Only a device row: claim it for a verified user.
    conditional {
      if ($link && $user_row == null && $device_row != null && $user_id_eff > 0) {
        db.get genie_user {
          field_name = "id"
          field_value = $user_id_eff
        } as $user

        conditional {
          if ($user != null && $user.verified == true) {
            db.edit genie_user_context {
              field_name = "id"
              field_value = $device_row.id
              data = {genie_user_id: $user_id_eff, updated_at: now}
            } as $claimed

            var.update $user_row {
              value = $claimed
            }

            var.update $device_row {
              value = null
            }

            var.update $linked {
              value = true
            }
          }
        }
      }
    }

    // No rows at all: create the context for a verified user (create at sign-up, done
    // lazily on the first turn after sign-in).
    var $created {
      value = false
    }

    conditional {
      if ($link && $user_row == null && $device_row == null && $user_id_eff > 0) {
        db.get genie_user {
          field_name = "id"
          field_value = $user_id_eff
        } as $new_user

        conditional {
          if ($new_user != null && $new_user.verified == true) {
            function.run "genie/fn_genie_create_user_context_dev" {
              input = {user_id: $user_id_eff}
            } as $new_row

            var.update $user_row {
              value = $new_row
            }

            var.update $created {
              value = true
            }
          }
        }
      }
    }

    var $row {
      value = $user_row
    }

    var $source {
      value = "none"
    }

    conditional {
      if ($user_row != null) {
        var.update $source {
          value = "user"
        }
      }

      elseif ($device_row != null) {
        var.update $row {
          value = $device_row
        }

        var.update $source {
          value = "device"
        }
      }
    }
  }

  response = {
    row    : $row
    source : $source
    linked : $linked
    merged : $merged
    created: $created
  }
}
