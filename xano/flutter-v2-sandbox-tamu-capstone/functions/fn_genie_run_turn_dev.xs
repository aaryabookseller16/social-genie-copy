// Runs one venue-picking model turn: prepares candidates and prompts, calls the model, validates picks, and orders venues.
// On failure, returns the original venue list and a failure reason so the caller can preserve its response.
// Conversation v1:
// - history ([{role, content}] from fn_genie_load_conversation_dev) goes between the system prompt
//   and the current user message, so the model sees the conversation.
// - prompt_type "pick" (new request, default) keeps the old contract: intro + exactly 3 picks,
//   composed into the numbered reply.
// - prompt_type "converse" (follow-up): venues and events already shown are the candidates,
//   the validator runs in "followup" mode (0-3 picks), the reply is the model's own text (not the numbered list), and no
//   candidates is fine (plain chat).
function "genie/fn_genie_run_turn_dev" {
  input {
    // The user's message for this turn
    text message

    // Ranked venue rows in display order (only their ids are used)
    json venues

    // Resolved city name (not the raw client string)
    text city?

    // Local date/time text and weather text for the prompt (both optional)
    text now_text?

    text weather_text?

    // How well the shortlist fits the request: strong | loose | empty | unknown
    text match_quality?

    // Model options (defaults: gpt-4o, 800 tokens, 30s)
    text model?

    int timeout?
    int max_tokens?

    // How many candidates the model sees (default 10)
    int max_candidates?

    // Prompt type for the shared prompt module: "pick" (default) or "converse"
    text prompt_type?

    // Conversation v1: earlier messages as chat messages [{role: "user"|"assistant", content}]
    json history?

    // Conversation v1: saved preferences as text
    text user_context?

    // Conversation v1: earlier requests with their numbered picks
    text conversation_text?

    // Conversation v1: which request the follow-up is most likely about, e.g. "2"
    text turn_note?

    // Conversation v1: genie_social_events rows the model may talk about (converse only)
    json event_rows?

    // GEN-073: model-ready venues from fn_genie_search_venues_dev (its "venues", same order as
    // `venues`). When given they are the candidates, so the search's matches and distance reach
    // the model and the venues are not loaded and formatted a second time.
    json model_candidates?

    // GEN-073: what the search understood and relaxed, as plain text for the pick prompt
    text search_summary?

    // GEN-073: sampling temperature (default 0.3: picks and wording should be consistent)
    decimal? temperature?

    // GEN-073: language code of the user's message from the filter step (e.g. "es"), so the
    // reply language does not drift toward the English data
    text reply_language?

    // GEN-073: "omit" when the request does not ask about time (now, tonight, open...): the pick
    // prompt then gets no open_now / today_hours. Empty keeps the hours. Text, not bool: Xano
    // treats a false sent to a nullable bool as not sent.
    text hours_mode?

    // GEN-073: {venue_id: matches} saved from the request turn that showed these venues
    // ({"123": ["karaoke: in 3 reviews"]}). A follow-up runs no search, so this is how its
    // reloaded candidates get the same match notes the pick saw.
    json venue_matches?
  }

  stack {
    var $used {
      value = false
    }

    var $reply {
      value = null
    }

    var $pick_reasons {
      value = []
    }

    var $picked_ids {
      value = []
    }

    var $picked_event_ids {
      value = []
    }

    var $ordered_venues {
      value = $input.venues|safe_array
    }

    var $candidate_count {
      value = 0
    }

    var $fail_reason {
      value = null
    }

    var $latency_ms {
      value = 0
    }

    var $prompt_version {
      value = null
    }

    var $reason_flags {
      value = []
    }

    var $model {
      value = $input.model|first_notempty:"gpt-4o"
    }

    var $prompt_type {
      value = $input.prompt_type|first_notempty:"pick"
    }

    var $is_converse {
      value = $prompt_type == "converse"
    }

    var $validate_mode {
      value = $is_converse ? "followup" : "request"
    }

    // 1) Candidates
    var $candidates {
      value = []
    }

    // Only real venue objects count: an input that was not sent arrives as "" and must not
    // become a one-item list.
    var $pre_formatted {
      value = []
    }

    foreach (($input.model_candidates ?? [])|safe_array) {
      each as $mc {
        conditional {
          if ($mc != null && ($mc|is_text) == false && (($mc|get:"venue_id":0)|to_int) > 0) {
            array.push $pre_formatted {
              value = $mc
            }
          }
        }
      }
    }

    var $max_cand {
      value = $input.max_candidates|first_notempty:10
    }

    conditional {
      if (($pre_formatted|count) > 0) {
        var.update $candidates {
          value = $pre_formatted|slice:0:$max_cand
        }
      }

      elseif ((($input.venues|safe_array)|count) > 0) {
        function.run "genie/fn_genie_load_candidate_venues_dev" {
          input = {
            venues        : $input.venues
            max_candidates: $input.max_candidates
          }
        } as $loaded

        var.update $candidates {
          value = $loaded|get:"candidates":[]
        }

        var.update $fail_reason {
          value = $loaded|get:"fail_reason":null
        }
      }

      else {
        var.update $fail_reason {
          value = "no_candidates"
        }
      }
    }

    // GEN-073: add saved match notes to candidates that have none. An input that was not sent
    // arrives as "", so only an object is used.
    var $vm {
      value = $input.venue_matches ?? {}
    }

    conditional {
      if (($vm|is_text) == false && ($vm|is_array) == false && (($vm|keys)|count) > 0) {
        var $with_matches {
          value = []
        }

        foreach ($candidates) {
          each as $cand_m {
            var $cm_key {
              value = (($cand_m|get:"venue_id":0)|to_int)|to_text
            }

            var $cm_saved {
              value = (($vm|get:$cm_key:[]) ?? [])|safe_array
            }

            conditional {
              if ((($cand_m|get:"matches":[])|safe_array|count) == 0 && ($cm_saved|count) > 0) {
                array.push $with_matches {
                  value = $cand_m|set:"matches":$cm_saved
                }
              }

              else {
                array.push $with_matches {
                  value = $cand_m
                }
              }
            }
          }
        }

        var.update $candidates {
          value = $with_matches
        }
      }
    }

    var $event_candidates {
      value = []
    }

    conditional {
      if ($is_converse) {
        foreach (($input.event_rows ?? [])|safe_array) {
          each as $erow {
            conditional {
              if ($erow != null && (($erow|get:"id":0)|to_int) > 0) {
                function.run "genie/fn_genie_format_event_for_model_dev" {
                  input = {event: $erow}
                } as $ev_formatted

                var.update $event_candidates {
                  value = $event_candidates|append:$ev_formatted
                }
              }
            }
          }
        }

        // A follow-up can be plain chat: no shown items is not a failure.
        var.update $fail_reason {
          value = null
        }
      }
    }

    // GEN-073: on a request that does not ask about time, the hours are left out of the data. A
    // visible open_now: false made the model write "though currently closed" despite every rule
    // against it; it cannot mention what it is not told. Follow-ups keep the hours ("is it open?").
    conditional {
      if ($is_converse == false && (($input.hours_mode ?? "")|trim) == "omit") {
        var $no_hours {
          value = []
        }

        foreach ($candidates) {
          each as $cand_h {
            array.push $no_hours {
              value = $cand_h|unpick:["open_now", "today_hours"]
            }
          }
        }

        var.update $candidates {
          value = $no_hours
        }
      }
    }

    var.update $candidate_count {
      value = ($candidates|count) + ($event_candidates|count)
    }

    // 2) Prompt
    var $prompt {
      value = null
    }

    conditional {
      if ($fail_reason == null) {
        function.run "genie/fn_genie_build_prompt_dev" {
          input = {
            prompt_type      : $prompt_type
            message          : $input.message
            candidates       : $candidates
            event_candidates : $event_candidates
            city             : $input.city
            now_text         : $input.now_text
            weather_text     : $input.weather_text
            match_quality    : $input.match_quality
            user_context     : $input.user_context
            conversation_text: $input.conversation_text
            turn_note        : $input.turn_note
            search_summary   : $input.search_summary
            reply_language   : $input.reply_language
          }
        } as $prompt

        var.update $prompt_version {
          value = $prompt|get:"prompt_version":null
        }

        var.update $fail_reason {
          value = $prompt|get:"fail_reason":null
        }
      }
    }

    // 3) Model request
    var $raw_reply {
      value = null
    }

    conditional {
      if ($fail_reason == null) {
        // Variables first: each message and the payload are built from plain references.
        var $sys_text {
          value = $prompt|get:"system_text":""
        }

        var $usr_text {
          value = $prompt|get:"user_text":""
        }

        var $sys_msg {
          value = {role: "system", content: $sys_text}
        }

        var $usr_msg {
          value = {role: "user", content: $usr_text}
        }

        // Conversation v1: system, then the earlier messages, then this turn.
        var $history_msgs {
          value = []
        }

        foreach (($input.history ?? [])|safe_array) {
          each as $hm {
            var $hm_role {
              value = ($hm|get:"role":"")|to_lower
            }

            var $hm_content {
              value = (($hm|get:"content":"") ?? "")|trim
            }

            conditional {
              if (($hm_role == "user" || $hm_role == "assistant") && $hm_content != "") {
                var $hm_msg {
                  value = {role: $hm_role, content: $hm_content}
                }

                array.push $history_msgs {
                  value = $hm_msg
                }
              }
            }
          }
        }

        var $messages {
          value = (([$sys_msg]|merge:$history_msgs)|merge:[$usr_msg])
        }

        var $ai_payload {
          value = {messages: $messages}
        }

        var $temperature {
          value = $input.temperature ?? 0.3
        }

        function.run "genie/fn_genie_call_ai_dev" {
          input = {
            ai_payload : $ai_payload
            model      : $model
            max_tokens : $input.max_tokens|first_notempty:800
            timeout    : $input.timeout|first_notempty:30
            json_mode  : true
            temperature: $temperature
          }
        } as $ai_resp

        var.update $latency_ms {
          value = $ai_resp|get:"latency_ms":0
        }

        var.update $raw_reply {
          value = $ai_resp|get:"assistant_reply":null
        }

        conditional {
          if ($raw_reply == null || ($raw_reply|trim)|is_empty) {
            var.update $fail_reason {
              value = "ai_no_reply_status_" ~ (($ai_resp|get:"status_code":0)|to_text)
            }
          }
        }
      }
    }

    // 4) Validate the picks
    var $validation {
      value = null
    }

    conditional {
      if ($fail_reason == null) {
        function.run "genie/fn_genie_validate_picks_dev" {
          input = {
            raw_reply         : $raw_reply
            candidates        : $candidates
            event_candidates  : $event_candidates
            mode              : $validate_mode
          }
        } as $validation

        var.update $fail_reason {
          value = $validation|get:"fail_reason":null
        }
      }
    }

    // 5) Reply text and venue order
    conditional {
      if ($fail_reason == null) {
        // A request gets the numbered reply; a follow-up keeps the model's own words.
        conditional {
          if ($is_converse) {
            var.update $reply {
              value = $validation.intro
            }
          }

          else {
            function.run "genie/fn_genie_compose_reply_dev" {
              input = {intro: $validation.intro, picks: $validation.picks}
            } as $composed

            var.update $reply {
              value = $composed
            }
          }
        }

        var.update $pick_reasons {
          value = $validation.picks
        }

        foreach ($validation.picks) {
          each as $pk {
            conditional {
              if (($pk|get:"kind":"venue") == "event") {
                var.update $picked_event_ids {
                  value = $picked_event_ids|append:$pk.event_id
                }
              }

              else {
                var.update $picked_ids {
                  value = $picked_ids|append:$pk.venue_id
                }
              }
            }
          }
        }

        function.run "genie/fn_genie_order_venues_dev" {
          input = {venues: $input.venues, picked_ids: $picked_ids}
        } as $ordered

        var.update $ordered_venues {
          value = $ordered
        }

        // Report-only checks. They never change the reply; they measure how well the prompt holds.
        // 1) Phrases the prompt rules out: contrasts, absences, closed status, profile talk.
        var $flag_terms {
          value = [
            "lacks"
            "though"
            "but it"
            "but no"
            "yet no"
            "not a "
            "isn't"
            "doesn't"
            "does not"
            "closed"
            "opens later"
            "opens at"
            "your profile"
            "your preference"
            "your saved"
            "you told me"
          ]
        }

        // 2) Unsupported claims: a feature named in a pick's reason that appears nowhere in that
        // venue's data (fields or matches). Words are padded with a space so "view" does not match
        // "review".
        var $claim_terms {
          value = [
            " rooftop"
            " patio"
            " outdoor"
            " karaoke"
            " live music"
            " live band"
            " jazz"
            " dj"
            " dancing"
            " dance floor"
            " date"
            " romantic"
            " group"
            " birthday"
            " view"
            " hookah"
            " brunch"
            " happy hour"
            " late night"
            " sports"
            " trivia"
            " cigar"
            " wine"
          ]
        }

        // Every picked venue's data together, for the intro check below.
        var $picked_data {
          value = ""
        }

        foreach ($validation.picks) {
          each as $pk2 {
            var $pk2_id {
              value = ($pk2|get:"venue_id":0)|first_notempty:($pk2|get:"event_id":0)
            }

            var $pk2_reason {
              value = $pk2|get:"reason":""
            }

            foreach ($flag_terms) {
              each as $ft {
                conditional {
                  if ($pk2_reason|icontains:$ft) {
                    var $flag_row {
                      value = {venue_id: $pk2_id, term: $ft}
                    }

                    array.push $reason_flags {
                      value = $flag_row
                    }
                  }
                }
              }
            }

            // The venue's own data as one lower-case text, for the unsupported-claim check.
            var $pk2_data {
              value = ""
            }

            var $pk2_matches {
              value = []
            }

            foreach ($candidates) {
              each as $cv {
                conditional {
                  if ((($cv|get:"venue_id":0)|to_int) == ($pk2_id|to_int)) {
                    var.update $pk2_data {
                      value = (" " ~ (($cv|json_encode)|to_lower))|replace:"_":" "
                    }

                    var.update $pk2_matches {
                      value = (($cv|get:"matches":[]) ?? [])|safe_array
                    }
                  }
                }
              }
            }

            var.update $picked_data {
              value = $picked_data ~ $pk2_data
            }

            var $pk2_text {
              value = " " ~ ($pk2_reason|to_lower)
            }

            // 3) A feature that only reviews mention ("karaoke: in 2 reviews") written as a fact:
            // the reason names it without saying guests or reviews mention it.
            var $pk2_hedged {
              value = ($pk2_text|contains:"guest") || ($pk2_text|contains:"review") || ($pk2_text|contains:"mention") || ($pk2_text|contains:"people say")
            }

            foreach ($pk2_matches) {
              each as $pm {
                var $pm_text {
                  value = (($pm ?? "")|to_text)|to_lower
                }

                var $pm_term {
                  value = ((($pm_text|split:":")|first) ?? "")|trim
                }

                conditional {
                  if (($pm_text|contains:" review") && $pm_term != "" && ($pk2_text|contains:$pm_term) && $pk2_hedged == false) {
                    var $rf_row {
                      value = {venue_id: $pk2_id, term: "review_as_fact:" ~ $pm_term}
                    }

                    array.push $reason_flags {
                      value = $rf_row
                    }
                  }
                }
              }
            }

            conditional {
              if ($pk2_data != "" && ($pk2|get:"kind":"venue") != "event") {
                foreach ($claim_terms) {
                  each as $ct {
                    conditional {
                      if (($pk2_text|contains:$ct) && (($pk2_data|contains:($ct|trim)) == false)) {
                        var $claim_row {
                          value = {venue_id: $pk2_id, term: "unsupported:" ~ ($ct|trim)}
                        }

                        array.push $reason_flags {
                          value = $claim_row
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // 4) The intro of a request names a feature that none of the picks has in its data
        // ("more rooftop options" over three bars without a rooftop).
        conditional {
          if ($is_converse == false && $picked_data != "") {
            var $intro_text {
              value = " " ~ ((($validation|get:"intro":"") ?? "")|to_lower)
            }

            // An intro that says the feature is missing ("No more rooftop bars nearby...") or
            // scarce ("just one rooftop bar") is the honest answer, not a claim.
            var $intro_hedged {
              value = ($intro_text|contains:" no ") || ($intro_text|contains:"no more") || ($intro_text|contains:"none") || ($intro_text|contains:"just one") || ($intro_text|contains:"only one") || ($intro_text|contains:"not ")
            }

            foreach ($claim_terms) {
              each as $ct2 {
                conditional {
                  if ($intro_hedged == false && ($intro_text|contains:$ct2) && (($picked_data|contains:($ct2|trim)) == false)) {
                    var $intro_row {
                      value = {venue_id: null, term: "unsupported_intro:" ~ ($ct2|trim), where: "intro"}
                    }

                    array.push $reason_flags {
                      value = $intro_row
                    }
                  }
                }
              }
            }
          }
        }

        // Conversation v1: a follow-up reply is free text, so check it as a whole too.
        conditional {
          if ($is_converse) {
            foreach ($flag_terms) {
              each as $ft2 {
                conditional {
                  if (($reply ?? "")|icontains:$ft2) {
                    var $flag_row2 {
                      value = {venue_id: null, term: $ft2, where: "reply"}
                    }

                    array.push $reason_flags {
                      value = $flag_row2
                    }
                  }
                }
              }
            }
          }
        }

        var.update $used {
          value = true
        }
      }
    }

    // On any failure, hand back the untouched input so the caller keeps its own output.
    conditional {
      if ($used == false) {
        var.update $reply {
          value = null
        }

        var.update $pick_reasons {
          value = []
        }

        var.update $picked_ids {
          value = []
        }

        var.update $picked_event_ids {
          value = []
        }

        var.update $ordered_venues {
          value = $input.venues|safe_array
        }

        var.update $reason_flags {
          value = []
        }
      }
    }

    debug.log {
      value = {
        checkpoint      : "GENIE_RUN_TURN"
        prompt_type     : $prompt_type
        used            : $used
        fail_reason     : $fail_reason
        model           : $model
        prompt_version  : $prompt_version
        latency_ms      : $latency_ms
        candidate_count : $candidate_count
        history_count   : (($input.history ?? [])|safe_array)|count
        picked_ids      : $picked_ids
        picked_event_ids: $picked_event_ids
        reason_flags    : $reason_flags
      }
    }
  }

  response = {
    used            : $used
    reply           : $reply
    pick_reasons    : $pick_reasons
    picked_ids      : $picked_ids
    picked_event_ids: $picked_event_ids
    venues          : $ordered_venues
    candidate_count : $candidate_count
    fail_reason     : $fail_reason
    model           : $model
    prompt_version  : $prompt_version
    latency_ms      : $latency_ms
    reason_flags    : $reason_flags
  }
}
