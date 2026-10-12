// Parses the model's JSON reply and keeps only valid picks.
// A venue_id that is not in the candidate list is a hard failure (invented venue).
// Too few valid picks is a failure. The caller falls back on any failure.
// =====================================================================================
function "genie/fn_genie_validate_picks_dev" {
  input {
    // Raw text the model returned (expected: JSON object with intro and picks)
    text raw_reply

    // Model-safe candidates the model was given (each has venue_id and venue_name)
    json candidates

    // Maximum number of picks to accept (default 3)
    int max_picks?
  }

  stack {
    var $max_picks {
      value = $input.max_picks|first_notempty:3
    }

    var $cands {
      value = $input.candidates|safe_array
    }

    var $cand_ids {
      value = []
    }

    foreach ($cands) {
      each as $c {
        var.update $cand_ids {
          value = $cand_ids|append:(($c|get:"venue_id":0)|to_int)
        }
      }
    }

    var $fail_reason {
      value = null
    }

    var $parsed {
      value = null
    }

    conditional {
      if (($input.raw_reply|trim)|is_empty) {
        var.update $fail_reason {
          value = "empty_reply"
        }
      }
    }

    conditional {
      if ($fail_reason == null) {
        try_catch {
          try {
            var.update $parsed {
              value = $input.raw_reply|json_decode
            }
          }

          catch {
            var.update $fail_reason {
              value = "invalid_json"
            }
          }
        }
      }
    }

    var $intro {
      value = ($parsed|get:"intro":"")|trim
    }

    var $model_picks {
      value = ($parsed|get:"picks":[])|safe_array
    }

    var $valid_picks {
      value = []
    }

    var $seen_ids {
      value = []
    }

    foreach ($model_picks) {
      each as $mp {
        var $mid {
          value = ($mp|get:"venue_id":0)|to_int
        }

        var $mreason {
          value = ($mp|get:"reason":"")|trim
        }

        // A venue id outside the candidate list is a hard failure.
        conditional {
          if (($cand_ids|in:$mid) == false) {
            var.update $fail_reason {
              value = "unknown_venue_id"
            }
          }
        }

        conditional {
          if (($cand_ids|in:$mid) && ($seen_ids|in:$mid) == false && (($mreason|is_empty) == false) && ($valid_picks|count) < $max_picks) {
            var $mname {
              value = ""
            }

            foreach ($cands) {
              each as $cd {
                conditional {
                  if ((($cd|get:"venue_id":0)|to_int) == $mid) {
                    var.update $mname {
                      value = $cd|get:"venue_name":""
                    }
                  }
                }
              }
            }

            var.update $valid_picks {
              value = $valid_picks
                |append:{venue_id: $mid, venue_name: $mname, reason: $mreason}
            }

            var.update $seen_ids {
              value = $seen_ids|append:$mid
            }
          }
        }
      }
    }

    var $need {
      value = (($cand_ids|count) < $max_picks) ? ($cand_ids|count) : $max_picks
    }

    conditional {
      if ($fail_reason == null && ($valid_picks|count) < $need) {
        var.update $fail_reason {
          value = "too_few_valid_picks"
        }
      }
    }

    var $is_valid {
      value = ($fail_reason == null)
    }

    conditional {
      if ($is_valid == false) {
        var.update $valid_picks {
          value = []
        }
      }
    }
  }

  response = {
    valid      : $is_valid
    intro      : $intro
    picks      : $valid_picks
    fail_reason: $fail_reason
  }
}