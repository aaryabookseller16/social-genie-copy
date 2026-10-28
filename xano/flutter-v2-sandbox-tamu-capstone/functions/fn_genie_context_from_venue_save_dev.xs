// A saved venue as a weak taste signal for the user context (2026-10-27). Same rules as the
// venue_save branch of track_signal (GEN-013): the venue's cuisine tags (unique, at most 3) as
// food and its price band as price, source inferred, confidence 0.4. Repeats only raise the
// evidence count; stated and removed preferences are never changed.
// Used by save_venue, which identifies people by genie_user id: only a verified account gets
// the signal (a guest save only has a chat session id, which is not tied to a device).
// Never throws; returns {skipped} or the apply result.
function "genie/fn_genie_context_from_venue_save_dev" {
  input {
    int venue_id
    int? user_id?=0
  }

  stack {
    var $result {
      value = {skipped: "no_user"}
    }

    try_catch {
      try {
        conditional {
          if (($input.user_id ?? 0) > 0) {
            db.get genie_user {
              field_name = "id"
              field_value = $input.user_id
            } as $owner

            conditional {
              if ($owner == null || $owner.verified != true) {
                var.update $result {
                  value = {skipped: "not_verified"}
                }
              }

              else {
                db.get genie_venues {
                  field_name = "id"
                  field_value = $input.venue_id
                } as $venue

                var $ops {
                  value = []
                }

                conditional {
                  if ($venue != null) {
                    var $tags_raw {
                      value = ($venue|get:"cuisine_tags") ?? []
                    }

                    var $tags {
                      value = []
                    }

                    conditional {
                      if ($tags_raw|is_array) {
                        var.update $tags {
                          value = (($tags_raw|filter:($$|is_text))|unique)|slice:0:3
                        }
                      }
                    }

                    foreach ($tags) {
                      each as $tag {
                        var $tag_value {
                          value = ($tag|replace:"_":" ")|trim
                        }

                        conditional {
                          if ($tag_value != "") {
                            array.push $ops {
                              value = {op: "add", category: "food", value: $tag_value, source: "inferred", confidence: 0.4}
                            }
                          }
                        }
                      }
                    }

                    var $price {
                      value = (($venue|get:"price_band") ?? "")|trim
                    }

                    conditional {
                      if ($price != "") {
                        array.push $ops {
                          value = {op: "add", category: "price", value: $price, source: "inferred", confidence: 0.4}
                        }
                      }
                    }
                  }
                }

                conditional {
                  if (($ops|count) > 0) {
                    function.run "genie/fn_genie_apply_context_ops_dev" {
                      input = {external_user_id: $owner.external_user_id, ops: $ops}
                    } as $applied

                    var.update $result {
                      value = $applied
                    }
                  }

                  else {
                    var.update $result {
                      value = {skipped: "no_venue_data"}
                    }
                  }
                }
              }
            }
          }
        }
      }

      catch {
        var.update $result {
          value = {error: "sync_failed"}
        }
      }
    }
  }

  response = $result
}
