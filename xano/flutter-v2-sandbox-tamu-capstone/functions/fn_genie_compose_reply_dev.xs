// Turns the intro and picks into the reply text.
// Intro + validated picks -> the plain-text reply the frontend shows.
// The reply format lives here only.
// =====================================================================================
function "genie/fn_genie_compose_reply_dev" {
  input {
    text intro?
  
    // Validated picks: [{venue_id, venue_name, reason}]
    json picks
  }

  stack {
    var $lines {
      value = []
    }
  
    conditional {
      if ((($input.intro|trim)|is_empty) == false) {
        var.update $lines {
          value = $lines|append:($input.intro|trim)
        }
      }
    }
  
    var $i {
      value = 0
    }
  
    foreach ($input.picks|safe_array) {
      each as $pk {
        var.update $i {
          value = $i + 1
        }
      
        var.update $lines {
          value = $lines
            |append:($i|to_text) ~ ". " ~ ($pk|get:"venue_name":"") ~ ": " ~ ($pk|get:"reason":"")
        }
      }
    }
  
    var $reply {
      value = $lines|join:"\n"
    }
  }

  response = $reply
}