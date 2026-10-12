// Adds a new message to the genie_message table.
function "genie/fn_genie_log_message_dev" {
  input {
    // The ID of the session this message belongs to
    int session_id
  
    // The type of sender (e.g., 'user', 'genie', 'system')
    text sender_type
  
    // The content of the message
    text message_text
  
    // Optional raw payload data associated with the message
    json raw_payload?
  }

  stack {
    var $sender_type {
      value = "lower(sender_type)"
    }
  
    db.add genie_message {
      enforce_hidden_fields = false
      data = {
        created_at        : "now"
        session           : $input.session_id
        sender_type       : $input.sender_type
        message_text      : $input.message_text
        raw_payload       : $input.raw_payload
        is_visible_to_user: true
      }
    } as $new_message
  }

  response = {message_id: $new_message.id, message: $new_message}
}
