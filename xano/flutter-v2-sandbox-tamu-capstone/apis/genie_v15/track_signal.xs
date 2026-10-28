// Logs a user behavior signal and updates their social profile signal count
// GEN-013 (2026-10-21): a venue_save also adds the saved venue's cuisines and price band to the
// user context as inferred preferences (fn_genie_apply_context_ops_dev). Reported in
// context_sync; it never fails the endpoint.
query "genie/track_signal" verb=POST {
  api_group = "genie_v15"

  input {
    text device_id
    text external_user_id?
    text signal_type
    text signal_value
    json category_tags?
    text city?
    text neighborhood?
    text session_id?
  }

  stack {
    // Derive time of day from current hour
    var $current_hour {
      value = now
        |format_timestamp:"H":"UTC"
        |to_int
    }

    var $time_of_day {
      value = "morning"
    }

    conditional {
      if ($current_hour >= 12 && $current_hour < 17) {
        var.update $time_of_day {
          value = "afternoon"
        }
      }

      elseif ($current_hour >= 17 && $current_hour < 22) {
        var.update $time_of_day {
          value = "evening"
        }
      }

      elseif ($current_hour >= 22 || $current_hour < 5) {
        var.update $time_of_day {
          value = "late_night"
        }
      }
    }

    // Derive day of week
    var $day_of_week {
      value = now|format_timestamp:"l":"UTC"
    }

    // Insert new signal record
    db.add genie_behavior_signals {
      enforce_hidden_fields = false
      data = {
        device_id       : $input.device_id
        external_user_id: $input.external_user_id
        signal_type     : $input.signal_type
        signal_value    : $input.signal_value
        category_tags   : $input.category_tags
        city            : $input.city
        neighborhood    : $input.neighborhood
        time_of_day     : $time_of_day
        day_of_week     : $day_of_week
        session_id      : $input.session_id
      }
    } as $new_signal

    // Find social profile by device_id
    db.query genie_user_social_profile {
      where = $db.genie_user_social_profile.device_id == $input.device_id
      return = {type: "list", paging: {page: 1, per_page: 1}}
    } as $profile_list

    var $profile {
      value = $profile_list.items[0]
    }

    var $profile_id_check {
      value = $profile|get:"id":0
    }

    // Initialize signal count
    var $updated_signal_count {
      value = 0
    }

    // Increment signal count if profile found
    conditional {
      if ($profile_id_check != 0) {
        var.update $updated_signal_count {
          value = $profile.signal_count + 1
        }

        db.edit genie_user_social_profile {
          field_name = "id"
          field_value = $profile_id_check
          enforce_hidden_fields = false
          data = {
            signal_count   : $updated_signal_count
            last_updated_at: now
          }
        } as $updated_profile
      }
    }

    // GEN-013: a saved venue is a weak (inferred) taste signal. Its own cuisine tags and price
    // band are added as inferred preferences (confidence 0.4). Repeats only raise the evidence
    // count; stated and removed preferences are never changed. Never fails the endpoint.
    var $context_sync {
      value = null
    }

    conditional {
      if ($input.signal_type == "venue_save") {
        try_catch {
          try {
            var $sv_id {
              value = ($input.signal_value ?? "")|to_int
            }

            conditional {
              if ($sv_id > 0) {
                db.get genie_venues {
                  field_name = "id"
                  field_value = $sv_id
                } as $sv

                conditional {
                  if ($sv != null) {
                    var $sv_ops {
                      value = []
                    }

                    var $sv_tags_raw {
                      value = ($sv|get:"cuisine_tags") ?? []
                    }

                    var $sv_tags {
                      value = []
                    }

                    // Some venues list a tag twice; count each tag once per save.
                    conditional {
                      if ($sv_tags_raw|is_array) {
                        var.update $sv_tags {
                          value = (($sv_tags_raw|filter:($$|is_text))|unique)|slice:0:3
                        }
                      }
                    }

                    foreach ($sv_tags) {
                      each as $ct {
                        var $ct_value {
                          value = ($ct|replace:"_":" ")|trim
                        }

                        conditional {
                          if ($ct_value != "") {
                            array.push $sv_ops {
                              value = {op: "add", category: "food", value: $ct_value, source: "inferred", confidence: 0.4}
                            }
                          }
                        }
                      }
                    }

                    var $sv_price {
                      value = (($sv|get:"price_band") ?? "")|trim
                    }

                    conditional {
                      if ($sv_price != "") {
                        array.push $sv_ops {
                          value = {op: "add", category: "price", value: $sv_price, source: "inferred", confidence: 0.4}
                        }
                      }
                    }

                    conditional {
                      if (($sv_ops|count) > 0) {
                        function.run "genie/fn_genie_apply_context_ops_dev" {
                          input = {
                            external_user_id: $input.external_user_id
                            device_id       : $input.device_id
                            ops             : $sv_ops
                          }
                        } as $context_sync
                      }
                    }
                  }
                }
              }
            }
          }

          catch {
            var.update $context_sync {
              value = {error: "sync_failed"}
            }
          }
        }
      }
    }
  }

  response = {
    success     : true
    signal_id   : $new_signal.id
    signal_type : $new_signal.signal_type
    signal_value: $new_signal.signal_value
    time_of_day : $time_of_day
    day_of_week : $day_of_week
    signal_count: $updated_signal_count
    context_sync: $context_sync
  }
}
