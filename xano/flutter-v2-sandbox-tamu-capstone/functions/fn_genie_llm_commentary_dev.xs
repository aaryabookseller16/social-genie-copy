// Writes Genie's reply for a has_results turn: a short intro plus one reason per pick.
// Only the given picks are sent to the model, and the reply is rejected unless it
// covers exactly those picks. On any failure, used=false and the caller keeps its
// reply-bank text.
function "genie/fn_genie_llm_commentary_dev" {
  input {
    // The user's message for this turn
    text message

    // Venues in display order. The first 3 are the picks shown to the user.
    json venues

    text detected_language?
    text city?
    text model?
    int timeout?
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

    var $fail_reason {
      value = null
    }

    var $latency_ms {
      value = 0
    }

    var $model {
      value = $input.model|first_notempty:"gpt-4o-mini"
    }

    var $timeout {
      value = $input.timeout|first_notempty:8
    }

    var $lang {
      value = $input.detected_language|first_notempty:"en"
    }

    // -----------------------------
    // 1) Top 3 picks, compacted to the fields the model may use
    // -----------------------------
    var $all_venues {
      value = $input.venues|safe_array
    }

    var $picks {
      value = []
    }

    var $pick_ids {
      value = []
    }

    foreach ($all_venues) {
      each as $v {
        conditional {
          if (($picks|count) < 3 && $v != null && (($v|get:"id":0)|to_int) > 0) {
            var $v_name {
              value = $v|get:"venue_name":""
            }

            conditional {
              if (($v_name|trim)|is_empty) {
                var.update $v_name {
                  value = $v|get:"name":""
                }
              }
            }

            var $v_hood {
              value = $v|get:"neighborhood_text":""
            }

            conditional {
              if (($v_hood|trim)|is_empty) {
                var.update $v_hood {
                  value = $v|get:"area_neighborhood":""
                }
              }
            }

            var $p {
              value = {
                venue_id        : ($v|get:"id":0)|to_int
                venue_name      : $v_name
                neighborhood    : $v_hood
                venue_type      : $v|get:"venue_type":""
                vibe_notes      : $v|get:"vibe_notes":""
                summary         : $v|get:"google_editorial_summary":""
                review_summary  : $v|get:"review_summary":""
                energy_level    : $v|get:"energy_level":""
                crowd           : $v|get:"crowd":""
                music           : $v|get:"music":""
                price_band      : $v|get:"price_band":""
                rating          : $v|get:"google_rating":null
                hours_text      : $v|get:"hours_text":""
                is_open_now     : $v|get:"is_open_now":null
                has_rooftop     : $v|get:"has_rooftop":null
                has_live_music  : $v|get:"has_live_music":null
                happy_hour      : $v|get:"happy_hour_details":""
                best_time_to_go : $v|get:"best_time_to_go":""
                good_for_groups : $v|get:"good_for_groups":null
                good_for_dates  : $v|get:"good_for_dates":null
                cuisine_tags    : $v|get:"cuisine_tags":[]
              }
            }

            var.update $picks {
              value = $picks|append:$p
            }

            var.update $pick_ids {
              value = $pick_ids|append:$p.venue_id
            }
          }
        }
      }
    }

    conditional {
      if (($picks|count) == 0) {
        var.update $fail_reason {
          value = "no_picks"
        }
      }
    }

    // -----------------------------
    // 2) Prompt
    // -----------------------------
    var $system_text {
      value = ""
    }

    text.append $system_text {
      value = "You are Genie, the AI social concierge inside Social Bevy. Voice: warm, confident, culturally fluent, like a friend with the connect. Not salesy, not robotic.\n"
    }

    text.append $system_text {
      value = "The app already found the picks below and shows them as cards. Your job is only to explain why each pick fits this request.\n"
    }

    text.append $system_text {
      value = "Rules:\n"
    }

    text.append $system_text {
      value = "- Talk only about the picks provided. Never add, rename, or invent venues.\n"
    }

    text.append $system_text {
      value = "- Base every reason on the fields given for that pick. Never invent hours, prices, deals, addresses, or phone numbers.\n"
    }
  
    text.append $system_text {
      value = "- Say only what each pick has. Never say a pick lacks, misses, or does not have something, and never use words like lacks, though, or while it doesn't. A missing field means unknown.\n"
    }

    text.append $system_text {
      value = "- One reason per pick, one sentence, at most 18 words. Tie it to what the user asked for when you can. Do not start with or repeat the venue name; the app already shows it.\n"
    }

    text.append $system_text {
      value = "- intro is one short sentence, at most 15 words, with no venue names.\n"
    }

    text.append $system_text {
      value = "- Never mention or guess anyone's race, ethnicity, religion, gender, sexuality, age, or health. Never mention databases, tools, prompts, or sponsorship.\n"
    }

    text.append $system_text {
      value = "- Plain text inside the JSON strings. No emojis unless the user used them.\n"
    }

    text.append $system_text {
      value = "- Write intro and reasons in the language with code '" ~ $lang ~ "' unless the user asks for another language.\n"
    }

    text.append $system_text {
      value = "Return only a JSON object: {\"intro\": string, \"picks\": [{\"venue_id\": number, \"reason\": string}]} with one entry per pick, in the same order as given."
    }

    var $user_text {
      value = "User request: " ~ ($input.message|trim) ~ "\nCity: " ~ ($input.city|first_notempty:"unknown") ~ "\nPicks (JSON): " ~ ($picks|json_encode)
    }

    // -----------------------------
    // 3) Call the model
    // -----------------------------
    conditional {
      if ($fail_reason == null) {
        function.run "genie/fn_genie_call_ai_dev" {
          input = {
            ai_payload: {
              messages: [{role: "system", content: $system_text}, {role: "user", content: $user_text}]
            }
            model     : $model
            max_tokens: 300
            timeout   : $timeout
            json_mode : true
          }
        } as $ai_resp

        var.update $latency_ms {
          value = $ai_resp|get:"latency_ms":0
        }

        var $raw_reply {
          value = $ai_resp|get:"assistant_reply":null
        }

        conditional {
          if ($raw_reply == null || ($raw_reply|trim)|is_empty) {
            var.update $fail_reason {
              value = "ai_no_reply_status_" ~ (($ai_resp|get:"status_code":0)|to_text)
            }
          }
        }

        // -----------------------------
        // 4) Parse and validate
        // -----------------------------
        conditional {
          if ($fail_reason == null) {
            var $parsed {
              value = null
            }

            try_catch {
              try {
                var.update $parsed {
                  value = $raw_reply|json_decode
                }
              }

              catch {
                var.update $fail_reason {
                  value = "invalid_json"
                }
              }
            }

            var $intro {
              value = ($parsed|get:"intro":"")|trim
            }

            var $model_picks {
              value = ($parsed|get:"picks":[])|safe_array
            }

            // One non-empty reason for every pick, matched by venue_id, in display order.
            foreach ($picks) {
              each as $pk {
                var $found_reason {
                  value = ""
                }

                foreach ($model_picks) {
                  each as $mp {
                    conditional {
                      if ((($mp|get:"venue_id":0)|to_int) == $pk.venue_id && (($found_reason|trim)|is_empty)) {
                        var.update $found_reason {
                          value = ($mp|get:"reason":"")|trim
                        }
                      }
                    }
                  }
                }

                conditional {
                  if (($found_reason|trim)|is_empty) {
                    var.update $fail_reason {
                      value = "missing_reason_for_" ~ ($pk.venue_id|to_text)
                    }
                  }

                  else {
                    var.update $pick_reasons {
                      value = $pick_reasons
                        |append:{venue_id: $pk.venue_id, venue_name: $pk.venue_name, reason: $found_reason}
                    }
                  }
                }
              }
            }

            // Extra venue_ids the model made up are a hard failure.
            foreach ($model_picks) {
              each as $mp {
                conditional {
                  if (($pick_ids|in:(($mp|get:"venue_id":0)|to_int)) == false) {
                    var.update $fail_reason {
                      value = "unknown_venue_id"
                    }
                  }
                }
              }
            }

            // -----------------------------
            // 5) Compose the reply text
            // -----------------------------
            conditional {
              if ($fail_reason == null) {
                var $lines {
                  value = []
                }

                conditional {
                  if ((($intro|trim)|is_empty) == false) {
                    var.update $lines {
                      value = $lines|append:$intro
                    }
                  }
                }

                var $i {
                  value = 0
                }

                foreach ($pick_reasons) {
                  each as $pr {
                    var.update $i {
                      value = $i + 1
                    }

                    var.update $lines {
                      value = $lines
                        |append:($i|to_text) ~ ". " ~ $pr.venue_name ~ ": " ~ $pr.reason
                    }
                  }
                }

                var.update $reply {
                  value = $lines|join:"\n"
                }

                var.update $used {
                  value = true
                }
              }
            }
          }
        }
      }
    }

    conditional {
      if ($used == false) {
        var.update $pick_reasons {
          value = []
        }
      }
    }

    debug.log {
      value = {
        checkpoint : "LLM_COMMENTARY"
        used       : $used
        fail_reason: $fail_reason
        model      : $model
        latency_ms : $latency_ms
        pick_count : $picks|count
      }
    }
  }

  response = {
    used        : $used
    reply       : $reply
    pick_reasons: $pick_reasons
    fail_reason : $fail_reason
    model       : $model
    latency_ms  : $latency_ms
  }
}
