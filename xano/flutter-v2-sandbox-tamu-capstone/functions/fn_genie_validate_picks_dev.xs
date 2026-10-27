// Parses the model’s JSON and rejects unknown IDs or too few valid picks.
// Parses the model's JSON reply and keeps only valid picks.
// A venue_id (or event_id) that is not in the candidate lists is a hard failure (invented item).
// Too few valid picks is a failure. The caller falls back on any failure.
// Conversation v1:
// - mode: "request" (default) keeps the old rule: max_picks valid picks, or every candidate when
//   there are fewer. "followup" requires no picks (0-3 allowed), accepts an empty reason (a
//   follow-up pick only marks what the reply is about) and requires non-empty reply text.
//   A text mode is used instead of a nullable int, because Xano does not keep 0 apart from
//   "not sent" on an optional int input.
// - The text may come back as "intro" (pick prompt) or "reply" (converse prompt).
// - event_candidates: picks may name an event_id from this list. Each valid pick has
//   kind "venue" or "event".
// =====================================================================================
function "genie/fn_genie_validate_picks_dev" {
  input {
    // Raw text the model returned (expected: JSON object with intro or reply, and picks)
    text raw_reply
  
    // Model-safe candidates the model was given (each has venue_id and venue_name)
    json candidates
  
    // Conversation v1: model-safe events the model was given (each has event_id and event_name)
    json event_candidates?
  
    // Maximum number of picks to accept (default 3)
    int max_picks?
  
    // Conversation v1: "request" (default) or "followup" (see above)
    text? mode? filters=trim|lower
  }

  stack {
    var $max_picks {
      value = $input.max_picks|first_notempty:3
    }
  
    var $is_followup {
      value = ($input.mode ?? "") == "followup"
    }
  
    var $allow_empty_reason {
      value = $is_followup
    }
  
    var $cands {
      value = $input.candidates|safe_array
    }
  
    var $ev_cands {
      value = ($input.event_candidates ?? [])|safe_array
    }
  
    var $cand_ids {
      value = []
    }
  
    foreach ($cands) {
      each as $c {
        var.update $cand_ids {
          value = $cand_ids
            |append:(($c|get:"venue_id":0)|to_int)
        }
      }
    }
  
    var $ev_ids {
      value = []
    }
  
    foreach ($ev_cands) {
      each as $ec {
        var.update $ev_ids {
          value = $ev_ids
            |append:(($ec|get:"event_id":0)|to_int)
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
      value = (($parsed|get:"intro":"")|first_notempty:($parsed|get:"reply":""))|trim
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
  
    var $seen_event_ids {
      value = []
    }
  
    foreach ($model_picks) {
      each as $mp {
        var $mid {
          value = ($mp|get:"venue_id":0)|to_int
        }
      
        var $meid {
          value = ($mp|get:"event_id":0)|to_int
        }
      
        var $mreason {
          value = ($mp|get:"reason":"")|trim
        }
      
        var $reason_ok {
          value = $allow_empty_reason || (($mreason|is_empty) == false)
        }
      
        conditional {
          // Venue pick
          if ($mid > 0) {
            // A venue id outside the candidate list is a hard failure.
            conditional {
              if (($cand_ids|in:$mid) == false) {
                var.update $fail_reason {
                  value = "unknown_venue_id"
                }
              }
            }
          
            conditional {
              if (($cand_ids|in:$mid) && ($seen_ids|in:$mid) == false && $reason_ok && ($valid_picks|count) < $max_picks) {
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
                    |append:{kind: "venue", venue_id: $mid, venue_name: $mname, reason: $mreason}
                }
              
                var.update $seen_ids {
                  value = $seen_ids|append:$mid
                }
              }
            }
          }
        
          // Event pick
          elseif ($meid > 0) {
            conditional {
              if (($ev_ids|in:$meid) == false) {
                var.update $fail_reason {
                  value = "unknown_event_id"
                }
              }
            }
          
            conditional {
              if (($ev_ids|in:$meid) && ($seen_event_ids|in:$meid) == false && $reason_ok && ($valid_picks|count) < $max_picks) {
                var $ename {
                  value = ""
                }
              
                foreach ($ev_cands) {
                  each as $ecd {
                    conditional {
                      if ((($ecd|get:"event_id":0)|to_int) == $meid) {
                        var.update $ename {
                          value = $ecd|get:"event_name":""
                        }
                      }
                    }
                  }
                }
              
                var.update $valid_picks {
                  value = $valid_picks
                    |append:{kind: "event", event_id: $meid, event_name: $ename, reason: $mreason}
                }
              
                var.update $seen_event_ids {
                  value = $seen_event_ids|append:$meid
                }
              }
            }
          }
        
          // A pick with neither id: as before, an id of 0 is not in the candidates.
          else {
            var.update $fail_reason {
              value = "unknown_venue_id"
            }
          }
        }
      }
    }
  
    var $cand_total {
      value = ($cand_ids|count) + ($ev_ids|count)
    }
  
    var $need {
      value = ($cand_total < $max_picks) ? $cand_total : $max_picks
    }
  
    conditional {
      if ($is_followup) {
        var.update $need {
          value = 0
        }
      }
    }
  
    conditional {
      if ($fail_reason == null && ($valid_picks|count) < $need) {
        var.update $fail_reason {
          value = "too_few_valid_picks"
        }
      }
    }
  
    // A follow-up must still have something to say.
    conditional {
      if ($fail_reason == null && $is_followup && ($intro|is_empty)) {
        var.update $fail_reason {
          value = "empty_reply_text"
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
    valid         : $is_valid
    intro         : $intro
    picks         : $valid_picks
    fail_reason   : $fail_reason
    mode          : $is_followup ? "followup" : "request"
    required_picks: $need
  }
}