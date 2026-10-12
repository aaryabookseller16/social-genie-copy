// Ranked venue list (any row shape with an id) -> first N ids -> full rows from the DB ->
// model-safe objects. Returns the ids that actually loaded, in ranked order.
// =====================================================================================
function "genie/fn_genie_load_candidate_venues_dev" {
  input {
    // Ranked venue rows in display order. Only the id of each row is used.
    json venues

    // How many candidates to load (default 10)
    int max_candidates?
  }

  stack {
    var $max_n {
      value = $input.max_candidates|first_notempty:10
    }

    var $all_venues {
      value = $input.venues|safe_array
    }

    var $ids {
      value = []
    }

    foreach ($all_venues) {
      each as $v {
        conditional {
          if (($ids|count) < $max_n && $v != null && (($v|get:"id":0)|to_int) > 0) {
            var.update $ids {
              value = $ids|append:(($v|get:"id":0)|to_int)
            }
          }
        }
      }
    }

    var $candidates {
      value = []
    }

    var $candidate_ids {
      value = []
    }

    foreach ($ids) {
      each as $cid {
        db.get genie_venues {
          field_name = "id"
          field_value = $cid
        } as $row

        conditional {
          if ($row != null) {
            function.run "genie/fn_genie_format_venue_for_model_dev" {
              input = {venue: $row}
            } as $formatted

            var.update $candidates {
              value = $candidates|append:$formatted
            }

            var.update $candidate_ids {
              value = $candidate_ids|append:$cid
            }
          }
        }
      }
    }

    var $fail_reason {
      value = null
    }

    conditional {
      if (($candidates|count) == 0) {
        var.update $fail_reason {
          value = "no_candidates"
        }
      }
    }
  }

  response = {
    candidate_ids: $candidate_ids
    candidates   : $candidates
    fail_reason  : $fail_reason
  }
}