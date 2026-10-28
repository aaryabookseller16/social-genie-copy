// Save or update a user's social profile preferences from the intake screen
// GEN-013 (2026-10-21): after the save, the sent fields are mirrored into the user context as
// stated adds and removals, compared with the context itself (fn_genie_apply_context_ops_dev
// with profile_fields). Fields that were not sent are left alone. Reported in context_sync; it
// never fails the endpoint.
query "genie/update_social_profile" verb=POST {
  api_group = "Genie_Dev"

  input {
    text device_id?
    text external_user_id?
    json experiences_tags?
    json atmosphere_tags?
    json bevy_bites_tags?
    json community_tags?
    json music_tags?
    text price_range?
    text group_size?
    text typical_time?
    json neighborhood_prefs?
  }

  stack {
    // Check if external_user_id was provided and is not empty
    conditional {
      if ($input.external_user_id != null) {
        db.query genie_user_social_profile {
          where = $db.genie_user_social_profile.external_user_id == $input.external_user_id
          return = {type: "list", paging: {page: 1, per_page: 1}}
        } as $profile_list
      }

      else {
        db.query genie_user_social_profile {
          where = $db.genie_user_social_profile.device_id == $input.device_id
          return = {type: "list", paging: {page: 1, per_page: 1}}
        } as $profile_list
      }
    }

    // Get first item safely
    var $profile {
      value = $profile_list.items[0]
    }

    var $profile_id {
      value = $profile|get:"id":0
    }

    // Stop if profile not found
    precondition ($profile_id != 0) {
      error_type = "notfound"
      error = "Profile not found. Call init_device first."
    }

    // Update — use ?? to keep existing values when input is null
    db.edit genie_user_social_profile {
      field_name = "id"
      field_value = $profile_id
      enforce_hidden_fields = false
      data = {
        experiences_tags  : $input.experiences_tags ?? $profile.experiences_tags
        atmosphere_tags   : $input.atmosphere_tags ?? $profile.atmosphere_tags
        bevy_bites_tags   : $input.bevy_bites_tags ?? $profile.bevy_bites_tags
        community_tags    : $input.community_tags ?? $profile.community_tags
        music_tags        : $input.music_tags ?? $profile.music_tags
        price_range       : $input.price_range ?? $profile.price_range
        group_size        : $input.group_size ?? $profile.group_size
        typical_time      : $input.typical_time ?? $profile.typical_time
        neighborhood_prefs: $input.neighborhood_prefs ?? $profile.neighborhood_prefs
        intake_completed  : true
        last_updated_at   : now
      }
    } as $updated_profile

    // GEN-013: mirror the sent fields into the user context (stated adds and removals).
    var $context_sync {
      value = null
    }

    try_catch {
      try {
        // The fields as sent in this request (not the saved row), so unsent fields are skipped.
        var $sent_fields {
          value = {
            experiences_tags  : $input.experiences_tags
            atmosphere_tags   : $input.atmosphere_tags
            bevy_bites_tags   : $input.bevy_bites_tags
            community_tags    : $input.community_tags
            music_tags        : $input.music_tags
            price_range       : $input.price_range
            group_size        : $input.group_size
            typical_time      : $input.typical_time
            neighborhood_prefs: $input.neighborhood_prefs
          }
        }

        function.run "genie/fn_genie_apply_context_ops_dev" {
          input = {
            external_user_id: $input.external_user_id
            device_id       : $input.device_id
            profile_fields  : $sent_fields
          }
        } as $context_sync
      }

      catch {
        var.update $context_sync {
          value = {error: "sync_failed"}
        }
      }
    }
  }

  response = {
    success           : true
    profile_id        : $updated_profile.id
    intake_completed  : $updated_profile.intake_completed
    experiences_tags  : $updated_profile.experiences_tags
    atmosphere_tags   : $updated_profile.atmosphere_tags
    bevy_bites_tags   : $updated_profile.bevy_bites_tags
    community_tags    : $updated_profile.community_tags
    music_tags        : $updated_profile.music_tags
    price_range       : $updated_profile.price_range
    group_size        : $updated_profile.group_size
    typical_time      : $updated_profile.typical_time
    neighborhood_prefs: $updated_profile.neighborhood_prefs
    last_updated_at   : $updated_profile.last_updated_at
    context_sync      : $context_sync
  }
}
