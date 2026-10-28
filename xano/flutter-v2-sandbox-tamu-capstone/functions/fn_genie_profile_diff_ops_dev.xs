// Turns a social profile save into user context ops (GEN-013). For every profile field the
// request sent, it compares the sent tags with the stated preferences already in the user
// context for that category (same field-to-category map as the GEN-011 migration):
//   - a sent tag the context does not have yet becomes a stated add;
//   - a stated preference in that category that was not sent becomes a remove (tombstone).
// Fields that were not sent (null or "") are skipped, so a partial save never removes anything,
// and an explicit empty list [] clears the category. Inferred preferences are never removed
// here. Comparing with the context, not the old profile row, keeps the two in step even when
// the profile row was changed elsewhere. music and community stay sensitive in the context.
function "genie/fn_genie_profile_diff_ops_dev" {
  input {
    // The profile fields as sent in the request
    json? after?

    // The current context_json.preferences of the owner
    json? current?
  }

  stack {
    var $field_map {
      value = [
        {field: "experiences_tags", category: "experience"}
        {field: "atmosphere_tags", category: "atmosphere"}
        {field: "bevy_bites_tags", category: "food"}
        {field: "community_tags", category: "community"}
        {field: "music_tags", category: "music"}
        {field: "sports_tags", category: "sports_team"}
        {field: "events_tags", category: "event"}
        {field: "occasions_tags", category: "occasion"}
        {field: "neighborhood_prefs", category: "neighborhood"}
        {field: "price_range", category: "price"}
        {field: "budget_preference", category: "price"}
        {field: "group_size", category: "group_size"}
        {field: "typical_time", category: "typical_time"}
      ]
    }

    var $after {
      value = $input.after ?? {}
    }

    var $current {
      value = []
    }

    conditional {
      if ($input.current|is_array) {
        var.update $current {
          value = $input.current
        }
      }
    }

    // Live stated preferences only.
    var $stated {
      value = $current|filter:($$.source == "stated" && ($$.status == "active" || $$.status == "user_edited"))
    }

    var $ops {
      value = []
    }

    foreach ($field_map) {
      each as $map {
        var $raw_a {
          value = $after|get:$map.field
        }

        // Not sent in this save: leave the category alone.
        var $sent {
          value = $raw_a|is_array
        }

        conditional {
          if ($raw_a|is_text) {
            var.update $sent {
              value = ($raw_a|trim) != ""
            }
          }
        }

        conditional {
          if ($sent) {
            var $vals_a {
              value = []
            }

            conditional {
              if ($raw_a|is_array) {
                var.update $vals_a {
                  value = $raw_a|filter:($$|is_text)
                }
              }

              elseif ($raw_a|is_text) {
                var.update $vals_a {
                  value = [$raw_a]
                }
              }
            }

            var $sent_vals {
              value = ($vals_a|map:($$|trim))|filter:($$ != "" && $$ != "{}" && ($$|to_lower) != "[object object]")
            }

            var $sent_lower {
              value = $sent_vals|map:($$|to_lower)
            }

            var $cat {
              value = $map.category
            }

            var $cur_vals {
              value = ($stated|filter:($$.category == $cat))|map:$$.value
            }

            var $cur_lower {
              value = $cur_vals|map:(($$|to_text)|to_lower)
            }

            foreach ($sent_vals) {
              each as $va {
                conditional {
                  if (($cur_lower|in:($va|to_lower)) == false) {
                    array.push $ops {
                      value = {op: "add", category: $cat, value: $va, source: "stated"}
                    }
                  }
                }
              }
            }

            foreach ($cur_vals) {
              each as $vb {
                conditional {
                  if (($sent_lower|in:(($vb|to_text)|to_lower)) == false) {
                    array.push $ops {
                      value = {op: "remove", category: $cat, value: $vb}
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  response = $ops
}
