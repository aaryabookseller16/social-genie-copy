// Purpose: Detects the language of a user's Genie message using a lightweight OpenAI call.
// Returns ISO 639-1 language code.
function "genie/fn_detect_query_language_dev" {
  input {
    // The user's message text
    text message
  
    // The ID of the session
    text session_id
  }

  stack {
    // 1. Make OpenAI detection call
    api.request {
      url = "https://api.openai.com/v1/chat/completions"
      method = "POST"
      params = ```
        {
          model      : "gpt-4o-mini"
          max_tokens : 5
          temperature: 0
          messages   : [
              {
                role   : "system",
                content: "You are a language detector. Return ONLY the ISO 639-1 two-letter language code of the input text. Nothing else. Examples: en, es, pt, fr, ar, zh, de, it, ja, ko"
              },
              {
                role   : "user",
                content: ($input.message ?? "")
              }
            ]
        }
        ```
      headers = [
        ("Authorization: Bearer " ~ $env.OPENAI_API_KEY)
        "Content-Type: application/json"
      ]
    } as $openai_result
  
    var $detected_language {
      value = "en"
    }
  
    var $language_confidence {
      value = 0.9
    }
  
    // 2. Parse OpenAI response safely
    var $status {
      value = ($openai_result|get:"response":{})|get:"status":0
    }
  
    conditional {
      if ($status == 200) {
        var $choices {
          value = $openai_result.response.result|get:"choices":[]
        }
      
        var $first_choice {
          value = $choices|get:0:{}
        }
      
        var $content {
          value = ($first_choice|get:"message":{})|get:"content":"en"
        }
      
        var $raw_lang {
          value = ($content|to_lower)|trim
        }
      
        conditional {
          if (($raw_lang|strlen) >= 2) {
            var.update $detected_language {
              value = $raw_lang|substr:0:2
            }
          }
        }
      }
    }
  
    // 3. Determine if non-English
    var $is_non_english {
      value = false
    }
  
    conditional {
      if ($detected_language != "en") {
        var.update $is_non_english {
          value = true
        }
      }
    }
  
    // 4. Check World Cup window
    var $is_worldcup_window {
      value = false
    }
  
    var $now_date {
      value = now|format_timestamp:"Y-m-d":"UTC"
    }
  
    conditional {
      if (($now_date >= "2026-06-14") && ($now_date <= "2026-07-19")) {
        var.update $is_worldcup_window {
          value = true
        }
      }
    }
  
    // 5. Update session with language data (if valid)
    conditional {
      if ($input.session_id != null && (($input.session_id|to_text)|trim) != "" && (($input.session_id|to_int) > 0)) {
        db.get genie_temp_sessions {
          field_name = "id"
          field_value = $input.session_id
        } as $session_check
      
        conditional {
          if ($session_check != null) {
            db.edit genie_temp_sessions {
              field_name = "id"
              field_value = $input.session_id
              enforce_hidden_fields = false
              data = {
                detected_language  : $detected_language
                language_confidence: $language_confidence
                is_non_english     : $is_non_english
                is_worldcup_window : $is_worldcup_window
              }
            } as $updated_session
          }
        }
      }
    }
  }

  response = {
    detected_language  : $detected_language
    is_non_english     : $is_non_english
    language_confidence: $language_confidence
    is_worldcup_window : $is_worldcup_window
  }
}
