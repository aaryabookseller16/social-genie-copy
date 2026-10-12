// Applies preference changes to a user context document (GEN-010).
// ops: [{op: "add"|"remove", category, value, source?: "stated"|"inferred"|"connected_account", confidence?}]
// Rules:
//   - expected_version must match the stored version, otherwise the write is rejected as stale.
//   - Stated beats inferred: a non-stated add never changes a stated entry.
//   - Remove is a tombstone (status = user_removed). Only a stated add brings it back.
//   - community and music entries are sensitive.
// onboarding (optional) replaces context_json.onboarding.
function "genie/fn_genie_update_user_context_dev" {
  input {
    int? user_id?=0
    text? device_id? filters=trim
    int expected_version
    json? ops?
    json? onboarding?
  }

  stack {
    function.run "genie/fn_genie_get_user_context_dev" {
      input = {user_id: $input.user_id, device_id: $input.device_id}
    } as $row

    precondition ($row != null) {
      error_type = "notfound"
      error = "user context not found"
    }

    precondition ($row.version == $input.expected_version) {
      error_type = "inputerror"
      error = "stale_version: expected " ~ $input.expected_version ~ ", current " ~ $row.version
    }

    var $context {
      value = $row.context_json ?? {}
    }

    var $prefs {
      value = ($context|get:"preferences":[])|safe_array
    }

    var $applied {
      value = []
    }

    var $skipped {
      value = []
    }

    var $now_ts {
      value = now
    }

    var $sensitive_categories {
      value = ["community", "music"]
    }

    foreach (($input.ops ?? [])|safe_array) {
      each as $op {
        var $op_name {
          value = (($op|get:"op":"")|to_text)|trim|to_lower
        }

        var $category {
          value = (($op|get:"category":"")|to_text)|trim|to_lower
        }

        var $value {
          value = (($op|get:"value":"")|to_text)|trim
        }

        var $source {
          value = ((($op|get:"source") ?? "")|to_text)|trim|to_lower
        }

        conditional {
          if ($source == "") {
            var.update $source {
              value = "stated"
            }
          }
        }

        var $key {
          value = $category ~ ":" ~ ($value|to_lower)
        }

        conditional {
          if ($category == "" || $value == "" || ($op_name != "add" && $op_name != "remove")) {
            array.push $skipped {
              value = {key: $key, op: $op_name, reason: "invalid_op"}
            }

            continue
          }
        }

        var $confidence {
          value = 1
        }

        conditional {
          if ($source != "stated") {
            var.update $confidence {
              value = (($op|get:"confidence") ?? 0.5)|to_decimal
            }
          }
        }

        var $sensitivity {
          value = "standard"
        }

        conditional {
          if ($sensitive_categories|in:$category) {
            var.update $sensitivity {
              value = "sensitive"
            }
          }
        }

        var $existing_confidence {
          value = 0
        }

        array.find ($prefs) if ($this.id == $key) as $existing

        array.filter ($prefs) if ($this.id != $key) as $others

        var $entry {
          value = null
        }

        conditional {
          if ($op_name == "remove") {
            conditional {
              if ($existing != null) {
                var.update $entry {
                  value = $existing|set:"status":"user_removed"|set:"last_reinforced":$now_ts
                }
              }

              else {
                var.update $entry {
                  value = {
                    id             : $key
                    category       : $category
                    value          : $value
                    source         : "stated"
                    confidence     : 1
                    status         : "user_removed"
                    sensitivity    : $sensitivity
                    consent_ref    : null
                    evidence_count : 0
                    first_seen     : $now_ts
                    last_reinforced: $now_ts
                  }
                }
              }
            }
          }

          elseif ($existing == null) {
            var.update $entry {
              value = {
                id             : $key
                category       : $category
                value          : $value
                source         : $source
                confidence     : $confidence
                status         : "active"
                sensitivity    : $sensitivity
                consent_ref    : null
                evidence_count : 1
                first_seen     : $now_ts
                last_reinforced: $now_ts
              }
            }
          }

          elseif ($existing.status == "user_removed" && $source != "stated") {
            array.push $skipped {
              value = {key: $key, op: $op_name, reason: "tombstoned"}
            }
          }

          elseif ($existing.source == "stated" && $source != "stated") {
            array.push $skipped {
              value = {key: $key, op: $op_name, reason: "stated_wins"}
            }
          }

          else {
            var.update $existing_confidence {
              value = ($existing.confidence ?? 0)|to_decimal
            }

            conditional {
              if ($confidence < $existing_confidence) {
                var.update $confidence {
                  value = $existing_confidence
                }
              }
            }

            var $evidence_count {
              value = (($existing.evidence_count ?? 0)|to_int) + 1
            }

            var.update $entry {
              value = $existing
                |set:"source":$source
                |set:"confidence":$confidence
                |set:"status":"active"
                |set:"evidence_count":$evidence_count
                |set:"last_reinforced":$now_ts
            }
          }
        }

        conditional {
          if ($entry != null) {
            var.update $prefs {
              value = $others|append:$entry
            }

            array.push $applied {
              value = {key: $key, op: $op_name, status: $entry|get:"status"}
            }
          }
        }
      }
    }

    var.update $context {
      value = $context|set:"schema":1|set:"preferences":$prefs
    }

    conditional {
      if ($input.onboarding != null) {
        var.update $context {
          value = $context|set:"onboarding":$input.onboarding
        }
      }
    }

    db.edit genie_user_context {
      field_name = "id"
      field_value = $row.id
      data = {
        context_json: $context
        version     : $row.version + 1
        updated_at  : now
      }
    } as $updated
  }

  response = {
    context: $updated.context_json
    version: $updated.version
    applied: $applied
    skipped: $skipped
  }
}
