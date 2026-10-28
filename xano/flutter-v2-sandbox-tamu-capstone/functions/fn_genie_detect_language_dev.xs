function "genie/fn_genie_detect_language_dev" {
  input {
    text message
  }

  stack {
    var $detected_language {
      value = "en"
    }

    var $should_detect {
      value = true
    }

    conditional {
      if ($input.message == null || ($input.message|trim)|is_empty) {
        var.update $should_detect {
          value = false
        }
      }
    }

    conditional {
      if ($should_detect) {
        var $messages {
          value = []
        }

        var.update $messages {
          value = $messages
            |append:```
              {
                role   : "system"
                content: "You are a language detector. Detect the language of the user message. Return only the full language name in English, lowercase. Examples: english, spanish, french, german, portuguese, arabic, japanese, korean, dutch, polish, mandarin chinese, italian, russian. Return only the language name — nothing else."
              }
              ```
        }

        var.update $messages {
          value = $messages
            |append:```
              {
                role   : "user"
                content: $input.message
              }
              ```
        }

        api.request {
          url = "https://api.openai.com/v1/chat/completions"
          method = "POST"
          params = ```
            {
              model      : "gpt-4o"
              messages   : $messages
              temperature: 0
              max_tokens : 10
            }
            ```
          headers = []
            |push:"Content-Type: application/json"
            |push:"Authorization: Bearer " ~ $env.OPENAI_API_KEY
        } as $oa_resp

        // Log status and result only. Never log $oa_resp whole: it contains the request headers (API key).
        debug.log {
          value = ```
            {
              label  : "LANG_DETECT_RAW"
              status : $oa_resp|get:"response":{}|get:"status":0
              result : $oa_resp|get:"response":{}|get:"result":null
            }
            ```
        }

        var $status {
          value = $oa_resp|get:"response":{}|get:"status":0
        }

        conditional {
          if ($status == 200) {
            var $result {
              value = $oa_resp
                |get:"response":{}
                |get:"result":{}
                |get:"choices":[]
                |get:0:{}
                |get:"message":{}
                |get:"content":null
            }

            conditional {
              if ($result != null && (($result|trim)|is_empty) == false) {
                var.update $detected_language {
                  value = $result|trim|to_lower
                }
              }
            }
          }
        }
      }
    }
  }

  response = {detected_language: $detected_language}
}
