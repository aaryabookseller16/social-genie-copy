// Puts the picked venues first (in pick order) and keeps every other row after them in
// its original order. Row shape is untouched, so the frontend contract does not change.
// Reusable for follow-ups ("show me more", "not those three").
// =====================================================================================
function "genie/fn_genie_order_venues_dev" {
  input {
    // Venue rows in the current display order (any shape with an id)
    json venues

    // Venue ids to move to the front, in order
    json picked_ids
  }

  stack {
    var $all_venues {
      value = $input.venues|safe_array
    }

    var $pids {
      value = $input.picked_ids|safe_array
    }

    var $ordered {
      value = []
    }

    foreach ($pids) {
      each as $pid {
        foreach ($all_venues) {
          each as $rv {
            conditional {
              if ((($rv|get:"id":0)|to_int) == (($pid)|to_int)) {
                var.update $ordered {
                  value = $ordered|append:$rv
                }
              }
            }
          }
        }
      }
    }

    foreach ($all_venues) {
      each as $rv2 {
        conditional {
          if (($pids|in:(($rv2|get:"id":0)|to_int)) == false) {
            var.update $ordered {
              value = $ordered|append:$rv2
            }
          }
        }
      }
    }
  }

  response = $ordered
}