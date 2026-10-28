// Renders a user context document as compact text for the Genie prompt (GEN-010).
// Only active and user_edited preferences are included. Sensitive entries are
// left out unless they carry a consent_ref. The profile block (age, gender) is
// never rendered here. Format is provisional until GEN-053.
// GEN-013: stated entries come first, then by confidence (high to low). Whole category
// lines are added until the text would exceed max_chars (default 600); truncated = true
// when a line was left out.
// GEN-014: dislikes (sentiment = "dislike") are rendered on one last line,
// "- not into: a, b (learned)", inside the same budget. Entries without a sentiment are likes.
// Fields are read with |get so an entry missing a key (older data) never breaks the render.
function "genie/fn_genie_render_user_context_dev" {
  input {
    json? context?
    int? max_chars?=600
  }

  stack {
    var $prefs {
      value = []
    }

    conditional {
      if ($input.context != null && (($input.context|get:"preferences")|is_array)) {
        var.update $prefs {
          value = $input.context|get:"preferences"
        }
      }
    }

    var $max_chars {
      value = ($input.max_chars ?? 600)|to_int
    }

    array.filter ($prefs) if ((($this|get:"status") == "active" || ($this|get:"status") == "user_edited") && (($this|get:"sensitivity") != "sensitive" || ($this|get:"consent_ref") != null)) as $visible

    array.filter ($visible) if (($this|get:"sentiment") != "dislike") as $likes

    array.filter ($visible) if (($this|get:"sentiment") == "dislike") as $dislikes

    // Order: stated first, each part by confidence high to low. On this instance
    // |sort:...:false sorts descending.
    array.filter ($likes) if (($this|get:"source") == "stated") as $stated

    array.filter ($likes) if (($this|get:"source") != "stated") as $learned

    var $ordered {
      value = ($stated|sort:"confidence":"number":false)|merge:($learned|sort:"confidence":"number":false)
    }

    array.group_by ($ordered) {
      by = $this.category
    } as $groups

    var $lines {
      value = []
    }

    var $used_chars {
      value = 17
    }

    var $truncated {
      value = false
    }

    var $rendered_count {
      value = 0
    }

    foreach ($groups|keys) {
      each as $category {
        var $labels {
          value = []
        }

        var $group {
          value = ($groups|get:$category)|safe_array
        }

        foreach ($group) {
          each as $pref {
            var $label {
              value = $pref|get:"value"
            }

            conditional {
              if (($pref|get:"source") != "stated") {
                var.update $label {
                  value = ($pref|get:"value") ~ " (learned)"
                }
              }
            }

            array.push $labels {
              value = $label
            }
          }
        }

        var $line {
          value = "- " ~ $category ~ ": " ~ ($labels|join:", ")
        }

        var $next_chars {
          value = 0
        }

        math.add $next_chars {
          value = $used_chars
        }

        math.add $next_chars {
          value = ($line|strlen) + 1
        }

        conditional {
          if ($truncated == false && $next_chars <= $max_chars) {
            array.push $lines {
              value = $line
            }

            var.update $used_chars {
              value = $next_chars
            }

            math.add $rendered_count {
              value = $group|count
            }
          }

          else {
            var.update $truncated {
              value = true
            }
          }
        }
      }
    }

    // Dislikes: one line, stated first.
    conditional {
      if (($dislikes|count) > 0) {
        array.filter ($dislikes) if (($this|get:"source") == "stated") as $d_stated

        array.filter ($dislikes) if (($this|get:"source") != "stated") as $d_learned

        var $d_ordered {
          value = ($d_stated|sort:"confidence":"number":false)|merge:($d_learned|sort:"confidence":"number":false)
        }

        var $d_labels {
          value = []
        }

        foreach ($d_ordered) {
          each as $dp {
            var $d_label {
              value = $dp|get:"value"
            }

            conditional {
              if (($dp|get:"source") != "stated") {
                var.update $d_label {
                  value = ($dp|get:"value") ~ " (learned)"
                }
              }
            }

            array.push $d_labels {
              value = $d_label
            }
          }
        }

        var $d_line {
          value = "- not into: " ~ ($d_labels|join:", ")
        }

        var $d_next {
          value = 0
        }

        math.add $d_next {
          value = $used_chars
        }

        math.add $d_next {
          value = ($d_line|strlen) + 1
        }

        conditional {
          if ($d_next <= $max_chars) {
            array.push $lines {
              value = $d_line
            }

            var.update $used_chars {
              value = $d_next
            }

            math.add $rendered_count {
              value = $d_ordered|count
            }
          }

          else {
            var.update $truncated {
              value = true
            }
          }
        }
      }
    }

    var $text {
      value = ""
    }

    conditional {
      if (($lines|count) > 0) {
        var.update $text {
          value = "User preferences:\n" ~ ($lines|join:"\n")
        }
      }
    }
  }

  response = {
    text     : $text
    count    : $rendered_count
    truncated: $truncated
  }
}
