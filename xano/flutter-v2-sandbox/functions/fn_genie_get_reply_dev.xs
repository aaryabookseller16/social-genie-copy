// Function: fn_genie_get_reply_dev
// Purpose: Returns a voice-optimized reply based on the detected intent and mode.
// Note: Hardcoded v2.0 strings for branch consistency and speed.
function "genie/fn_genie_get_reply_dev" {
  input {
    // The intent to look up
    text intent
  
    // The reply mode
    text reply_mode
  
    // The time context
    text time_context?
  }

  stack {
    var $intent_safe {
      value = $input.intent|first_notempty:"general"
    }
  
    var $reply_mode_safe {
      value = $input.reply_mode|first_notempty:"has_results"
    }
  
    var $time_context_safe {
      value = $input.time_context|first_notempty:"any"
    }
  
    var $reply_out {
      value = ""
    }
  
    var $rows {
      value = []
    }
  
    db.query genie_reply_bank {
      where = $db.genie_reply_bank.intent == $intent_safe && $db.genie_reply_bank.reply_mode == $reply_mode_safe && $db.genie_reply_bank.active == true
      sort = {id: "asc"}
      return = {type: "list"}
    } as $rows
  
    conditional {
      if (($rows|count) == 0) {
        db.query genie_reply_bank {
          where = $db.genie_reply_bank.intent == "general" && $db.genie_reply_bank.reply_mode == $reply_mode_safe && $db.genie_reply_bank.active == true
          sort = {id: "asc"}
          return = {type: "list"}
        } as $rows
      }
    }
  
    conditional {
      if (($rows|count) > 0) {
        var $row_count {
          value = $rows|count
        }
      
        security.random_number {
          min = 0
          max = $row_count - 1
        } as $random_index
      
        var $loop_index {
          value = 0
        }
      
        foreach ($rows) {
          each as $row {
            conditional {
              if ($loop_index == $random_index) {
                var.update $reply_out {
                  value = $row.reply_text
                }
              }
            }
          
            var.update $loop_index {
              value = $loop_index + 1
            }
          }
        }
      }
    }
  
    conditional {
      if ($reply_out == "") {
        var.update $reply_out {
          value = "Here's what I found for you."
        }
      }
    }
  }

  response = $reply_out
}
