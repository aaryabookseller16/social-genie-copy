// Executes an AI chat completion request using the provided payload.
// Xano-safe: NO return inside conditionals; root-level response only.
function "genie/fn_genie_call_ai_dev" {
  input {
    json ai_payload
  
    // Optional overrides. Defaults keep the original behavior for existing callers.
    text model?
    int max_tokens?
    int timeout?
  
    // When true, ask OpenAI for a JSON object response (response_format json_object).
    bool json_mode?
  }

  stack {
    // -----------------------------
    // 0) Safe extracts
    // -----------------------------
    var $messages {
      value = $input.ai_payload|get:"messages"|first_notempty:[]
    }
  
    var $metadata {
      value = $input.ai_payload|get:"metadata"|first_notempty:{}
    }
  
    // -----------------------------
    // 1) Defaults / outputs
    // -----------------------------
    var $ai_response {
      value = null
    }
  
    var $status_code {
      value = 0
    }
  
    var $assistant_reply {
      value = null
    }
  
    var $error_out {
      value = null
    }
  
    var $model {
      value = $input.model|first_notempty:"gpt-4o"
    }
  
    var $max_tokens {
      value = $input.max_tokens|first_notempty:350
    }
  
    var $timeout {
      value = $input.timeout|first_notempty:30
    }
  
    var $params {
      value = {
        model      : $model
        messages   : $messages
        temperature: 0.6
        max_tokens : $max_tokens
      }
    }
  
    conditional {
      if ($input.json_mode == true) {
        var.update $params {
          value = $params|merge:{response_format: {type: "json_object"}}
        }
      }
    }
  
    var $t_start_ms {
      value = now|to_ms
    }
  
    // -----------------------------
    // 2) Call OpenAI
    // -----------------------------
    api.request {
      url = "https://api.openai.com/v1/chat/completions"
      method = "POST"
      params = $params
    
      headers = []
        |push:"Content-Type: application/json"
        |push:"Authorization: Bearer " ~ $env.OPENAI_API_KEY
      timeout = $timeout
    } as $ai_response
  
    var $latency_ms {
      value = (now|to_ms) - $t_start_ms
    }
  
    // -----------------------------
    // 3) Status code (robust)
    // -----------------------------
    var.update $status_code {
      value = ($ai_response|get:"response":{}|get:"status":null)|first_notempty:($ai_response|get:"status":null)|first_notempty:0
    }
  
    // -----------------------------
    // 4) Parse assistant reply (only if 200)
    // -----------------------------
    conditional {
      if ($status_code == 200) {
        var.update $assistant_reply {
          value = $ai_response
            |get:"response":{}
            |get:"result":{}
            |get:"choices":[]
            |get:0:{}
            |get:"message":{}
            |get:"content":null
        }
      }
    }
  
    // -----------------------------
    // 5) Error capture (no early return)
    // -----------------------------
    conditional {
      if ($status_code != 200) {
        var.update $error_out {
          value = {status_code: $status_code, error: $ai_response}
        }
      }
    }
  
    // -----------------------------
    // 6) Debug logs (optional)
    // -----------------------------
    debug.log {
      value = {
        status_code  : $status_code
        reply_is_null: $assistant_reply == null
        reply_length : $assistant_reply|first_notempty:""|strlen
        model        : $model
        latency_ms   : $latency_ms
      }
    }
  }

  response = {
    assistant_reply: $assistant_reply
    status_code    : $status_code
    error          : $error_out
    model          : $model
    latency_ms     : $latency_ms
  }
}
