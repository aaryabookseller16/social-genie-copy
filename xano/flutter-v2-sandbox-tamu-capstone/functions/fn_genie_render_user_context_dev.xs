// Renders a user context document as compact text for the Genie prompt (GEN-010).
// Only active and user_edited preferences are included. Sensitive entries are
// left out unless they carry a consent_ref. The profile block (age, gender) is
// never rendered here. Format is provisional until GEN-053.
function "genie/fn_genie_render_user_context_dev" {
  input {
    json? context?
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

    array.filter ($prefs) if (($this.status == "active" || $this.status == "user_edited") && ($this.sensitivity != "sensitive" || $this.consent_ref != null)) as $visible

    array.group_by ($visible) {
      by = $this.category
    } as $groups

    var $lines {
      value = []
    }

    foreach ($groups|keys) {
      each as $category {
        var $labels {
          value = []
        }

        foreach (($groups|get:$category)|safe_array) {
          each as $pref {
            var $label {
              value = $pref.value
            }

            conditional {
              if ($pref.source != "stated") {
                var.update $label {
                  value = $pref.value ~ " (learned)"
                }
              }
            }

            array.push $labels {
              value = $label
            }
          }
        }

        array.push $lines {
          value = "- " ~ $category ~ ": " ~ ($labels|join:", ")
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
    text : $text
    count: $visible|count
  }
}
