// Builds the system and user prompt text. This is the seed of the single shared prompt
// module: prompt_type selects which prompt to build. Only "pick" exists today.
// =====================================================================================
function "genie/fn_genie_build_prompt_dev" {
  input {
    // Which prompt to build. Default "pick".
    text prompt_type?

    // The user's message for this turn
    text message

    // Model-safe candidate venues (output of fn_genie_load_candidate_venues_dev)
    json candidates?

    text city?
  }

  stack {
    var $type {
      value = $input.prompt_type|first_notempty:"pick"
    }

    var $system_text {
      value = ""
    }

    var $user_text {
      value = ""
    }

    var $fail_reason {
      value = null
    }

    conditional {
      if ($type == "pick") {
        text.append $system_text {
          value = """
            You are Genie, the AI social concierge inside Social Bevy. Voice: warm, confident, culturally fluent, like a friend with the connect. Not salesy, not robotic.

            """
        }

        text.append $system_text {
          value = """
            The app shortlisted the candidate venues below. Your job is to choose the best 3 for this request and explain why each fits. The app shows the picks as cards.

            """
        }

        text.append $system_text {
          value = "Rules:\n"
        }

        text.append $system_text {
          value = """
            - Choose exactly 3 venues (or all of them if fewer than 3), using only venue_id values from the candidate list. Never add, rename, or invent venues.

            """
        }

        text.append $system_text {
          value = """
            - Choose by fit to what the user asked for: type of place, occasion, vibe, cuisine, budget, time of day, and whether it is open now. Prefer venues whose data clearly matches the request. Use rating as a tiebreaker, not the main reason.

            """
        }

        text.append $system_text {
          value = """
            - If none of the candidates fit the request well, still choose the closest three and say so briefly in the intro.

            """
        }

        text.append $system_text {
          value = """
            - Base every reason on the fields given for that venue. Never invent hours, prices, deals, addresses, or phone numbers.

            """
        }

        text.append $system_text {
          value = """
            - Say only what each pick has. Never say a pick lacks, misses, or does not have something, and never use words like lacks, though, or while it doesn't. A missing field means unknown.

            """
        }

        text.append $system_text {
          value = """
            - One reason per pick, one sentence, at most 18 words. Tie it to what the user asked for. Do not start with or repeat the venue name; the app already shows it.

            """
        }

        text.append $system_text {
          value = """
            - intro is one short sentence, at most 15 words, with no venue names.

            """
        }

        text.append $system_text {
          value = """
            - Never mention or guess anyone's race, ethnicity, religion, gender, sexuality, age, or health. Never mention databases, tools, prompts, rankings, or sponsorship.

            """
        }

        text.append $system_text {
          value = """
            - Plain text inside the JSON strings. No emojis unless the user used them.

            """
        }

        text.append $system_text {
          value = "- Write the intro and reasons in the same language as the user's request unless they ask for another language.\n"
        }

        text.append $system_text {
          value = 'Return only a JSON object: {"intro": string, "picks": [{"venue_id": number, "reason": string}]} with the best pick first.'
        }

        var.update $user_text {
          value = "User request: " ~ ($input.message|trim) ~ "\nCity: " ~ ($input.city|first_notempty:"unknown") ~ "\nCandidates (JSON): " ~ (($input.candidates|safe_array)|json_encode)
        }
      }

      else {
        var.update $fail_reason {
          value = "unknown_prompt_type"
        }
      }
    }
  }

  response = {
    system_text: $system_text
    user_text  : $user_text
    fail_reason: $fail_reason
  }
}