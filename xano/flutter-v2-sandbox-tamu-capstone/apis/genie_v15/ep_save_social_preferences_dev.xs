// Saves or updates social preferences for the authenticated user.
// User context (2026-10-27): after the save, the sent fields are mirrored into the user
// context as stated adds and removals, the same way as update_social_profile
// (fn_genie_apply_context_ops_dev with profile_fields). Fields that were not sent are left
// alone; avoidances, energy, crowd, age and visit frequency have no context category and are
// not mirrored. Reported in context_sync; it never fails the endpoint.
query "genie/ep_save_social_preferences_dev" verb=POST {
  api_group = "genie_v15"
  auth = "genie_user"

  input {
    // Preferred event categories
    json event_categories?
  
    // Community identity tags
    json community_identity?
  
    // Neighborhood preferences
    json neighborhood_prefs?
  
    // Music genre preferences
    json music_preferences?
  
    // Preferred energy levels
    json energy_preferences?
  
    // Preferred crowd types
    json crowd_preferences?
  
    // Venue atmosphere tags
    json atmosphere_tags?
  
    // Experience tags
    json experiences_tags?
  
    // Typical budget range
    text budget_range?
  
    // Food preferences or dietary restrictions
    json food_preferences?
  
    // Things to avoid
    json avoidances?
  
    // User age bracket
    text age_bracket?
  
    // Social activity frequency
    text visit_frequency?
  
    // Preferred time of day
    text typical_time?
  
    // Typical group size
    text group_size?
  
    // Indicates if intake is complete
    bool intake_completed?
  }

  stack {
    // Query all records from genie_social_preferences where user_id equals auth_user.id, limit 1
    db.query genie_social_preferences {
      where = $db.genie_social_preferences.user_id == $auth.id
      return = {type: "list", paging: {page: 1, per_page: 1}}
    } as $pref_result
  
    // Create variable existing_pref set to var.pref_result[0]
    var $existing_pref {
      value = $pref_result.items|first
    }
  
    // Conditional: if var.existing_pref.id > 0
    conditional {
      if ($existing_pref != null) {
        // Edit that record
        db.edit genie_social_preferences {
          field_name = "id"
          field_value = $existing_pref.id
          enforce_hidden_fields = false
          data = {
            event_categories  : ($input.event_categories ?? $existing_pref.event_categories)
            community_identity: ($input.community_identity ?? $existing_pref.community_identity)
            neighborhood_prefs: ($input.neighborhood_prefs ?? $existing_pref.neighborhood_prefs)
            music_preferences : ($input.music_preferences ?? $existing_pref.music_preferences)
            energy_preferences: ($input.energy_preferences ?? $existing_pref.energy_preferences)
            crowd_preferences : ($input.crowd_preferences ?? $existing_pref.crowd_preferences)
            atmosphere_tags   : ($input.atmosphere_tags ?? $existing_pref.atmosphere_tags)
            experiences_tags  : ($input.experiences_tags ?? $existing_pref.experiences_tags)
            budget_range      : ($input.budget_range ?? $existing_pref.budget_range)
            food_preferences  : ($input.food_preferences ?? $existing_pref.food_preferences)
            avoidances        : ($input.avoidances ?? $existing_pref.avoidances)
            age_bracket       : ($input.age_bracket ?? $existing_pref.age_bracket)
            visit_frequency   : ($input.visit_frequency ?? $existing_pref.visit_frequency)
            typical_time      : ($input.typical_time ?? $existing_pref.typical_time)
            group_size        : ($input.group_size ?? $existing_pref.group_size)
            intake_completed  : ($input.intake_completed ?? $existing_pref.intake_completed)
            last_updated_at   : now
            preference_version: $existing_pref.preference_version + 1
          }
        } as $updated_pref
      }
    
      else {
        // Add a new record
        db.add genie_social_preferences {
          enforce_hidden_fields = false
          data = {
            user_id           : $auth.id
            event_categories  : $input.event_categories
            community_identity: $input.community_identity
            neighborhood_prefs: $input.neighborhood_prefs
            music_preferences : $input.music_preferences
            energy_preferences: $input.energy_preferences
            crowd_preferences : $input.crowd_preferences
            atmosphere_tags   : $input.atmosphere_tags
            experiences_tags  : $input.experiences_tags
            budget_range      : $input.budget_range
            food_preferences  : $input.food_preferences
            avoidances        : $input.avoidances
            age_bracket       : $input.age_bracket
            visit_frequency   : $input.visit_frequency
            typical_time      : $input.typical_time
            group_size        : $input.group_size
            intake_completed  : ($input.intake_completed ?? false)
            preference_version: 1
            last_updated_at   : now
          }
        } as $new_pref
      }
    }
  
    // Query all records from genie_social_preferences where user_id equals auth_user.id, limit 1
    db.query genie_social_preferences {
      where = $db.genie_social_preferences.user_id == $auth.id
      return = {type: "list", paging: {page: 1, per_page: 1}}
    } as $saved_pref_result
  
    var $saved_pref {
      value = $saved_pref_result.items|first
    }
  
    function.run "genie/fn_genie_merge_intake_tag_labels_dev" {
      input = {
        music_preferences : $saved_pref.music_preferences
        experiences_tags  : $saved_pref.experiences_tags
        atmosphere_tags   : $saved_pref.atmosphere_tags
        food_preferences  : $saved_pref.food_preferences
        community_identity: $saved_pref.community_identity
        energy_preferences: $saved_pref.energy_preferences
        crowd_preferences : $saved_pref.crowd_preferences
      }
    } as $merged_tags
  
    function.run "genie/fn_genie_sync_user_tag_preferences_dev" {
      input = {
        user_id   : $auth.id
        tag_labels: $merged_tags.tag_labels
        source    : "intake"
      }
    } as $tag_sync

    // User context (2026-10-27, added without changing existing lines): mirror the sent fields
    // into the account's context. Field names are mapped to the social profile names that
    // fn_genie_profile_diff_ops_dev knows.
    var $context_sync {
      value = null
    }

    try_catch {
      try {
        db.get genie_user {
          field_name = "id"
          field_value = $auth.id
        } as $context_owner

        // The fields as sent in this request, so unsent fields are skipped.
        var $sent_fields {
          value = {
            events_tags       : $input.event_categories
            community_tags    : $input.community_identity
            neighborhood_prefs: $input.neighborhood_prefs
            music_tags        : $input.music_preferences
            atmosphere_tags   : $input.atmosphere_tags
            experiences_tags  : $input.experiences_tags
            price_range       : $input.budget_range
            bevy_bites_tags   : $input.food_preferences
            typical_time      : $input.typical_time
            group_size        : $input.group_size
          }
        }

        conditional {
          if ($context_owner != null && ($context_owner.external_user_id ?? "") != "") {
            function.run "genie/fn_genie_apply_context_ops_dev" {
              input = {
                external_user_id: $context_owner.external_user_id
                profile_fields  : $sent_fields
              }
            } as $context_sync
          }

          else {
            var.update $context_sync {
              value = {skipped: "no_external_user_id"}
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

  response = {
    success    : true
    message    : "Preferences saved"
    preferences: $saved_pref
    context_sync: $context_sync
  }
}
