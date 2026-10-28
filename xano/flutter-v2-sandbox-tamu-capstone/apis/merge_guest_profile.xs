// Called on signup — merges anonymous device profile into verified account
// GEN-013 (2026-10-21): first links the device's user context to the account (merge or
// claim, via fn_genie_resolve_user_context_dev with link = true). It runs before the
// social-profile lookup so a device with quick picks but no social profile still links, and a
// failure never affects the merge below. Reported in context_link.
query "genie/merge_guest_profile" verb=POST {
  api_group = "Genie_Dev"

  input {
    text device_id
    text external_user_id
  }

  stack {
    // GEN-013: link the user context first (never blocks the profile merge).
    var $context_link {
      value = {linked: false}
    }

    try_catch {
      try {
        db.query genie_user {
          where = $db.genie_user.external_user_id == $input.external_user_id
          return = {type: "single"}
        } as $link_user

        conditional {
          if ($link_user != null && (($input.device_id ?? "")|trim) != "") {
            function.run "genie/fn_genie_resolve_user_context_dev" {
              input = {
                user_id         : $link_user.id
                device_id       : $input.device_id
                external_user_id: $input.external_user_id
                link            : true
              }
            } as $link_result

            var $link_linked {
              value = ($link_result|get:"linked") ?? false
            }

            var $link_merged {
              value = ($link_result|get:"merged") ?? false
            }

            var $link_created {
              value = ($link_result|get:"created") ?? false
            }

            var $link_source {
              value = ($link_result|get:"source") ?? "none"
            }

            var.update $context_link {
              value = {linked: $link_linked, merged: $link_merged, created: $link_created, source: $link_source}
            }
          }
        }
      }

      catch {
        var.update $context_link {
          value = {linked: false, error: true}
        }
      }
    }

    // Find profile by device_id
    db.query genie_user_social_profile {
      where = $db.genie_user_social_profile.device_id == $input.device_id
      return = {type: "list", paging: {page: 1, per_page: 1}}
    } as $profile_list

    var $profile {
      value = $profile_list.items[0]
    }

    var $profile_id {
      value = $profile|get:"id":0
    }

    // Stop if no profile found
    precondition ($profile_id != 0) {
      error_type = "notfound"
      error = "No guest profile found for this device."
    }

    // Link external_user_id to the device profile
    db.edit genie_user_social_profile {
      field_name = "id"
      field_value = $profile_id
      enforce_hidden_fields = false
      data = {
        external_user_id: $input.external_user_id
        last_updated_at : now
      }
    } as $updated_profile

    // Get all behavior signals for this device
    db.query genie_behavior_signals {
      where = $db.genie_behavior_signals.device_id == $input.device_id
      return = {type: "list", paging: {page: 1, per_page: 1000}}
    } as $signals_list

    var $signal_count {
      value = $signals_list.items|count
    }

    // Update each signal with the external_user_id
    foreach ($signals_list.items) {
      each as $item {
        db.edit genie_behavior_signals {
          field_name = "id"
          field_value = $item.id
          enforce_hidden_fields = false
          data = {external_user_id: $input.external_user_id}
        }
      }
    }
  }

  response = {
    success         : true
    profile_id      : $updated_profile.id
    device_id       : $input.device_id
    external_user_id: $updated_profile.external_user_id
    signals_merged  : $signal_count
    intake_completed: $updated_profile.intake_completed
    signal_count    : $updated_profile.signal_count
    context_link    : $context_link
  }
}
