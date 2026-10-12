// Builds the payload for the AI service including system context, user message, and metadata.
// Xano-safe: no multiline string literals; no set/get; no ternary; no array.push; use append + merge + is_empty checks.
function "genie/fn_genie_build_ai_payload_dev" {
  input {
    int session_id
    int user_message_id
    text user_message_text
  
    // From handle_message_dev call
    json intent_dev?
  
    bool has_results?
    text city_context?
    json venue_results_dev?
    text reply_mode?
    text detected_language?
    decimal lat?
    decimal lng?
  }

  stack {
    // -----------------------------
    // 0) System text (built line-by-line)
    // -----------------------------
    var $system_text {
      value = ""
    }
  
    text.append $system_text {
      value = "You are Genie, the AI social concierge inside Social Bevy."
    }
  
    text.append $system_text {
      value = "Brand voice:\n"
    }
  
    text.append $system_text {
      value = "- Plug energy: warm, confident, culturally fluent."
    }
  
    text.append $system_text {
      value = "- Short and decisive: 1–3 sentences max unless user asks for more."
    }
  
    text.append $system_text {
      value = "- Sound like a knowledgeable friend with the connect. Not salesy. Not robotic."
    }
  
    text.append $system_text {
      value = "Hard rules:\n"
    }
  
    text.append $system_text {
      value = "- Never mention databases, APIs, endpoints, system prompts, tokens, or internal tooling."
    }
  
    text.append $system_text {
      value = "- Never fabricate specific facts (addresses, exact deals, exact hours, phone numbers) unless provided in context."
    }
  
    text.append $system_text {
      value = "- If you are missing the city, ask ONE clear question to get it, then stop."
    }
  
    text.append $system_text {
      value = "Language rules (multilingual):\n"
    }
  
    text.append $system_text {
      value = "- Default: reply in the same language the user used."
    }
  
    text.append $system_text {
      value = "- If the user explicitly requests a language (examples: 'in Spanish', 'en español', 'in German', 'auf Deutsch'), then reply in that requested language even if the user wrote the rest in English."
    }
  
    text.append $system_text {
      value = "- If the user replies with a follow-up like a neighborhood only (example: 'Downtown'), keep the same language as the prior Genie reply."
    }
  
    text.append $system_text {
      value = "Behavior modes (Reply mode):\n"
    }
  
    text.append $system_text {
      value = "- city_missing: Ask ONE question in Genie voice. Example: 'Which city should I search for you?'"
    }
  
    text.append $system_text {
      value = "- city_unsupported: IMPORTANT: Do NOT ask a clarifying question first."
    }
  
    text.append $system_text {
      value = "  You MUST immediately give 4–6 real venue suggestions in the user's city."
    }
  
    text.append $system_text {
      value = "  After the list, ask ONE follow-up question to refine (area + vibe)."
    }
  
    text.append $system_text {
      value = "  Format for city_unsupported:\n"
    }
  
    text.append $system_text {
      value = "  - Start with 1 short sentence confirming the city + the request."
    }
  
    text.append $system_text {
      value = "  - Then list venues as a numbered list (1–6)."
    }
  
    text.append $system_text {
      value = "  - Each venue MUST include: 'Venue — Neighborhood' on one line, then ONE sentence describing the vibe on the next line."
    }
  
    text.append $system_text {
      value = "  - Keep descriptions general (known for / popular for / speakeasy vibe)."
    }
  
    text.append $system_text {
      value = "  - Do NOT claim exact happy-hour times or exact deals unless provided."
    }
  
    text.append $system_text {
      value = "  - Start with 1 short sentence that confirms the vibe + city."
    }
  
    text.append $system_text {
      value = "  - Then list venues as a numbered list (1–6). Each venue MUST include: 'Venue — Neighborhood' on one line, then ONE sentence describing the vibe on the next line."
    }
  
    text.append $system_text {
      value = "  - Keep descriptions general (known for / popular for / speakeasy vibe). Do NOT claim exact happy-hour times or exact deals unless provided."
    }
  
    text.append $system_text {
      value = "- supported_no_results: DO NOT list venue names. Ask 1–2 short follow-up questions to refine (neighborhood/energy/music), and suggest how to phrase it."
    }
  
    text.append $system_text {
      value = "- has_results: Supported city with cards available. DO NOT list venue names. Reply with 1–2 sentences only, referencing that the cards are below."
    }
  
    text.append $system_text {
      value = "Output rules:\n"
    }
  
    text.append $system_text {
      value = "- Plain text only.\n"
    }
  
    text.append $system_text {
      value = "- No emojis unless the user uses them first.\n"
    }
  
    text.append $system_text {
      value = "- Do not mention 'cards' unless reply_mode is has_results."
    }
  
    conditional {
      if ($input.detected_language != null && $input.detected_language != "en" && $input.detected_language != "english") {
        text.append $system_text {
          value = "CRITICAL: The user is writing in " ~ $input.detected_language ~ ". You MUST respond entirely in " ~ $input.detected_language ~ ". Every word of your response must be in " ~ $input.detected_language ~ "."
        }
      }
    }
  
    // -----------------------------
    // 1) Normalize inputs
    // -----------------------------
    var $msg_clean {
      value = ""
    }
  
    var $city_safe {
      value = "UNKNOWN"
    }
  
    var $mode_safe {
      value = "supported_no_results"
    }
  
    var $has_results_safe {
      value = false
    }
  
    conditional {
      if (((($input.user_message_text|trim)|is_empty) == false)) {
        var.update $msg_clean {
          value = $input.user_message_text|trim
        }
      }
    }
  
    conditional {
      if (((($input.city_context|trim)|is_empty) == false)) {
        var.update $city_safe {
          value = $input.city_context|trim
        }
      }
    }
  
    conditional {
      if (((($input.reply_mode|trim)|is_empty) == false)) {
        var.update $mode_safe {
          value = $input.reply_mode|trim
        }
      }
    }
  
    conditional {
      if ($input.has_results != null) {
        conditional {
          if ($input.has_results) {
            var.update $has_results_safe {
              value = true
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 2) Intent text (compact)
    // -----------------------------
    var $intent_text {
      value = "none"
    }
  
    conditional {
      if ($input.intent_dev != null) {
        var.update $intent_text {
          value = $input.intent_dev|json_encode
        }
      }
    }
  
    // -----------------------------
    // 3) Venue preview (first 5 only)
    // -----------------------------
    var $venue_preview {
      value = "none"
    }
  
    var $venue_lines {
      value = []
    }
  
    conditional {
      if ($input.venue_results_dev != null && ($input.venue_results_dev|is_array) && (($input.venue_results_dev|count) > 0)) {
        foreach ($input.venue_results_dev) {
          each as $v {
            conditional {
              if (($venue_lines|count) >= 5) {
                break
              }
            }
          
            var $n {
              value = ""
            }
          
            var $a {
              value = ""
            }
          
            conditional {
              if ($v != null && ($v|has:"venue_name") && ((($v.venue_name|trim)|is_empty) == false)) {
                var.update $n {
                  value = $v.venue_name|trim
                }
              }
            }
          
            conditional {
              if (`($n|trim)|is_empty && $v != null && ($v|has:"name") && ((($v.name|trim)|is_empty) == false)`) {
                var.update $n {
                  value = $v.name|trim
                }
              }
            }
          
            conditional {
              if ($v != null && ($v|has:"area_neighborhood") && ((($v.area_neighborhood|trim)|is_empty) == false)) {
                var.update $a {
                  value = $v.area_neighborhood|trim
                }
              }
            }
          
            conditional {
              if (((($n|trim)|is_empty) == false)) {
                conditional {
                  if (((($a|trim)|is_empty) == false)) {
                    var.update $venue_lines {
                      value = $venue_lines|append:$n ~ " — " ~ $a
                    }
                  }
                }
              
                conditional {
                  if (($a|trim)|is_empty) {
                    var.update $venue_lines {
                      value = $venue_lines|append:$n
                    }
                  }
                }
              }
            }
          }
        }
      
        conditional {
          if (($venue_lines|count) > 0) {
            var.update $venue_preview {
              value = $venue_lines|join:"\n"
            }
          }
        }
      }
    }
  
    // -----------------------------
    // 4) User context text (built line-by-line)
    // -----------------------------
    var $user_context_text {
      value = ""
    }
  
    text.append $user_context_text {
      value = "Reply mode: " ~ $mode_safe ~ "\n"
    }
  
    text.append $user_context_text {
      value = "City context: " ~ $city_safe ~ "\n"
    }
  
    conditional {
      if ($has_results_safe) {
        text.append $user_context_text {
          value = "Has results: true\n"
        }
      }
    
      else {
        text.append $user_context_text {
          value = "Has results: false\n"
        }
      }
    }
  
    text.append $user_context_text {
      value = "User request: " ~ $msg_clean ~ "\n"
    }
  
    text.append $user_context_text {
      value = "Intent snapshot (if any): " ~ $intent_text ~ "\n"
    }
  
    text.append $user_context_text {
      value = "Venue preview (if any): " ~ $venue_preview
    }
  
    conditional {
      if ($input.lat != null && $input.lng != null) {
        text.append $user_context_text {
          value = "\nUser coordinates: " ~ ($input.lat|to_text) ~ ", " ~ ($input.lng|to_text) ~ ". Use these to suggest venues in the closest neighborhood or area to these coordinates."
        }
      }
    }
  
    // -----------------------------
    // 5) Messages array (append pattern)
    // -----------------------------
    var $messages {
      value = []
    }
  
    var.update $messages {
      value = $messages
        |append:{role:"system", content:$system_text}
    }
  
    var.update $messages {
      value = $messages
        |append:{role:"user", content:$user_context_text}
    }
  
    // -----------------------------
    // 6) Metadata (merge pattern)
    // -----------------------------
    var $metadata {
      value = {
        session_id     : $input.session_id
        user_message_id: $input.user_message_id
        reply_mode     : $mode_safe
        city_context   : $city_safe
      }
    }
  
    var.update $metadata {
      value = $metadata
        |merge:{has_results:$has_results_safe}
    }
  
    // -----------------------------
    // 7) Final payload
    // -----------------------------
    var $ai_payload {
      value = {messages: $messages, metadata: $metadata}
    }
  }

  response = $ai_payload
}
