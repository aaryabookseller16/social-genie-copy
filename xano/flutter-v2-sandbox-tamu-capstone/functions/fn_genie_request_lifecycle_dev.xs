// GEN-072: lifecycle-only replacement for the non-venue part of fn_genie_handle_message_dev,
// used by the v2 venue branch so a venue turn no longer runs the legacy venue query/scoring stage.
// Does: identify user (this also ensures the profile row), read the social profile for the intake
// prompt and profile tier, get or create the session, log the user message, and extract keyword
// filters (rules only: no AI call and no genie_intent_snapshot write).
// Does NOT: query or score venues, parse intent with AI, write genie_query_log or behavior signals
// (see fn_genie_log_turn_analytics_dev, called once the result count is known).
// Never throws: a failure is returned in `error` with ok=false, so the caller can still search.
function "genie/fn_genie_request_lifecycle_dev" {
  input {
    // The user's message
    text message

    // The messaging channel
    text channel?

    // The unique identifier for the user on the channel
    text external_user_id?

    // The user's display name
    text user_name?

    // The resolved city name, saved on a new session
    text city_name?

    // The session token if available
    text? session_token? filters=trim
  }

  stack {
    var $t_start {
      value = "now"|to_ms
    }

    var $t_mark {
      value = $t_start
    }

    var $t_user_ms {
      value = 0
    }

    var $t_session_ms {
      value = 0
    }

    var $t_log_ms {
      value = 0
    }

    var $channel_safe {
      value = "test"
    }

    var $ext_id {
      value = ($input.external_user_id ?? "")|trim
    }

    var $user_id {
      value = null
    }

    var $session_id {
      value = null
    }

    var $session_token_out {
      value = null
    }

    var $session_row {
      value = null
    }

    var $user_message_id {
      value = null
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

    var $rules_filters {
      value = {}
    }

    var $error_out {
      value = null
    }

    conditional {
      if ((($input.channel ?? "")|trim) != "") {
        var.update $channel_safe {
          value = ($input.channel ?? "")|trim
        }
      }
    }

    try_catch {
      try {
        // 1) Identify user. Also creates the genie_user_profile row when missing. An empty
        // external_user_id is reported as an error and never sent to identify_user_dev.
        conditional {
          if ($ext_id == "") {
            var.update $error_out {
              value = {message: "external_user_id is required"}
            }
          }
        
          else {
            function.run "genie/fn_genie_identify_user_dev" {
              input = {
                channel         : $channel_safe
                external_user_id: $ext_id
                display_name    : ($input.user_name ?? "")
                avatar_url      : ""
                context         : {source: $channel_safe}
              }
            } as $user_resp
          
            var.update $user_id {
              value = $user_resp|get:"user_id":null
            }
          
            conditional {
              if ($user_id == null) {
                var.update $error_out {
                  value = {message: "user_id missing after identify_user_dev"}
                }
              }
            }
          }
        }

        // 2) Social profile: only for the intake prompt and the profile strength tier.
        conditional {
          if ($ext_id != "") {
            db.query genie_user_social_profile {
              where = $db.genie_user_social_profile.external_user_id == $ext_id
              return = {type: "list", paging: {page: 1, per_page: 1}}
            } as $sp_list

            var $sp_row {
              value = ($sp_list|get:"items":[])|first
            }

            conditional {
              if ((($sp_row|get:"id":0)|to_int) != 0) {
                var $intake_done {
                  value = $sp_row|get:"intake_completed":false
                }

                var $intake_shown {
                  value = $sp_row|get:"intake_shown_count":0
                }

                var $sig_ct {
                  value = $sp_row|get:"signal_count":0
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

        var.update $t_user_ms {
          value = ("now"|to_ms) - $t_mark
        }

        var.update $t_mark {
          value = "now"|to_ms
        }

        // 3) Get or create the session.
        conditional {
          if ($user_id != null) {
            function.run "genie/fn_genie_get_or_create_session_dev" {
              input = {
                user_id          : $user_id
                channel          : $channel_safe
                entry_point      : ""
                entry_context_id : ""
                city_from_context: ($input.city_name ?? "")
                context          : {}
                session_token    : $input.session_token
              }
            } as $sess_resp

            var.update $session_id {
              value = $sess_resp|get:"session_id":null
            }

            var.update $session_token_out {
              value = $sess_resp|get:"session_token":null
            }

            var.update $session_row {
              value = $sess_resp|get:"session":null
            }

            conditional {
              if ($session_id == null) {
                var.update $error_out {
                  value = {
                    message: "session_id missing after get_or_create_session_dev"
                  }
                }
              }
            }
          }
        }

        var.update $t_session_ms {
          value = ("now"|to_ms) - $t_mark
        }

        var.update $t_mark {
          value = "now"|to_ms
        }

        // 4) Log the user message.
        conditional {
          if ($session_id != null) {
            function.run "genie/fn_genie_log_message_dev" {
              input = {
                session_id  : $session_id
                sender_type : "user"
                message_text: $input.message
                raw_payload : {}
              }
            } as $log_resp

            var.update $user_message_id {
              value = $log_resp|get:"message_id":null
            }
          }
        }

        var.update $t_log_ms {
          value = ("now"|to_ms) - $t_mark
        }

        // 5) Keyword filters (rules only), the same rules and normalized values that
        // fn_genie_parse_intent_dev used before it asked the model. Later rules win, so
        // "reverse happy hour" overrides "happy hour".
        var $msg_l {
          value = ($input.message ?? "")|to_lower
        }

        var $rules {
          value = [
            {patch: {type: "happy_hour"}, terms: ["happy hour", "happyhour"]}
            {patch: {type: "reverse_happy_hour"}, terms: ["reverse happy hour", "reverse-happy-hour"]}
            {patch: {type: "brunch"}, terms: ["brunch"]}
            {patch: {type: "late_night"}, terms: ["late night", "late-night"]}
            {patch: {cuisine: "seafood"}, terms: ["seafood"]}
            {patch: {cuisine: "soul_food"}, terms: ["soul food"]}
            {patch: {cuisine: "bbq"}, terms: ["bbq", "barbecue"]}
            {patch: {cuisine: "chinese"}, terms: ["chinese"]}
            {patch: {cuisine: "japanese"}, terms: ["japanese", "sushi", "ramen"]}
            {patch: {cuisine: "thai"}, terms: ["thai"]}
            {patch: {cuisine: "vietnamese"}, terms: ["vietnamese", "pho"]}
            {patch: {cuisine: "indian"}, terms: ["indian"]}
            {patch: {cuisine: "mediterranean"}, terms: ["mediterranean", "greek"]}
            {patch: {cuisine: "italian"}, terms: ["italian", "pizza"]}
            {patch: {cuisine: "burgers"}, terms: ["burger"]}
            {patch: {cuisine: "steakhouse"}, terms: ["steakhouse", "steak"]}
            {patch: {cuisine: "tex_mex"}, terms: ["tex-mex", "tex mex"]}
            {patch: {venue_type: "rooftop"}, terms: ["rooftop"]}
            {patch: {venue_type: "sports_bar"}, terms: ["sports bar"]}
            {patch: {occasion: "date_night"}, terms: ["date night"]}
            {patch: {vibe: "cigar"}, terms: ["cigar"]}
          ]
        }

        foreach ($rules) {
          each as $rule {
            foreach ($rule.terms) {
              each as $term {
                conditional {
                  if ($msg_l|contains:$term) {
                    var.update $rules_filters {
                      value = $rules_filters|merge:$rule.patch
                    }
                  }
                }
              }
            }
          }
        }
      }

      catch {
        var.update $error_out {
          value = {message: "lifecycle_exception", code: $error.code, detail: $error.message}
        }
      }
    }

    var $ok {
      value = ($error_out == null) && ($user_id != null) && ($session_id != null)
    }
  }

  response = {
    ok                   : $ok
    user_id              : $user_id
    session_id           : $session_id
    session_token        : $session_token_out
    user_message_id      : $user_message_id
    show_intake_prompt   : $show_intake_prompt
    intake_prompt_copy   : $intake_prompt_copy
    profile_strength_tier: $profile_strength_tier
    rules_filters        : $rules_filters
    session_meta         : {
      acquisition_source: $session_row|get:"acquisition_source":""
      nearest_match_id  : $session_row|get:"nearest_match_id":null
    }
    error                : $error_out
    t_user_ms            : $t_user_ms
    t_session_ms         : $t_session_ms
    t_log_ms             : $t_log_ms
    t_total_ms           : ("now"|to_ms) - $t_start
  }
}
