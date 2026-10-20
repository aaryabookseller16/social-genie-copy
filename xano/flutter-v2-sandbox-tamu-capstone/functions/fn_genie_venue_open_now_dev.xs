// Works out, for a list of venues, whether each one is open right now and what today's hours are.
// The stored is_open_now column is a stale snapshot (true for about 74% of venues at any hour),
// so it is never used. This reads hours_json (Google opening periods) against the current
// Central time. Houston only for now.
//
// Input items: [{id, hours_json}]. Output: [{id, open_now, today_hours}] in the same order.
// open_now is true, false, or null when the venue has no hours on file (unknown, not closed).
// A single open period with no close time means open around the clock.
// =====================================================================================
function "genie/fn_genie_venue_open_now_dev" {
  input {
    json items
  }

  stack {
    // Central time right now. Day 0 is Sunday, the same numbering Google uses for periods.
    var $dow {
      value = (now|format_timestamp:"w":"America/Chicago")|to_int
    }
  
    var $hour {
      value = (now|format_timestamp:"G":"America/Chicago")|to_int
    }
  
    var $minute {
      value = (now|format_timestamp:"i":"America/Chicago")|to_int
    }
  
    // Minutes since Sunday 00:00, and the same moment one week later to catch hours that wrap.
    var $now_week_min {
      value = ($dow * 1440) + ($hour * 60) + $minute
    }
  
    var $now_week_min_next {
      value = $now_week_min + 10080
    }
  
    // weekday_text starts on Monday, so Sunday (0) maps to index 6.
    var $wk_idx {
      value = ($dow + 6)|modulus:7
    }
  
    var $out {
      value = []
    }
  
    foreach ($input.items|safe_array) {
      each as $it {
        var $hj {
          value = $it|get:"hours_json":null
        }
      
        var $periods {
          value = []
        }
      
        var $weekday_text {
          value = []
        }
      
        conditional {
          if ($hj != null) {
            var.update $periods {
              value = ($hj|get:"periods":[])|safe_array
            }
          
            var.update $weekday_text {
              value = ($hj|get:"weekday_text":[])|safe_array
            }
          }
        }
      
        var $open_now {
          value = null
        }
      
        var $today {
          value = null
        }
      
        conditional {
          if (($periods|count) > 0) {
            var.update $open_now {
              value = false
            }
          
            foreach ($periods) {
              each as $p {
                var $close_obj {
                  value = $p|get:"close":null
                }
              
                conditional {
                  if ($close_obj == null) {
                    var.update $open_now {
                      value = true
                    }
                  }
                
                  else {
                    var $open_time {
                      value = ($p|get:"open":{})|get:"time":"0000"
                    }
                  
                    var $close_time {
                      value = $close_obj|get:"time":"0000"
                    }
                  
                    var $open_min {
                      value = (((($p|get:"open":{})|get:"day":0)|to_int) * 1440) + ((($open_time|substr:0:2)|to_int) * 60) + (($open_time|substr:2:2)|to_int)
                    }
                  
                    var $close_min {
                      value = ((($close_obj|get:"day":0)|to_int) * 1440) + ((($close_time|substr:0:2)|to_int) * 60) + (($close_time|substr:2:2)|to_int)
                    }
                  
                    // Closing at or before opening means the period runs into the next day.
                    conditional {
                      if ($close_min <= $open_min) {
                        var.update $close_min {
                          value = $close_min + 10080
                        }
                      }
                    }
                  
                    conditional {
                      if (($open_min <= $now_week_min && $now_week_min < $close_min) || ($open_min <= $now_week_min_next && $now_week_min_next < $close_min)) {
                        var.update $open_now {
                          value = true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      
        conditional {
          if (($weekday_text|count) > $wk_idx) {
            var.update $today {
              value = $weekday_text[$wk_idx]
            }
          }
        }
      
        array.push $out {
          value = {
            id         : $it|get:"id":0
            open_now   : $open_now
            today_hours: $today
          }
        }
      }
    }
  }

  response = $out
}
