// Genie Phase 1 — Xano-first venues, AI fallback, plus profile get-or-create + email prompt.
// ✅ Response updated for UI rules:
// - reply_mode returned
// - venues returned (cards)
// - supported city => reply is short + venues array (no list text)
// - unsupported city => reply is text list from AI, venues empty
function "genie/fn_genie_handle_message_dev" {
  input {
    text message
    text channel
    text external_user_id
    text user_name?
    text city_context?
    text session_token? filters=trim
    decimal lat?
    decimal lng?
    int radius_meters?
    text location_label?
    text? detected_language?
    text? session_id?
  }

  stack {
    // -----------------------------
    // 0) Vars (declare ONCE)
    // -----------------------------
    var $should_stop {
      value = false
    }
  
    var $error_out {
      value = null
    }
  
    var $user_resp {
      value = null
    }
  
    var $prof_resp {
      value = null
    }
  
    var $sess_resp {
      value = null
    }
  
    var $log_resp {
      value = null
    }
  
    var $intent_resp {
      value = null
    }
  
    var $safe_filters {
      value = {}
    }
  
    var $has_results {
      value = false
    }
  
    var $final_reply {
      value = null
    }
  
    var $use_xano {
      value = false
    }
  
    var $checkpoint {
      value = "init"
    }
  
    var $msg_clean {
      value = $input.message
    }
  
    var $min_conf {
      value = 0
    }
  
    var $rank_resp {
      value = null
    }
  
    var $hydr_resp {
      value = null
    }
  
    var $ai_payload_resp {
      value = null
    }
  
    var $ai_reply_resp {
      value = null
    }
  
    // ✅ reply mode (DECLARE ONCE — you had this twice)
    var $reply_mode {
      value = "supported_no_results"
    }
  
    // Debug support
    var $venues_text {
      value = ""
    }
  
    var $venues_text_len {
      value = 0
    }
  
    var $venues_found {
      value = 0
    }
  
    // Profile
    var $profile_obj {
      value = null
    }
  
    var $needs_email {
      value = false
    }
  
    var $profile_prompt {
      value = null
    }
  
    // Safe inputs
    var $channel_safe {
      value = "test"
    }
  
    var $external_user_id_final {
      value = null
    }
  
    var $lat_in {
      value = $input.lat
    }
  
    var $lng_in {
      value = $input.lng
    }
  
    var $radius_m {
      value = $input.radius_meters
    }
  
    var $has_geo {
      value = false
    }
  
    var $needs_location {
      value = false
    }
  
    // V1 proximity work vars
    var $nearby_candidates {
      value = []
    }
  
    var $scored_candidates {
      value = []
    }
  
    var $dist_m {
      value = null
    }
  
    var $wants_near_me {
      value = false
    }
  
    // City
    var $city_norm {
      value = ""
    }
  
    var $city_name_match {
      value = ""
    }
  
    var $city_name_match_raw {
      value = null
    }
  
    var $city_name_match_norm {
      value = null
    }
  
    var $city_row {
      value = null
    }
  
    var $city_id {
      value = null
    }
  
    var $city_from_message {
      value = null
    }
  
    var $msg_for_city {
      value = ""
    }
  
    var $parts_in {
      value = []
    }
  
    var $candidate_city {
      value = ""
    }
  
    var $candidate_parts {
      value = []
    }
  
    var $candidates_page {
      value = []
    }
  
    var $candidates_total {
      value = 0
    }
  
    var $exact_rows {
      value = []
    }
  
    var $signal_rows {
      value = []
    }
  
    var $fallback_rows {
      value = []
    }
  
    var $debug_first_ms {
      value = 0
    }
  
    var $rotation_offset {
      value = 0
    }
  
    var $candidates_rotated {
      value = []
    }
  
    var $rotated_slice {
      value = []
    }
  
    var $i {
      value = 0
    }
  
    var $start_i {
      value = 0
    }
  
    var $end_i {
      value = 0
    }
  
    var $no_city_data {
      value = false
    }
  
    // Identity / Session / Message
    var $user_obj {
      value = null
    }
  
    var $user_id {
      value = null
    }
  
    var $prof_obj {
      value = null
    }
  
    var $session_id {
      value = null
    }
  
    // Session handling
    var $session_obj {
      value = null
    }
  
    var $session_id_out {
      value = null
    }
  
    var $session_token_out {
      value = null
    }
  
    var $user_message_id {
      value = null
    }
  
    var $intent_dev {
      value = null
    }
  
    // Venues
    var $venue_candidates {
      value = []
    }
  
    var $venue_results_dev {
      value = []
    }
  
    var $wrap_resp {
      value = null
    }
  
    var $closest_rows {
      value = []
    }
  
    var $closest_venues {
      value = []
    }
  
    var $max_take {
      value = 15
    }
  
    var $closest_venues_final {
      value = []
    }
  
    var $cap_i {
      value = 0
    }
  
    var $seed {
      value = 0
    }
  
    var $idx {
      value = 0
    }
  
    var $window_end {
      value = 0
    }
  
    var $wrap_end {
      value = 0
    }
  
    // AI fallback
    var $ai_payload_dev {
      value = null
    }
  
    var $ai_reply_dev {
      value = null
    }
  
    var $assistant_reply_safe {
      value = null
    }
  
    var $allow_ai {
      value = false
    }
  
    var $ai_call_log {
      value = null
    }
  
    // City status
    var $city_supported {
      value = false
    }
  
    var $city_missing {
      value = false
    }
  
    var $last_city {
      value = ""
    }
  
    var $city_is_missing {
      value = false
    }
  
    // Force AI for unsupported city
    var $force_ai {
      value = false
    }
  
    // intent-driven filter term (type OR cuisine)
    var $type_filter {
      value = ""
    }
  
    // Social profile vars
    var $social_profile {
      value = null
    }
  
    var $social_experiences {
      value = []
    }
  
    var $social_atmosphere {
      value = []
    }
  
    var $social_bevy_bites {
      value = []
    }
  
    var $social_community {
      value = []
    }
  
    var $social_music {
      value = []
    }
  
    var $social_price_range {
      value = ""
    }
  
    var $social_signal_count {
      value = 0
    }
  
    var $show_intake_prompt {
      value = false
    }
  
    var $intake_prompt_copy {
      value = ""
    }
  
    var $profile_strength_tier {
      value = "new"
    }
  
    var $t_start {
      value = "now"|to_ms
    }
  
    var $more_nearby_candidates {
      value = []
    }
  
    // Language Help
    var $detected_language {
      value = "en"
    }
  
    var $detected_intent {
      value = "general"
    }
  
    var $no_nearby_in_radius {
      value = false
    }
  
    var $venue_candidates {
      value = []
    }
  
    // -----------------------------
    // 0.1) Safe channel
    // -----------------------------
    conditional {
      if ($input.channel != null && ($input.channel|trim) != "") {
        var.update $channel_safe {
          value = $input.channel|trim
        }
      }
    }
  
    conditional {
      if ($msg_clean != null && (($msg_clean|trim)|is_empty) == false) {
        function.run "genie/fn_genie_detect_language_dev" {
          input = {message: $msg_clean}
        } as $lang_result
      
        conditional {
          if ($lang_result != null && ($lang_result|has:"detected_language") && $lang_result.detected_language != null) {
            var.update $detected_language {
              value = $lang_result.detected_language
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 0.2) external_user_id safe
    // -----------------------------
    conditional {
      if ($input.external_user_id != null && ($input.external_user_id|trim) != "" && ($input.external_user_id|trim) != "null") {
        var.update $external_user_id_final {
          value = $input.external_user_id|trim
        }
      }
    }
  
    // -----------------------------
    // Location Set (single source of truth)
    // -----------------------------
    conditional {
      if ($lat_in != null && $lng_in != null && ($lat_in|to_decimal) != 0 && ($lng_in|to_decimal) != 0) {
        var.update $has_geo {
          value = true
        }
      }
    }
  
    conditional {
      if ($radius_m == null || ($radius_m|to_int) <= 0) {
        var.update $radius_m {
          value = 2500
        }
      }
    }
  
    // wants_near_me detection
    var.update $wants_near_me {
      value = false
    }
  
    conditional {
      if ($has_geo) {
        var.update $wants_near_me {
          value = true
        }
      }
    }
  
    conditional {
      if ($input.location_label != null && ((($input.location_label|trim)|is_empty) == false)) {
        var.update $wants_near_me {
          value = true
        }
      }
    }
  
    conditional {
      if ($msg_clean != null && (($msg_clean|contains:"near me") || ($msg_clean|contains:"nearby") || ($msg_clean|contains:"close to me"))) {
        var.update $wants_near_me {
          value = true
        }
      }
    }
  
    // needs_location should ONLY mean: near-me requested but no geo provided
    var.update $needs_location {
      value = false
    }
  
    conditional {
      if ($wants_near_me && ($has_geo == false)) {
        var.update $needs_location {
          value = true
        }
      }
    }
  
    // -----------------------------
    // 0.25) City extraction from message (only if city_context is empty)
    // -----------------------------
    conditional {
      if ($input.city_context == null || ($input.city_context|trim)|is_empty) {
        conditional {
          if ($msg_clean != null && ((($msg_clean|trim)|is_empty) == false)) {
            var.update $msg_for_city {
              value = $msg_clean|trim
            }
          }
        }
      
        var $msg_for_city_empty {
          value = false
        }
      
        conditional {
          if (($msg_for_city|trim)|is_empty) {
            var.update $msg_for_city_empty {
              value = true
            }
          }
        }
      
        conditional {
          if ($msg_for_city_empty && $input.message != null && ((($input.message|trim)|is_empty) == false)) {
            var.update $msg_for_city {
              value = $input.message|trim
            }
          }
        }
      
        conditional {
          if (((($msg_for_city|trim)|is_empty) == false) && ($msg_for_city|contains:" in ")) {
            var.update $parts_in {
              value = $msg_for_city|split:" in "
            }
          }
        }
      
        conditional {
          if ((($parts_in|is_array) == false || ($parts_in|count) == 0) && ((($msg_for_city|trim)|is_empty) == false) && ($msg_for_city|contains:" In ")) {
            var.update $parts_in {
              value = $msg_for_city|split:" In "
            }
          }
        }
      
        conditional {
          if ($parts_in != null && ($parts_in|is_array) && ($parts_in|count) > 1) {
            var.update $candidate_city {
              value = $parts_in[($parts_in|count)-1]|trim
            }
          }
        }
      
        conditional {
          if (((($candidate_city|trim)|is_empty) == false) && ($candidate_city|contains:",")) {
            var.update $candidate_parts {
              value = $candidate_city|split:","
            }
          
            conditional {
              if ($candidate_parts != null && ($candidate_parts|is_array) && ($candidate_parts|count) > 0) {
                var.update $candidate_city {
                  value = $candidate_parts[0]|trim
                }
              }
            }
          }
        }
      
        conditional {
          if (((($candidate_city|trim)|is_empty) == false) && ($candidate_city|contains:"?")) {
            var.update $candidate_city {
              value = ($candidate_city|replace:"?":"")|trim
            }
          }
        }
      
        conditional {
          if (((($candidate_city|trim)|is_empty) == false) && ($candidate_city|contains:".")) {
            var.update $candidate_city {
              value = ($candidate_city|replace:".":"")|trim
            }
          }
        }
      
        conditional {
          if (((($candidate_city|trim)|is_empty) == false) && ($candidate_city|contains:"!")) {
            var.update $candidate_city {
              value = ($candidate_city|replace:"!":"")|trim
            }
          }
        }
      
        conditional {
          if (((($candidate_city|trim)|is_empty) == false)) {
            var.update $city_from_message {
              value = $candidate_city|trim
            }
          
            var.update $city_norm {
              value = $city_from_message
            }
          
            var.update $city_name_match {
              value = $city_from_message
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 0.3) City safe (NO lower())
    // -----------------------------
    conditional {
      if ($input.city_context != null && ((($input.city_context|trim)|is_empty) == false)) {
        var.update $city_norm {
          value = $input.city_context|trim
        }
      }
    }
  
    // -----------------------------
    // 0.4) City map (NO lower())
    // -----------------------------
    conditional {
      if ($city_norm == "houston") {
        var.update $city_name_match {
          value = "Houston"
        }
      }
    }
  
    conditional {
      if ($city_norm == "Houston") {
        var.update $city_name_match {
          value = "Houston"
        }
      }
    }
  
    conditional {
      if ($city_norm == "dallas") {
        var.update $city_name_match {
          value = "Dallas"
        }
      }
    }
  
    conditional {
      if ($city_norm == "Dallas") {
        var.update $city_name_match {
          value = "Dallas"
        }
      }
    }
  
    conditional {
      if ($city_norm == "austin") {
        var.update $city_name_match {
          value = "Austin"
        }
      }
    }
  
    conditional {
      if ($city_norm == "Austin") {
        var.update $city_name_match {
          value = "Austin"
        }
      }
    }
  
    conditional {
      if ($city_norm == "atlanta") {
        var.update $city_name_match {
          value = "Atlanta"
        }
      }
    }
  
    conditional {
      if ($city_norm == "Atlanta") {
        var.update $city_name_match {
          value = "Atlanta"
        }
      }
    }
  
    conditional {
      if ($city_norm == "miami") {
        var.update $city_name_match {
          value = "Miami"
        }
      }
    }
  
    conditional {
      if ($city_norm == "Miami") {
        var.update $city_name_match {
          value = "Miami"
        }
      }
    }
  
    // -----------------------------
    // 0.5) City map fallback (unknown city passes through)
    // -----------------------------
    conditional {
      if (((($city_norm|trim)|is_empty) == false)) {
        conditional {
          if (($city_name_match|trim)|is_empty) {
            var.update $city_name_match {
              value = $city_norm
            }
          }
        }
      }
    }
  
    // -----------------------------
    // .56) Guard: external_user_id required
    // -----------------------------
    conditional {
      if ($external_user_id_final == null || $external_user_id_final == "") {
        var.update $should_stop {
          value = true
        }
      
        var.update $error_out {
          value = {message: "Missing external_user_id"}
        }
      }
    }
  
    // -----------------------------
    // .57 Nearest-city fallback if no city
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        conditional {
          if ($has_geo && ($city_norm|trim)|is_empty) {
            function.run "genie/fn_resolve_nearest_city_dev" {
              input = {lat: $lat_in|to_decimal, lng: $lng_in|to_decimal}
            } as $nearest_city_result
          
            conditional {
              if ($nearest_city_result.supported) {
                var.update $city_norm {
                  value = $nearest_city_result.city_name
                }
              
                var.update $city_name_match {
                  value = $nearest_city_result.city_name
                }
              }
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 1.5) City lookup -> city_id
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        conditional {
          if ($city_name_match != null) {
            var.update $city_name_match {
              value = $city_name_match|trim
            }
          }
        }
      
        conditional {
          if ($should_stop == false) {
            db.query city_graph_cities {
              where = ($db.city_graph_cities.city_name == $city_name_match) && $db.city_graph_cities.active == true
              return = {type: "single"}
            } as $city_row
          }
        }
      
        conditional {
          if ($should_stop == false) {
            var.update $city_supported {
              value = false
            }
          
            var.update $city_id {
              value = null
            }
          
            var.update $force_ai {
              value = false
            }
          
            var.update $reply_mode {
              value = "city_unsupported"
            }
          }
        }
      
        conditional {
          if ($should_stop == false) {
            conditional {
              if ($city_row != null && $city_row.id != null) {
                var.update $city_supported {
                  value = true
                }
              
                var.update $city_id {
                  value = $city_row.id
                }
              
                var.update $force_ai {
                  value = false
                }
              
                var.update $reply_mode {
                  value = "has_results"
                }
              }
            }
          }
        }
      
        conditional {
          if ($should_stop == false) {
            conditional {
              if ($city_row == null) {
                var.update $city_supported {
                  value = false
                }
              
                var.update $city_id {
                  value = null
                }
              
                var.update $force_ai {
                  value = true
                }
              
                var.update $reply_mode {
                  value = "city_unsupported"
                }
              
                var.update $ai_call_log {
                  value = {
                    city_unsupported: true
                    city_norm       : $city_norm
                    city_match      : $city_name_match
                  }
                }
              }
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 2) Identify user
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        conditional {
          if ($should_stop == false) {
            function.run "genie/fn_genie_identify_user_dev" {
              input = {
                channel         : $channel_safe
                external_user_id: $external_user_id_final
                display_name    : $input.user_name
                avatar_url      : ""
                context         : {source: $channel_safe}
              }
            } as $user_resp
          }
        }
      
        conditional {
          if ($user_resp != null) {
            var.update $user_obj {
              value = $user_resp
            }
          }
        }
      
        conditional {
          if ($user_obj != null && ($user_obj|has:"user_id") && $user_obj.user_id != null) {
            var.update $user_id {
              value = $user_obj.user_id
            }
          }
        }
      
        conditional {
          if ($user_id == null && $user_obj != null && ($user_obj|has:"user") && $user_obj.user != null) {
            conditional {
              if (($user_obj.user|has:"id") && $user_obj.user.id != null) {
                var.update $user_id {
                  value = $user_obj.user.id
                }
              }
            }
          }
        }
      
        conditional {
          if ($should_stop == false) {
            conditional {
              if ($user_id == null) {
                var.update $should_stop {
                  value = true
                }
              
                var.update $error_out {
                  value = {message: "user_id missing after identify_user_dev"}
                }
              }
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 2.5) Get-or-create profile
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        function.run "genie/fn_genie_get_or_create_user_profile_dev" {
          input = {user_id: $user_id}
        } as $prof_resp
      
        var.update $prof_obj {
          value = $prof_resp
        }
      
        conditional {
          if ($prof_obj != null && ($prof_obj|has:"profile") && $prof_obj.profile != null) {
            var.update $profile_obj {
              value = $prof_obj.profile
            }
          }
        }
      
        conditional {
          if ($profile_obj == null) {
            var.update $needs_email {
              value = true
            }
          }
        }
      
        conditional {
          if ($profile_obj != null) {
            conditional {
              if (($profile_obj|has:"email") == false || $profile_obj.email == null || ($profile_obj.email|trim) == "") {
                var.update $needs_email {
                  value = true
                }
              }
            }
          }
        }
      
        conditional {
          if ($needs_email) {
            var.update $profile_prompt {
              value = "Quick one — what's your email? I'll save your preferences and send your picks + perks."
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 2.6) Load social profile for personalization
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        conditional {
          if ($external_user_id_final != null && $external_user_id_final != "") {
            db.query genie_user_social_profile {
              where = $db.genie_user_social_profile.external_user_id == $external_user_id_final
              return = {type: "list", paging: {page: 1, per_page: 1}}
            } as $social_profile_list
          
            var $social_profile_row {
              value = $social_profile_list.items[0]
            }
          
            var $social_profile_id_check {
              value = $social_profile_row|get:"id":0
            }
          
            conditional {
              if ($social_profile_id_check != 0) {
                var.update $social_profile {
                  value = $social_profile_row
                }
              }
            }
          
            // FIX 2 (removed): the user_id fallback queried genie_user_social_profile.user_id,
            // which does not exist on that table, and failed every guest / new-user request.
          
            // FIX 4: Load genie_user_tag_preferences for taxonomy tag context
            var $user_tag_pref_ids {
              value = []
            }
          
            conditional {
              if ($user_id != null && ($user_id|to_int) > 0) {
                db.query genie_user_tag_preferences {
                  where = $db.genie_user_tag_preferences.user_id == $user_id
                  return = {type: "list", paging: {page: 1, per_page: 50}}
                } as $utp_result
              
                conditional {
                  if ($utp_result != null && ($utp_result|has:"items") && ($utp_result.items|count) > 0) {
                    foreach ($utp_result.items) {
                      each as $utp {
                        var.update $user_tag_pref_ids {
                          value = $user_tag_pref_ids|append:($utp|get:"tag_id":0)
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      
        conditional {
          if ($social_profile != null) {
            conditional {
              if (($social_profile|has:"experiences_tags") && $social_profile.experiences_tags != null) {
                var.update $social_experiences {
                  value = $social_profile.experiences_tags
                }
              }
            }
          
            conditional {
              if (($social_profile|has:"atmosphere_tags") && $social_profile.atmosphere_tags != null) {
                var.update $social_atmosphere {
                  value = $social_profile.atmosphere_tags
                }
              }
            }
          
            conditional {
              if (($social_profile|has:"bevy_bites_tags") && $social_profile.bevy_bites_tags != null) {
                var.update $social_bevy_bites {
                  value = $social_profile.bevy_bites_tags
                }
              }
            }
          
            conditional {
              if (($social_profile|has:"community_tags") && $social_profile.community_tags != null) {
                var.update $social_community {
                  value = $social_profile.community_tags
                }
              }
            }
          
            conditional {
              if (($social_profile|has:"music_tags") && $social_profile.music_tags != null) {
                var.update $social_music {
                  value = $social_profile.music_tags
                }
              }
            }
          
            conditional {
              if (($social_profile|has:"price_range") && $social_profile.price_range != null) {
                var.update $social_price_range {
                  value = $social_profile.price_range
                }
              }
            }
          
            conditional {
              if (($social_profile|has:"signal_count") && $social_profile.signal_count != null) {
                var.update $social_signal_count {
                  value = $social_profile.signal_count
                }
              }
            }
          
            var $intake_done {
              value = $social_profile|get:"intake_completed":false
            }
          
            var $intake_shown {
              value = $social_profile|get:"intake_shown_count":0
            }
          
            var $sig_ct {
              value = $social_profile|get:"signal_count":0
            }
          
            conditional {
              if ($intake_done == false) {
                conditional {
                  if ($sig_ct >= 2 && $sig_ct <= 3 && $intake_shown == 0) {
                    var.update $show_intake_prompt {
                      value = true
                    }
                  
                    var.update $intake_prompt_copy {
                      value = "Help Genie know you better — takes just 30 seconds!"
                    }
                  }
                }
              
                conditional {
                  if ($sig_ct >= 6 && $sig_ct <= 7 && $intake_shown <= 1) {
                    var.update $show_intake_prompt {
                      value = true
                    }
                  
                    var.update $intake_prompt_copy {
                      value = "Genie's learning what you like, help get to know you better — takes only 30 seconds!"
                    }
                  }
                }
              }
            }
          
            conditional {
              if ($sig_ct >= 10) {
                var.update $profile_strength_tier {
                  value = "strong"
                }
              }
            
              elseif ($sig_ct >= 5) {
                var.update $profile_strength_tier {
                  value = "learning"
                }
              }
            
              elseif ($sig_ct >= 2) {
                var.update $profile_strength_tier {
                  value = "getting_started"
                }
              }
            }
          }
        }
      }
    }
  
    var $t_after_user {
      value = "now"|to_ms
    }
  
    // -----------------------------
    // 3) Get-or-create session
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        function.run "genie/fn_genie_get_or_create_session_dev" {
          input = {
            user_id          : $user_id
            channel          : $channel_safe
            entry_point      : ""
            entry_context_id : ""
            city_from_context: $city_norm
            context          : {}
            session_token    : $input.session_token
          }
        } as $sess_resp
      
        var.update $session_obj {
          value = $sess_resp
        }
      
        conditional {
          if ($sess_resp != null && ($sess_resp|has:"result") && $sess_resp.result != null) {
            var.update $session_obj {
              value = $sess_resp.result
            }
          }
        }
      
        conditional {
          if ($session_obj != null && ($session_obj|has:"id") && $session_obj.id != null) {
            var.update $session_id {
              value = $session_obj.id
            }
          }
        }
      
        conditional {
          if ($session_obj != null && ($session_obj|has:"id") && $session_obj.id != null && $session_id_out == null) {
            var.update $session_id_out {
              value = $session_obj.id
            }
          }
        }
      
        conditional {
          if ($session_obj != null && ($session_obj|has:"session_token") && $session_obj.session_token != null && $session_token_out == null) {
            var.update $session_token_out {
              value = $session_obj.session_token
            }
          }
        }
      
        conditional {
          if ($session_obj != null && ($session_obj|has:"id") && $session_obj.id != null && $session_id_out == null) {
            var.update $session_id_out {
              value = $session_obj.id
            }
          }
        }
      
        conditional {
          if ($session_id == null && $session_obj != null && ($session_obj|has:"session_id") && $session_obj.session_id != null) {
            var.update $session_id {
              value = $session_obj.session_id
            }
          }
        }
      
        var.update $session_id_out {
          value = $session_id
        }
      
        // WC-A: Wire language detection
        conditional {
          if ($session_id != null && $session_id != "" && $msg_clean != null && (($msg_clean|trim)|is_empty) == false) {
            function.run "genie/fn_genie_detect_language_dev" {
              input = {message: $msg_clean}
            } as $wc_lang_result
          }
        }
      
        conditional {
          if ($should_stop == false) {
            conditional {
              if ($session_id == null) {
                var.update $should_stop {
                  value = true
                }
              
                var.update $error_out {
                  value = {
                    message: "session_id missing after get_or_create_session_dev"
                  }
                }
              }
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 3.6) Inherit last city from session
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        conditional {
          if (($city_norm|trim)|is_empty) {
            conditional {
              if ($session_obj != null && ($session_obj|has:"city_from_context") && $session_obj.city_from_context != null && (($session_obj.city_from_context|trim)|is_empty) == false) {
                var.update $city_norm {
                  value = $session_obj.city_from_context|trim
                }
              
                var.update $city_name_match {
                  value = $city_norm|trim
                }
              }
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 0.57) Inherit last city fallback
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        conditional {
          if (($city_norm|trim)|is_empty) {
            conditional {
              if ($session_obj != null) {
                conditional {
                  if (($session_obj|has:"city_from_context") && $session_obj.city_from_context != null && (($session_obj.city_from_context|trim)|is_empty) == false) {
                    var.update $last_city {
                      value = $session_obj.city_from_context|trim
                    }
                  }
                }
              }
            }
          
            conditional {
              if (`($last_city|trim)|is_empty && ($profile_obj != null)`) {
                conditional {
                  if (($profile_obj|has:"city") && $profile_obj.city != null && (($profile_obj.city|trim)|is_empty) == false) {
                    var.update $last_city {
                      value = $profile_obj.city|trim
                    }
                  }
                }
              }
            }
          
            conditional {
              if (((($last_city|trim)|is_empty) == false)) {
                var.update $city_norm {
                  value = $last_city
                }
              
                var.update $city_name_match {
                  value = $last_city
                }
              }
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 0.6) City missing guard
    // -----------------------------
  
    conditional {
      if (($city_norm|trim)|is_empty) {
        var.update $city_is_missing {
          value = true
        }
      }
    }
  
    conditional {
      if ($should_stop == false && $city_is_missing && $has_geo == false) {
        var.update $city_missing {
          value = true
        }
      
        var.update $needs_location {
          value = $wants_near_me
        }
      
        var.update $reply_mode {
          value = "city_missing"
        }
      
        function.run "genie/fn_genie_get_reply_dev" {
          input = {intent: "general", reply_mode: "city_missing"}
        } as $reply_bank_result
      
        var.update $final_reply {
          value = $reply_bank_result
        }
      
        conditional {
          if ($detected_language != "en" && $detected_language != "english" && $final_reply != null && (($final_reply|trim)|is_empty) == false) {
            function.run "genie/fn_genie_translate_dev" {
              input = {
                text_to_translate: $final_reply
                target_language  : $detected_language
              }
            } as $city_missing_translation
          
            conditional {
              if ($city_missing_translation != null && ($city_missing_translation|has:"translated_text") && $city_missing_translation.translated_text != null) {
                var.update $final_reply {
                  value = $city_missing_translation.translated_text
                }
              }
            }
          }
        }
      
        var.update $use_xano {
          value = false
        }
      
        var.update $has_results {
          value = false
        }
      
        var.update $venue_results_dev {
          value = []
        }
      
        var.update $should_stop {
          value = true
        }
      }
    }
  
    var $t_after_session {
      value = "now"|to_ms
    }
  
    // -----------------------------
    // 4) Log message
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        function.run "genie/fn_genie_log_message_dev" {
          input = {
            session_id      : $session_id
            user_id         : $user_id
            message_text    : $msg_clean
            channel         : $channel_safe
            external_user_id: $external_user_id_final
            user_name       : $input.user_name
            city_context    : $city_norm
            sender_type     : "user"
            raw_payload     : {}
          }
        } as $log_resp
      
        conditional {
          if ($log_resp != null && ($log_resp|has:"message_id") && $log_resp.message_id != null) {
            var.update $user_message_id {
              value = $log_resp.message_id
            }
          }
        }
      
        conditional {
          if ($user_message_id == null && $log_resp != null && ($log_resp|has:"message") && $log_resp.message != null) {
            conditional {
              if (($log_resp.message|has:"id") && $log_resp.message.id != null) {
                var.update $user_message_id {
                  value = $log_resp.message.id
                }
              }
            }
          }
        }
      
        conditional {
          if ($should_stop == false) {
            conditional {
              if ($user_message_id == null) {
                var.update $should_stop {
                  value = true
                }
              
                var.update $error_out {
                  value = {message: "user_message_id missing after log_message_dev"}
                }
              }
            }
          }
        }
      }
    }
  
    var $t_after_log {
      value = "now"|to_ms
    }
  
    // -----------------------------
    // 5) Parse intent
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        function.run "genie/fn_genie_parse_intent_dev" {
          input = {
            session_id     : $session_id
            user_message_id: $user_message_id
            city           : $city_norm
            message_text   : $msg_clean
          }
        } as $intent_resp
      
        var.update $intent_dev {
          value = $intent_resp
        }
      
        conditional {
          if ($intent_resp != null && ($intent_resp|has:"result") && $intent_resp.result != null) {
            var.update $intent_dev {
              value = $intent_resp.result
            }
          }
        }
      
        conditional {
          if ($intent_dev != null && ($intent_dev|has:"other_filters") && $intent_dev.other_filters != null) {
            var.update $safe_filters {
              value = $intent_dev.other_filters
            }
          }
        }
      }
    }
  
    // ── Event query mode detection ──────────────────────
    var $query_mode {
      value = "venue"
    }
  
    var $msg_lower_mode {
      value = ($msg_clean ?? "")|to_lower|trim
    }
  
    conditional {
      if (($msg_lower_mode|contains:"event") || ($msg_lower_mode|contains:"events") || ($msg_lower_mode|contains:"concert") || ($msg_lower_mode|contains:"concerts") || ($msg_lower_mode|contains:"show") || ($msg_lower_mode|contains:"shows") || ($msg_lower_mode|contains:"happening") || ($msg_lower_mode|contains:"what's going on") || ($msg_lower_mode|contains:"whats going on") || ($msg_lower_mode|contains:"things to do") || ($msg_lower_mode|contains:"live music") || ($msg_lower_mode|contains:"festival") || ($msg_lower_mode|contains:"this weekend") || ($msg_lower_mode|contains:"tonight") || ($msg_lower_mode|contains:"this week") || ($msg_lower_mode|contains:"watch party") || ($msg_lower_mode|contains:"tickets") || ($msg_lower_mode|contains:"performances")) {
        var.update $query_mode {
          value = "event"
        }
      }
    }
  
    // If event mode detected, query genie_social_events
    // instead of running the venue search path
    var $event_results {
      value = []
    }
  
    var $today_date {
      value = now|format_timestamp:"Y-m-d":"UTC"
    }
  
    conditional {
      if ($query_mode == "event" && $should_stop == false) {
        db.query genie_social_events {
          where = ($db.genie_social_events.city == "Houston" || $db.genie_social_events.city == "houston") && $db.genie_social_events.status == "active" && $db.genie_social_events.event_date >= $today_date
          sort = {event_date: "asc"}
          return = {type: "list", paging: {page: 1, per_page: 10}}
        } as $event_query_result
      
        conditional {
          if (($event_query_result != null) && (($event_query_result|has:"items") && (($event_query_result.items|count) > 0))) {
            var.update $event_results {
              value = $event_query_result.items
            }
          
            var.update $has_results {
              value = true
            }
          
            var.update $reply_mode {
              value = "has_results"
            }
          
            var.update $use_xano {
              value = true
            }
          
            var.update $final_reply {
              value = "Here are some events happening in Houston that match your vibe."
            }
          
            var.update $should_stop {
              value = true
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 5.1) Normalize meal services + cuisine tags
    // -----------------------------
    var $requested_meal_services {
      value = []
    }
  
    var $requested_cuisine_tags {
      value = []
    }
  
    conditional {
      if ($safe_filters != null && ($safe_filters|has:"type") && $safe_filters.type != null && ((($safe_filters.type|trim)|is_empty) == false)) {
        conditional {
          if ($safe_filters.type == "brunch") {
            var.update $requested_meal_services {
              value = $requested_meal_services|append:"brunch"
            }
          }
        }
      
        conditional {
          if ($safe_filters.type == "happy_hour") {
            var.update $requested_meal_services {
              value = $requested_meal_services|append:"happy_hour"
            }
          }
        }
      
        conditional {
          if ($safe_filters.type == "reverse_happy_hour") {
            var.update $requested_meal_services {
              value = $requested_meal_services|append:"reverse_happy_hour"
            }
          }
        }
      
        conditional {
          if ($safe_filters.type == "late_night") {
            var.update $requested_meal_services {
              value = $requested_meal_services|append:"late_night"
            }
          }
        }
      }
    }
  
    var $wants_brunch {
      value = false
    }
  
    var $wants_happy_hour {
      value = false
    }
  
    var $wants_reverse_happy_hour {
      value = false
    }
  
    var $wants_late_night {
      value = false
    }
  
    conditional {
      if (($requested_meal_services|count) > 0) {
        foreach ($requested_meal_services) {
          each as $ms_flag {
            conditional {
              if ($ms_flag == "brunch") {
                var.update $wants_brunch {
                  value = true
                }
              }
            }
          
            conditional {
              if ($ms_flag == "happy_hour") {
                var.update $wants_happy_hour {
                  value = true
                }
              }
            }
          
            conditional {
              if ($ms_flag == "reverse_happy_hour") {
                var.update $wants_reverse_happy_hour {
                  value = true
                }
              }
            }
          
            conditional {
              if ($ms_flag == "late_night") {
                var.update $wants_late_night {
                  value = true
                }
              }
            }
          }
        }
      }
    }
  
    var.update $detected_intent {
      value = "general"
    }
  
    conditional {
      if ($wants_brunch) {
        var.update $detected_intent {
          value = "brunch"
        }
      }
    }
  
    conditional {
      if ($wants_happy_hour) {
        var.update $detected_intent {
          value = "happy_hour"
        }
      }
    }
  
    conditional {
      if ($wants_late_night) {
        var.update $detected_intent {
          value = "late_night"
        }
      }
    }
  
    conditional {
      if ($safe_filters != null && ($safe_filters|has:"type")) {
        conditional {
          if ($safe_filters.type == "hookah") {
            var.update $detected_intent {
              value = "hookah"
            }
          }
        }
      
        conditional {
          if ($safe_filters.type == "patio") {
            var.update $detected_intent {
              value = "patio"
            }
          }
        }
      
        conditional {
          if ($safe_filters.type == "date_night") {
            var.update $detected_intent {
              value = "date_night"
            }
          }
        }
      
        conditional {
          if ($safe_filters.type == "dinner") {
            var.update $detected_intent {
              value = "dinner"
            }
          }
        }
      }
    }
  
    var $reply_mode_for_bank {
      value = "has_results"
    }
  
    conditional {
      if ($wants_near_me && $has_geo) {
        var.update $reply_mode_for_bank {
          value = "near_me"
        }
      }
    }
  
    conditional {
      if ($safe_filters != null && ($safe_filters|has:"cuisine") && $safe_filters.cuisine != null && ((($safe_filters.cuisine|trim)|is_empty) == false)) {
        conditional {
          if ($safe_filters.cuisine == "seafood") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"seafood"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "soul_food") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"soul_food"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "bbq") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"bbq"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "chinese") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"chinese"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "japanese") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"japanese"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "thai") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"thai"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "vietnamese") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"vietnamese"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "indian") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"indian"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "mediterranean") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"mediterranean"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "italian") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"italian"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "burgers") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"burgers"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "steakhouse") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"steakhouse"
            }
          }
        }
      
        conditional {
          if ($safe_filters.cuisine == "tex_mex") {
            var.update $requested_cuisine_tags {
              value = $requested_cuisine_tags|append:"tex_mex"
            }
          }
        }
      }
    }
  
    var $t_after_intent {
      value = "now"|to_ms
    }
  
    // ============================================================
    // 6) Venue candidates
    // ============================================================
    conditional {
      if ($should_stop == false && $city_supported && $city_id != null) {
        var $lat_min {
          value = null
        }
      
        var $lat_max {
          value = null
        }
      
        var $lng_min {
          value = null
        }
      
        var $lng_max {
          value = null
        }
      
        var $use_bbox {
          value = false
        }
      
        conditional {
          if ($has_geo && $lat_in != null && $lng_in != null && $radius_m != null) {
            var $lat_delta {
              value = ($radius_m|to_decimal) / 111000
            }
          
            var $lng_delta {
              value = ($radius_m|to_decimal) / 96500
            }
          
            var.update $lat_min {
              value = $lat_in - $lat_delta
            }
          
            var.update $lat_max {
              value = $lat_in + $lat_delta
            }
          
            var.update $lng_min {
              value = $lng_in - $lng_delta
            }
          
            var.update $lng_max {
              value = $lng_in + $lng_delta
            }
          
            var.update $use_bbox {
              value = true
            }
          }
        }
      
        var $ms_filter_val {
          value = null
        }
      
        conditional {
          if ($wants_brunch) {
            var.update $ms_filter_val {
              value = "brunch"
            }
          }
        }
      
        conditional {
          if ($wants_happy_hour) {
            var.update $ms_filter_val {
              value = "happy_hour"
            }
          }
        }
      
        conditional {
          if ($wants_late_night) {
            var.update $ms_filter_val {
              value = "late_night"
            }
          }
        }
      
        conditional {
          if ($wants_reverse_happy_hour) {
            var.update $ms_filter_val {
              value = "reverse_happy_hour"
            }
          }
        }
      
        // 6.1a bbox geo query
        conditional {
          if ($should_stop == false && $use_bbox) {
            db.query genie_venues {
              where = ($db.genie_venues.city_id == $city_id && $db.genie_venues.venue_name != null && $db.genie_venues.venue_name != "" && ($db.genie_venues.status == null || $db.genie_venues.status == "active") && $db.genie_venues.is_temporarily_closed != true && $db.genie_venues.is_permanently_closed != true && ($db.genie_venues.google_business_status == "OPERATIONAL" || $db.genie_venues.google_business_status == null || $db.genie_venues.google_business_status == "") && $db.genie_venues.latitude >= $lat_min && $db.genie_venues.latitude <= $lat_max && $db.genie_venues.longitude >= $lng_min && $db.genie_venues.longitude <= $lng_max)
              return = {type: "list", paging: {page: 1, per_page: 700}}
            } as $venue_candidates
          }
        }
      
        // 6.1b brunch
        conditional {
          if ($should_stop == false && $use_bbox == false && $wants_brunch) {
            db.query genie_venues {
              where = $db.genie_venues.city_id == $city_id && $db.genie_venues.venue_name != null && $db.genie_venues.venue_name != "" && ($db.genie_venues.status == null || $db.genie_venues.status == "active") && $db.genie_venues.is_temporarily_closed != true && $db.genie_venues.is_permanently_closed != true && ($db.genie_venues.google_business_status == "OPERATIONAL" || $db.genie_venues.google_business_status == null || $db.genie_venues.google_business_status == "") && $db.genie_venues.ms_brunch == true
              return = {type: "list", paging: {page: 1, per_page: 15}}
            } as $venue_candidates
          }
        }
      
        // 6.1b happy hour
        conditional {
          if ($should_stop == false && $use_bbox == false && $wants_happy_hour) {
            db.query genie_venues {
              where = $db.genie_venues.city_id == $city_id && $db.genie_venues.venue_name != null && $db.genie_venues.venue_name != "" && ($db.genie_venues.status == null || $db.genie_venues.status == "active") && $db.genie_venues.is_temporarily_closed != true && $db.genie_venues.is_permanently_closed != true && ($db.genie_venues.google_business_status == "OPERATIONAL" || $db.genie_venues.google_business_status == null || $db.genie_venues.google_business_status == "") && $db.genie_venues.ms_happy_hour == true
              return = {type: "list", paging: {page: 1, per_page: 15}}
            } as $venue_candidates
          }
        }
      
        // 6.1b late night
        conditional {
          if ($should_stop == false && $use_bbox == false && $wants_late_night) {
            db.query genie_venues {
              where = $db.genie_venues.city_id == $city_id && $db.genie_venues.venue_name != null && $db.genie_venues.venue_name != "" && ($db.genie_venues.status == null || $db.genie_venues.status == "active") && $db.genie_venues.is_temporarily_closed != true && $db.genie_venues.is_permanently_closed != true && ($db.genie_venues.google_business_status == "OPERATIONAL" || $db.genie_venues.google_business_status == null || $db.genie_venues.google_business_status == "") && $db.genie_venues.ms_late_night == true
              return = {type: "list", paging: {page: 1, per_page: 15}}
            } as $venue_candidates
          }
        }
      
        // 6.1b reverse happy hour
        conditional {
          if ($should_stop == false && $use_bbox == false && $wants_reverse_happy_hour) {
            db.query genie_venues {
              where = $db.genie_venues.city_id == $city_id && $db.genie_venues.venue_name != null && $db.genie_venues.venue_name != "" && ($db.genie_venues.status == null || $db.genie_venues.status == "active") && $db.genie_venues.is_temporarily_closed != true && $db.genie_venues.is_permanently_closed != true && ($db.genie_venues.google_business_status == "OPERATIONAL" || $db.genie_venues.google_business_status == null || $db.genie_venues.google_business_status == "") && $db.genie_venues.ms_reverse_happy_hour == true
              return = {type: "list", paging: {page: 1, per_page: 15}}
            } as $venue_candidates
          }
        }
      
        // 6.1b general
        conditional {
          if ($should_stop == false && $use_bbox == false && $wants_brunch == false && $wants_happy_hour == false && $wants_late_night == false && $wants_reverse_happy_hour == false) {
            db.query genie_venues {
              where = ($db.genie_venues.city_id == $city_id && $db.genie_venues.venue_name != null && $db.genie_venues.venue_name != "" && ($db.genie_venues.status == null || $db.genie_venues.status == "active") && $db.genie_venues.is_temporarily_closed == false && $db.genie_venues.is_permanently_closed == false && $db.genie_venues.google_business_status == "OPERATIONAL" && $db.genie_venues.is_open_now)
              return = {type: "list", paging: {page: 1, per_page: 15}}
            } as $venue_candidates
          }
        }
      
        // 6.2 Normalize
        conditional {
          if ($venue_candidates != null && ($venue_candidates|is_array)) {
            var.update $candidates_page {
              value = $venue_candidates
            }
          }
        }
      
        conditional {
          if (($candidates_page|count) == 0 && $venue_candidates != null && ($venue_candidates|has:"items")) {
            var.update $candidates_page {
              value = $venue_candidates.items
            }
          }
        }
      
        conditional {
          if ($candidates_page == null || ($candidates_page|is_array) == false) {
            var.update $candidates_page {
              value = []
            }
          }
        }
      
        var.update $candidates_total {
          value = $candidates_page|count
        }
      
        var $debug_first_venue {
          value = $candidates_page[0]
        }
      
        var $debug_first_ms {
          value = $candidates_page[0]|get:"meal_services":null
        }
      
        // Rotation
        var $pool_array {
          value = $candidates_page
        }
      
        var $pool_size {
          value = $pool_array|count
        }
      
        var $top_start {
          value = 0
        }
      
        conditional {
          if ($pool_size > 5) {
            var $offset {
              value = (($user_message_id|to_int) % ($pool_size - 3))
            }
          
            var.update $top_start {
              value = $offset
            }
          }
        }
      
        var $top_slice {
          value = []
        }
      
        var $more_slice {
          value = []
        }
      
        var $item_index {
          value = 0
        }
      
        foreach ($pool_array) {
          each as $pool_item {
            conditional {
              if ($item_index >= $top_start && $item_index < ($top_start + 3) && ($top_slice|count) < 3) {
                var.update $top_slice {
                  value = $top_slice|append:$pool_item
                }
              }
            }
          
            conditional {
              if (($item_index < $top_start || $item_index >= ($top_start + 3)) && ($more_slice|count) < 12) {
                var.update $more_slice {
                  value = $more_slice|append:$pool_item
                }
              }
            }
          
            var.update $item_index {
              value = $item_index + 1
            }
          }
        }
      
        var.update $more_nearby_candidates {
          value = $more_slice
        }
      
        // Single pass scoring
        var $unfiltered_rows {
          value = []
        }
      
        var $no_filtered_matches {
          value = false
        }
      
        var $exact_candidates {
          value = []
        }
      
        var $signal_candidates {
          value = []
        }
      
        var $fallback_service_candidates {
          value = []
        }
      
        var $filtered_candidates {
          value = []
        }
      
        var $selected_match_tier {
          value = "none"
        }
      
        var $has_requested_filters {
          value = false
        }
      
        conditional {
          if (($requested_meal_services|count) > 0 || ($requested_cuisine_tags|count) > 0) {
            var.update $has_requested_filters {
              value = true
            }
          }
        }
      
        var $service_result_target {
          value = 10
        }
      
        foreach ($candidates_page) {
          each as $v {
            var $is_eligible {
              value = true
            }
          
            conditional {
              if ($v.google_business_status == "CLOSED_PERMANENTLY") {
                var.update $is_eligible {
                  value = false
                }
              }
            }
          
            var $types_raw {
              value = $v|get:"google_types":[]
            }
          
            conditional {
              if ($types_raw != null && ($types_raw|is_array)) {
                foreach ($types_raw) {
                  each as $gt {
                    conditional {
                      if ($gt == "lodging" || $gt == "hotel" || $gt == "motel" || $gt == "resort_hotel") {
                        var.update $is_eligible {
                          value = false
                        }
                      }
                    }
                  }
                }
              }
            }
          
            conditional {
              if ($is_eligible) {
                var $profile_bonus {
                  value = 0
                }
              
                var $v_cuisine_tags {
                  value = $v|get:"cuisine_tags":null
                }
              
                // FIX 1: Full profile scoring via helper (music, atmosphere, experiences, community, price)
                conditional {
                  if ($social_profile != null && $social_signal_count >= 1) {
                    function.run "genie/fn_genie_profile_score_venue_dev" {
                      input = {
                        venue              : $v
                        social_music       : $social_music
                        social_atmosphere  : $social_atmosphere
                        social_experiences : $social_experiences
                        social_community   : $social_community
                        social_bevy_bites  : $social_bevy_bites
                        social_price_range : $social_price_range
                        social_signal_count: $social_signal_count
                      }
                    } as $profile_score_resp
                  
                    conditional {
                      if ($profile_score_resp != null && ($profile_score_resp|has:"profile_bonus")) {
                        var.update $profile_bonus {
                          value = $profile_score_resp.profile_bonus
                        }
                      }
                    }
                  }
                }
              
                conditional {
                  if ($detected_language != "en" && $detected_language != "english" && $v.vibe_notes != null && (($v.vibe_notes|trim)|is_empty) == false) {
                    function.run "genie/fn_genie_translate_dev" {
                      input = {
                        text_to_translate: $v.vibe_notes
                        target_language  : $detected_language
                      }
                    } as $vibe_translation
                  
                    conditional {
                      if ($vibe_translation != null && ($vibe_translation|has:"translated_text") && $vibe_translation.translated_text != null) {
                        var.update $v {
                          value = $v
                            |merge:{vibe_notes: $vibe_translation.translated_text}
                        }
                      }
                    }
                  }
                }
              
                var $row_entry {
                  value = {
                    venue        : $v
                    dist_m       : null
                    profile_bonus: $profile_bonus
                    tier         : "exact"
                  }
                }
              
                var.update $exact_rows {
                  value = $exact_rows|append:$row_entry
                }
              }
            }
          }
        }
      
        // Blend tiers
        var $blended_rows {
          value = []
        }
      
        conditional {
          if (($exact_rows|count) > 0) {
            foreach ($exact_rows) {
              each as $er {
                var.update $blended_rows {
                  value = $blended_rows|append:$er
                }
              }
            }
          
            var.update $selected_match_tier {
              value = "exact"
            }
          }
        }
      
        conditional {
          if (($blended_rows|count) < $service_result_target && ($signal_rows|count) > 0) {
            foreach ($signal_rows) {
              each as $sr {
                var.update $blended_rows {
                  value = $blended_rows|append:$sr
                }
              }
            }
          }
        }
      
        conditional {
          if (($blended_rows|count) < $service_result_target && ($fallback_rows|count) > 0) {
            foreach ($fallback_rows) {
              each as $fr {
                var.update $blended_rows {
                  value = $blended_rows|append:$fr
                }
              }
            }
          }
        }
      
        conditional {
          if ($has_requested_filters == false && ($blended_rows|count) == 0) {
            foreach ($unfiltered_rows) {
              each as $uf {
                var.update $blended_rows {
                  value = $blended_rows|append:$uf
                }
              }
            }
          
            var.update $selected_match_tier {
              value = "unfiltered"
            }
          }
        }
      
        conditional {
          if ($has_requested_filters && ($blended_rows|count) == 0) {
            var.update $no_filtered_matches {
              value = true
            }
          }
        }
      
        conditional {
          if ($no_filtered_matches) {
            var.update $closest_venues_final {
              value = []
            }
          
            var.update $venue_results_dev {
              value = []
            }
          
            var.update $venues_found {
              value = 0
            }
          
            var.update $has_results {
              value = false
            }
          
            var.update $reply_mode {
              value = "supported_no_results"
            }
          
            var.update $use_xano {
              value = false
            }
          }
        }
      
        var $no_nearby_in_radius {
          value = false
        }
      
        var $used_fallback {
          value = false
        }
      
        conditional {
          if ($has_geo && ($blended_rows|count) == 0 && $no_filtered_matches == false) {
            var.update $no_nearby_in_radius {
              value = true
            }
          }
        }
      
        // Sort by rating
        var $sorted_blended {
          value = []
        }
      
        var $high_rated {
          value = []
        }
      
        var $standard_rated {
          value = []
        }
      
        foreach ($blended_rows) {
          each as $br {
            var $br_rating {
              value = $br
                |get:"venue":{}
                |get:"google_rating":0
            }
          
            conditional {
              if ($br_rating != null && ($br_rating|to_decimal) >= 4.5) {
                var.update $high_rated {
                  value = $high_rated|append:$br
                }
              }
            }
          
            conditional {
              if ($br_rating == null || ($br_rating|to_decimal) < 4.5) {
                var.update $standard_rated {
                  value = $standard_rated|append:$br
                }
              }
            }
          }
        }
      
        foreach ($high_rated) {
          each as $hr {
            var.update $sorted_blended {
              value = $sorted_blended|append:$hr
            }
          }
        }
      
        foreach ($standard_rated) {
          each as $sr {
            var.update $sorted_blended {
              value = $sorted_blended|append:$sr
            }
          }
        }
      
        var.update $blended_rows {
          value = $sorted_blended
        }
      
        // Cap to max_take
        conditional {
          if ($no_filtered_matches == false && $no_nearby_in_radius == false) {
            foreach ($blended_rows) {
              each as $br {
                conditional {
                  if ($cap_i < $max_take) {
                    var.update $closest_venues_final {
                      value = $closest_venues_final|append:$br.venue
                    }
                  
                    var.update $cap_i {
                      value = $cap_i + 1
                    }
                  }
                }
              }
            }
          }
        }
      
        conditional {
          if (($closest_venues_final|count) > 0) {
            var.update $venue_results_dev {
              value = $closest_venues_final
            }
          
            var.update $venues_found {
              value = $venue_results_dev|count
            }
          
            var.update $has_results {
              value = true
            }
          
            var.update $reply_mode {
              value = "has_results"
            }
          
            var.update $use_xano {
              value = true
            }
          
            function.run "genie/fn_genie_get_reply_dev" {
              input = {
                intent    : $detected_intent
                reply_mode: $reply_mode_for_bank
              }
            } as $reply_bank_result
          
            var.update $final_reply {
              value = $reply_bank_result
            }
          }
        }
      
        conditional {
          if (($top_slice|count) > 0) {
            var.update $venue_results_dev {
              value = $top_slice
            }
          }
        }
      
        // Wrapper (disabled)
        conditional {
          if ($has_results && (($closest_venues_final|count) > 0)) {
            function.run "genie/fn_genie_ranked_venue_search_wrapped_dev" {
              input = {
                results         : $closest_venues_final
                city_context    : $city_norm
                limit           : 15
                debug           : false
                bypass_hydration: true
              }
            } as $wrap_resp
          }
        }
      
        conditional {
          if ($has_results && (($closest_venues_final|count) > 0)) {
            var.update $venue_results_dev {
              value = $wrap_resp.venues
            }
          
            var.update $venues_found {
              value = $venue_results_dev|count
            }
          }
        }
      
        var.update $has_results {
          value = (($venue_results_dev != null) && ($venue_results_dev|is_array) && (($venue_results_dev|count) > 0))
        }
      
        conditional {
          if ($no_nearby_in_radius) {
            var.update $has_results {
              value = false
            }
          
            var.update $venue_results_dev {
              value = []
            }
          
            var.update $reply_mode {
              value = "supported_no_results"
            }
          
            var.update $use_xano {
              value = false
            }
          }
        }
      
        conditional {
          if ($has_results) {
            var.update $reply_mode {
              value = "has_results"
            }
          
            var.update $use_xano {
              value = true
            }
          
            function.run "genie/fn_genie_get_reply_dev" {
              input = {
                intent    : $detected_intent
                reply_mode: $reply_mode_for_bank
              }
            } as $reply_bank_result
          
            var.update $final_reply {
              value = $reply_bank_result
            }
          
            var.update $venues_text {
              value = ""
            }
          
            var.update $venues_text_len {
              value = 0
            }
          }
        }
      
        conditional {
          if ($detected_language != "en" && $detected_language != "english" && $final_reply != null && (($final_reply|trim)|is_empty) == false) {
            function.run "genie/fn_genie_translate_dev" {
              input = {
                text_to_translate: $final_reply
                target_language  : $detected_language
              }
            } as $reply_translation
          
            conditional {
              if ($reply_translation != null && ($reply_translation|has:"translated_text") && $reply_translation.translated_text != null) {
                var.update $final_reply {
                  value = $reply_translation.translated_text
                }
              }
            }
          }
        }
      
        // Zero results fallback
        conditional {
          if ($has_results == false) {
            conditional {
              if ($city_supported && $city_id != null) {
                var.update $reply_mode {
                  value = "zero_results_fallback"
                }
              
                db.query genie_venues {
                  where = $db.genie_venues.city_id == $city_id && ($db.genie_venues.status == "active" || $db.genie_venues.status == null) && $db.genie_venues.is_temporarily_closed != true && $db.genie_venues.is_permanently_closed != true && ($db.genie_venues.google_business_status == "OPERATIONAL" || $db.genie_venues.google_business_status == null || $db.genie_venues.google_business_status == "")
                  sort = {social_energy_score: "desc"}
                  return = {type: "list", paging: {page: 1, per_page: 5}}
                } as $zero_fallback_result
              
                var.update $venue_results_dev {
                  value = $zero_fallback_result.items
                }
              
                var.update $has_results {
                  value = true
                }
              
                var.update $use_xano {
                  value = true
                }
              
                var.update $final_reply {
                  value = "I couldn't find an exact match for that — here are some popular spots in Houston you might love."
                }
              }
            
              else {
                var.update $reply_mode {
                  value = "supported_no_results"
                }
              
                var.update $use_xano {
                  value = false
                }
              }
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 6.9) AI gate
    // -----------------------------
    conditional {
      if ($should_stop == false) {
        var.update $allow_ai {
          value = false
        }
      
        conditional {
          if ($force_ai) {
            var.update $allow_ai {
              value = true
            }
          }
        }
      }
    }
  
    var $t_after_venues {
      value = "now"|to_ms
    }
  
    // ============================================================
    // 7) AI fallback
    // ============================================================
    conditional {
      if ($should_stop == false && $allow_ai) {
        var.update $ai_call_log {
          value = {
            source             : "fn_genie_handle_message_dev"
            reason             : "ai_fallback"
            city               : $city_norm
            city_id            : $city_id
            user_id            : $user_id
            session_id         : $session_id
            user_message_id    : $user_message_id
            candidates_count   : (($venue_candidates|is_array) ? ($venue_candidates|count) : 0)
            venue_results_cnt  : (($venue_results_dev|is_array) ? ($venue_results_dev|count) : 0)
            has_results        : $has_results
            use_xano           : $use_xano
            reply_mode         : $reply_mode
            no_city_data       : $no_city_data
            no_nearby_in_radius: $no_nearby_in_radius
          }
        }
      
        function.run "genie/fn_genie_build_ai_payload_dev" {
          input = {
            user_message_text: $msg_clean
            session_id       : $session_id
            user_message_id  : $user_message_id
            intent_dev       : $intent_dev
            has_results      : $has_results
            city_context     : $city_norm
            venue_results_dev: $venue_results_dev
            reply_mode       : $reply_mode
            detected_language: $detected_language
            lat              : $lat_in
            lng              : $lng_in
          }
        } as $ai_payload_resp
      
        conditional {
          if ($ai_payload_resp != null && ($ai_payload_resp|has:"messages") && ($ai_payload_resp.messages|is_array)) {
            var.update $ai_payload_dev {
              value = $ai_payload_resp
            }
          }
        }
      
        conditional {
          if ($ai_payload_dev == null) {
            var.update $ai_payload_dev {
              value = {messages: [], metadata: {}}
            }
          }
        }
      
        function.run "genie/fn_genie_call_ai_dev" {
          input = {ai_payload: $ai_payload_dev}
        } as $ai_reply_resp
      
        conditional {
          if ($ai_reply_resp != null && ($ai_reply_resp|has:"assistant_reply") && $ai_reply_resp.assistant_reply != null && ((($ai_reply_resp.assistant_reply|trim)|is_empty) == false)) {
            var.update $final_reply {
              value = $ai_reply_resp.assistant_reply
            }
          
            var.update $use_xano {
              value = false
            }
          
            conditional {
              if ($city_missing) {
                var.update $reply_mode {
                  value = "city_missing"
                }
              
                var.update $final_reply {
                  value = "Which city should I search for you?"
                }
              
                var.update $use_xano {
                  value = false
                }
              }
            }
          
            conditional {
              if ($city_missing == false && $has_results) {
                var.update $reply_mode {
                  value = "has_results"
                }
              
                function.run "genie/fn_genie_get_reply_dev" {
                  input = {
                    intent    : $detected_intent
                    reply_mode: $reply_mode_for_bank
                  }
                } as $reply_bank_result
              
                var.update $final_reply {
                  value = $reply_bank_result
                }
              
                var.update $use_xano {
                  value = true
                }
              }
            }
          
            conditional {
              if ($city_missing == false && $city_supported && ($has_results == false)) {
                var.update $reply_mode {
                  value = "supported_no_results"
                }
              
                var.update $use_xano {
                  value = false
                }
              }
            }
          
            conditional {
              if ($city_missing == false && ($city_supported == false)) {
                var.update $reply_mode {
                  value = "city_unsupported"
                }
              
                var.update $use_xano {
                  value = false
                }
              }
            }
          
            conditional {
              if (((($final_reply|trim)|is_empty) == false)) {
                var.update $venues_text_len {
                  value = $final_reply|strlen
                }
              }
            }
          }
        }
      }
    }
  
    conditional {
      if ($has_results == false) {
        var.update $use_xano {
          value = false
        }
      }
    }
  
    conditional {
      if ($final_reply == null || ($final_reply|trim)|is_empty) {
        conditional {
          if ($reply_mode == "city_missing") {
            var.update $final_reply {
              value = "Which city should I search for you?"
            }
          }
        }
      
        conditional {
          if ($reply_mode == "city_unsupported") {
            function.run "genie/fn_genie_get_reply_dev" {
              input = {intent: $detected_intent, reply_mode: "ai_fallback"}
            } as $reply_bank_result
          
            var.update $final_reply {
              value = $reply_bank_result
            }
          }
        }
      
        conditional {
          if ($final_reply == null || ($final_reply|trim)|is_empty) {
            function.run "genie/fn_genie_get_reply_dev" {
              input = {intent: $detected_intent, reply_mode: "ai_fallback"}
            } as $reply_bank_result
          
            var.update $final_reply {
              value = $reply_bank_result
            }
          }
        }
      
        conditional {
          if ($detected_language != "en" && $detected_language != "english" && $final_reply != null && (($final_reply|trim)|is_empty) == false) {
            function.run "genie/fn_genie_translate_dev" {
              input = {
                text_to_translate: $final_reply
                target_language  : $detected_language
              }
            } as $city_missing_translation
          
            conditional {
              if ($city_missing_translation != null && ($city_missing_translation|has:"translated_text") && $city_missing_translation.translated_text != null) {
                var.update $final_reply {
                  value = $city_missing_translation.translated_text
                }
              }
            }
          }
        }
      
        var.update $use_xano {
          value = false
        }
      }
    }
  
    var.update $use_xano {
      value = ($reply_mode == "has_results")
    }
  
    var $debug_exact_count {
      value = $exact_rows|count
    }
  
    var $debug_signal_count {
      value = $signal_rows|count
    }
  
    var $debug_fallback_count {
      value = $fallback_rows|count
    }
  
    var $t_user_ms {
      value = $t_after_user - $t_start
    }
  
    var $t_session_ms {
      value = $t_after_session - $t_after_user
    }
  
    var $t_log_ms {
      value = $t_after_log - $t_after_session
    }
  
    var $t_intent_ms {
      value = $t_after_intent - $t_after_log
    }
  
    var $t_venues_ms {
      value = $t_after_venues - $t_after_intent
    }
  
    var $t_total_ms {
      value = $t_after_venues - $t_start
    }
  
    var $query_category {
      value = "general"
    }
  
    conditional {
      if (($input.message|to_lower|contains:"watch") || (($input.message|to_lower|contains:"match") || (($input.message|to_lower|contains:"fifa") || (($input.message|to_lower|contains:"world cup") || ($input.message|to_lower|contains:"game"))))) {
        var.update $query_category {
          value = "world_cup"
        }
      }
    }
  
    conditional {
      if (($query_category == "general") && (($input.message|to_lower|contains:"restaurant") || (($input.message|to_lower|contains:"eat") || (($input.message|to_lower|contains:"food") || (($input.message|to_lower|contains:"brunch") || (($input.message|to_lower|contains:"dinner") || ($input.message|to_lower|contains:"lunch"))))))) {
        var.update $query_category {
          value = "dining"
        }
      }
    }
  
    conditional {
      if (($query_category == "general") && (($input.message|to_lower|contains:"bar") || (($input.message|to_lower|contains:"club") || (($input.message|to_lower|contains:"nightlife") || (($input.message|to_lower|contains:"drinks") || ($input.message|to_lower|contains:"late night")))))) {
        var.update $query_category {
          value = "nightlife"
        }
      }
    }
  
    conditional {
      if (($query_category == "general") && (($input.message|to_lower|contains:"event") || (($input.message|to_lower|contains:"concert") || (($input.message|to_lower|contains:"show") || ($input.message|to_lower|contains:"tonight"))))) {
        var.update $query_category {
          value = "event_discovery"
        }
      }
    }
  
    conditional {
      if (($query_category == "general") && (($input.message|to_lower|contains:"near me") || (($input.message|to_lower|contains:"nearby") || ($input.message|to_lower|contains:"close to")))) {
        var.update $query_category {
          value = "venue_discovery"
        }
      }
    }
  
    conditional {
      if (($query_category == "general") && (($input.message|to_lower|contains:"directions") || (($input.message|to_lower|contains:"how do i get") || ($input.message|to_lower|contains:"uber")))) {
        var.update $query_category {
          value = "directions"
        }
      }
    }
  
    conditional {
      if (($query_category == "general") && (($input.message|to_lower|contains:"midtown") || (($input.message|to_lower|contains:"downtown") || (($input.message|to_lower|contains:"montrose") || (($input.message|to_lower|contains:"heights") || (($input.message|to_lower|contains:"eado") || (($input.message|to_lower|contains:"galleria") || (($input.message|to_lower|contains:"museum district") || ($input.message|to_lower|contains:"third ward"))))))))) {
        var.update $query_category {
          value = "neighborhood"
        }
      }
    }
  
    var $is_worldcup_window_qlog {
      value = false
    }
  
    var $now_date_qlog {
      value = now|format_timestamp:"Y-m-d":"UTC"
    }
  
    conditional {
      if (($now_date_qlog >= "2026-06-14") && ($now_date_qlog <= "2026-07-19")) {
        var.update $is_worldcup_window_qlog {
          value = true
        }
      }
    }
  
    db.add genie_query_log {
      enforce_hidden_fields = false
      data = {
        session_id           : ($input.session_id ?? "")
        user_id              : ($user_id ?? 0)|to_int
        query_text           : ($input.message ?? "")
        query_language       : ($input.detected_language ?? "en")
        query_category       : $query_category
        neighborhood_queried : ($city_norm ?? "Houston")
        venue_returned       : ((($venue_results_dev ?? [])|count) > 0)
        venues_returned_count: (($venue_results_dev ?? [])|count)
        is_worldcup_window   : ($is_worldcup_window_qlog ?? false)
        acquisition_source   : (($session_obj|get:"acquisition_source":"") ?? "")
        nearest_match_id     : (($session_obj|get:"nearest_match_id":null)|to_int)
        created_at           : now|to_ms
      }
    } as $qlog_entry
  
    // FIX 3: Write behavioral signal to genie_behavior_signals for learning loop
    function.run "genie/fn_genie_write_behavior_signal_dev" {
      input = {
        user_id         : ($user_id ?? 0)|to_int
        external_user_id: ($external_user_id_final ?? "")
        message_text    : ($msg_clean ?? "")
        city            : ($city_norm ?? "Houston")
        query_mode      : ($query_mode ?? "venue")
        detected_intent : ($detected_intent ?? "general")
        query_category  : ($query_category ?? "general")
        session_id      : ($session_id ?? ""|to_text)
      }
    } as $behavior_signal_resp
  
    debug.log {
      value = {
        checkpoint         : "CORE_ENGINE_FINAL_STATE"
        final_reply        : $final_reply
        reply_mode         : $reply_mode
        use_xano           : $use_xano
        should_stop        : $should_stop
        error_out          : $error_out
        venues_found       : $venues_found
        venue_results_count: ($venue_results_dev ?? [])|count
        event_results_count: ($event_results ?? [])|count
      }
    }
  }

  response = {
    reply                : $final_reply
    use_xano             : $use_xano
    reply_mode           : $reply_mode
    query_mode           : $query_mode
    venues               : $venue_results_dev
    events               : $event_results
    needs_location       : $needs_location
    filters              : $safe_filters
    profile_prompt       : $profile_prompt
    show_intake_prompt   : $show_intake_prompt
    intake_prompt_copy   : $intake_prompt_copy
    profile_strength_tier: $profile_strength_tier
    session_id           : $session_id_out
    session_token        : $session_token_out
    debug_first_ms       : $debug_first_ms
    error                : $error_out
    t_user_ms            : $t_user_ms
    t_session_ms         : $t_session_ms
    t_log_ms             : $t_log_ms
    t_intent_ms          : $t_intent_ms
    t_venues_ms          : $t_venues_ms
    t_total_ms           : $t_total_ms
    more_nearby_venues   : $more_nearby_candidates
    debug                : ```
      {
        city                 : $city_name_match
        city_norm            : $city_norm
        city_id              : $city_id
        city_supported       : $city_supported
        reply_mode           : $reply_mode
        venues_found         : $venues_found
        venues_text_len      : $venues_text_len
        should_stop          : $should_stop
        user_id              : $user_id
        session_id           : $session_id
        user_message_id      : $user_message_id
        exact_rows_count     : (($exact_rows ?? [])|count)
        signal_rows_count    : (($signal_rows ?? [])|count)
        fallback_rows_count  : (($fallback_rows ?? [])|count)
        ai_call_log          : ($ai_call_log ?? [])
        allow_ai             : ($allow_ai ?? false)
        force_ai             : ($force_ai ?? false)
        no_filtered_matches  : ($no_filtered_matches ?? false)
        candidates_total     : ($candidates_total ?? 0)
        closest_rows_count   : (($closest_rows ?? [])|count)
        closest_venues_count : (($closest_venues ?? [])|count)
        closest_final_count  : (($closest_venues_final ?? [])|count)
      }
      ```
  }
}
