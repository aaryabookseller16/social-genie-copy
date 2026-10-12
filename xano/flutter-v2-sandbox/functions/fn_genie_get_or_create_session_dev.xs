// Retrieves an active session matching the user and context, or creates a new one if none exists.
function "genie/fn_genie_get_or_create_session_dev" {
  input {
    // The ID of the user associated with the session.
    int user_id
  
    // The communication channel (e.g., telegram, whatsapp).
    text channel
  
    // The specific entry point within the channel.
    text? entry_point?
  
    // Identifier for the context of the entry point.
    text? entry_context_id?
  
    // Optional city context inferred or provided.
    text? city_from_context?
  
    // Optional additional context metadata.
    json context?
  
    text? session_token? filters=trim
  }

  stack {
    var $token_in {
      value = $input.session_token
    }
  
    conditional {
      if ($token_in == null || ($token_in|trim) == "") {
        security.create_uuid as $generated_token
        var $effective_token {
          value = $generated_token
        }
      }
    
      else {
        var $effective_token {
          value = $token_in
        }
      }
    }
  
    // Search for an active session (where ended_at is null) matching the user, channel, and context ID.
    // Find active session
    db.query genie_session {
      where = $db.genie_session.session_token == $effective_token
      return = {type: "single"}
    } as $existing_session
  
    // Variable to hold the resulting session
    var $session {
      value = null
    }
  
    conditional {
      if ($existing_session != null) {
        // Use the existing active session
        var.update $session {
          value = $existing_session
        }
      }
    
      else {
        // Create a new session record.
        db.add genie_session {
          enforce_hidden_fields = false
          data = {
            created_at      : "now"
            user            : $input.user_id
            session_token   : $effective_token
            channel         : $input.channel
            entry_point     : $input.entry_point
            entry_context_id: $input.entry_context_id
            city_context    : $input.city_from_context
            meta            : $input.context
          }
        } as $new_session
      
        // Use the newly created session
        var.update $session {
          value = $new_session
        }
      }
    }
  
    var $session_token {
      value = $effective_token
    }
  }

  response = {
    session_id   : $session.id
    session      : $session
    session_token: $session_token
  }
}
