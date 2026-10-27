// Applies preference changes to a user context document (GEN-010).
// ops: [{op: "add"|"remove", category, value, source?: "stated"|"inferred"|"connected_account", confidence?}]
// Rules:
//   - expected_version must match the stored version, otherwise the write is rejected as stale.
//   - Stated beats inferred: a non-stated add never changes a stated entry.
//   - Remove is a tombstone (status = user_removed). Only a stated add brings it back.
//   - community and music entries are sensitive.
//   - Caps (GEN-013): categories come from an allow-list, values are at most 40 characters,
//     at most 40 ops per call, caps enforced by fn_genie_enforce_context_caps_dev after each op,
//     and the stored document must stay under 32 KB (100 full entries is about 27 KB).
// onboarding (optional) replaces context_json.onboarding.
// GEN-014: add ops take an optional sentiment, "like" (default) or "dislike". The same
//   category:value can be either, not both: an add with the other sentiment flips the entry
//   (evidence restarts at 1). Stated still beats inferred, so an inferred op never flips a
//   stated entry. Entries written before GEN-014 have no sentiment and count as likes.
function "genie/fn_genie_update_user_context_dev" {
  input {
    int? user_id?=0
    text? device_id? filters=trim
    int expected_version
    json? ops?
    json? onboarding?
  }

  stack {
    // Caps (GEN-013). Change them here.
    var $max_ops {
      value = 40
    }
  
    var $max_value_chars {
      value = 40
    }
  
    var $max_per_category {
      value = 10
    }
  
    var $max_live {
      value = 60
    }
  
    var $max_tombstones {
      value = 40
    }
  
    var $max_context_bytes {
      value = 32768
    }
  
    var $allowed_categories {
      value = [
        "experience"
        "atmosphere"
        "food"
        "music"
        "community"
        "sports_team"
        "event"
        "occasion"
        "neighborhood"
        "price"
        "group_size"
        "typical_time"
      ]
    }
  
    precondition (((($input.ops ?? [])|safe_array)|count) <= $max_ops) {
      error_type = "inputerror"
      error = "too_many_ops: at most " ~ $max_ops ~ " per call"
    }
  
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
  
    var $evicted {
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
      
        var $sentiment {
          value = "like"
        }
      
        conditional {
          if (((($op|get:"sentiment") ?? "")|to_text|trim|to_lower) == "dislike") {
            var.update $sentiment {
              value = "dislike"
            }
          }
        }
      
        conditional {
          if ($category == "" || $value == "" || ($op_name != "add" && $op_name != "remove")) {
            array.push $skipped {
              value = {key: $key, op: $op_name, reason: "invalid_op"}
            }
          
            continue
          }
        }
      
        conditional {
          if (($allowed_categories|in:$category) == false) {
            array.push $skipped {
              value = {key: $key, op: $op_name, reason: "invalid_category"}
            }
          
            continue
          }
        }
      
        conditional {
          if (($value|strlen) > $max_value_chars) {
            array.push $skipped {
              value = {key: $key, op: $op_name, reason: "value_too_long"}
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
                  value = $existing
                    |set:"status":"user_removed"
                    |set:"last_reinforced":$now_ts
                }
              }
            
              else {
                var.update $entry {
                  value = ```
                    {
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
                    ```
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
                sentiment      : $sentiment
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
            var $prev_sentiment {
              value = ($existing|get:"sentiment") ?? "like"
            }
          
            var $flipped {
              value = $prev_sentiment != $sentiment
            }
          
            var.update $existing_confidence {
              value = ($existing.confidence ?? 0)|to_decimal
            }
          
            // Reinforcing keeps the higher confidence; a flip starts over with the new one.
            conditional {
              if ($flipped == false && $confidence < $existing_confidence) {
                var.update $confidence {
                  value = $existing_confidence
                }
              }
            }
          
            var $evidence_count {
              value = (($existing.evidence_count ?? 0)|to_int) + 1
            }
          
            conditional {
              if ($flipped) {
                var.update $evidence_count {
                  value = 1
                }
              }
            }
          
            var.update $entry {
              value = $existing
                |set:"source":$source
                |set:"confidence":$confidence
                |set:"status":"active"
                |set:"sentiment":$sentiment
                |set:"evidence_count":$evidence_count
                |set:"last_reinforced":$now_ts
            }
          }
        }
      
        conditional {
          if ($entry != null) {
            var $candidate_prefs {
              value = $others|append:$entry
            }
          
            function.run "genie/fn_genie_enforce_context_caps_dev" {
              input = {
                prefs           : $candidate_prefs
                key             : $key
                max_per_category: $max_per_category
                max_live        : $max_live
                max_tombstones  : $max_tombstones
              }
            } as $capped
          
            conditional {
              if ($capped.rejected) {
                array.push $skipped {
                  value = {key: $key, op: $op_name, reason: "cap_reached"}
                }
              }
            
              else {
                var.update $prefs {
                  value = $capped.prefs
                }
              
                var.update $evicted {
                  value = $evicted|merge:$capped.evicted
                }
              
                var $applied_status {
                  value = $entry|get:"status"
                }
              
                array.push $applied {
                  value = {
                    key      : $key
                    op       : $op_name
                    status   : $applied_status
                    sentiment: $sentiment
                  }
                }
              }
            }
          }
        }
      }
    }
  
    var.update $context {
      value = $context
        |set:"schema":1
        |set:"preferences":$prefs
    }
  
    conditional {
      if ($input.onboarding != null) {
        var.update $context {
          value = $context
            |set:"onboarding":$input.onboarding
        }
      }
    }
  
    precondition ((($context|json_encode)|strlen) <= $max_context_bytes) {
      error_type = "inputerror"
      error = "context_too_large: over " ~ $max_context_bytes ~ " bytes"
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
    evicted: $evicted
  }
}