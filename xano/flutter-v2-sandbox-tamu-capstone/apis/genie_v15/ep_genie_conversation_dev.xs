// Conversation v1: returns one Genie conversation (the genie_message rows of one genie_session)
// so the app can re-render the conversation view after a reload.
// Access: the caller must send the conversation's session_token AND the external_user_id of the
// user who owns the session. Anything else gets found = false and no messages. Note that all web
// guests share external_user_id "web_guest", so for guests the session_token (a UUID) is the
// real secret, the same as for ep_genie_chat_v2_dev.
// Each genie turn carries its turn state; include_cards = true also returns the venue cards
// (slim rows) and event rows that turn showed.
query "genie/ep_genie_conversation_dev" verb=GET {
  api_group = "genie_v15"

  input {
    // The conversation's session token (conversation_id in the chat response)
    text session_token filters=trim
  
    // The unique identifier for the user on the channel
    text external_user_id filters=trim
  
    // Also return the venue cards and event rows of each Genie turn (default true)
    bool? include_cards?=true
  
    // Maximum messages to return, newest kept (default 100)
    int? limit?
  }

  stack {
    var $found {
      value = false
    }
  
    var $messages_out {
      value = []
    }
  
    var $session_out {
      value = null
    }
  
    var $conversation_id_out {
      value = null
    }
  
    var $limit {
      value = ($input.limit ?? 0)|first_notempty:100
    }
  
    conditional {
      if ($limit > 200) {
        var.update $limit {
          value = 200
        }
      }
    }
  
    conditional {
      if ($input.session_token != "" && $input.external_user_id != "") {
        db.query genie_session {
          where = $db.genie_session.session_token == $input.session_token
          return = {type: "single"}
        } as $sess
      
        conditional {
          if ($sess != null && (($sess|get:"user":0)|to_int) > 0) {
            db.get genie_user {
              field_name = "id"
              field_value = $sess.user
            } as $sess_user
          
            conditional {
              if ($sess_user != null && (($sess_user|get:"external_user_id":"") ?? "") == $input.external_user_id) {
                var.update $found {
                  value = true
                }
              
                var.update $conversation_id_out {
                  value = $input.session_token
                }
              
                var.update $session_out {
                  value = ```
                    {
                      session_token: $sess.session_token
                      city_context : $sess|get:"city_context":""
                      created_at   : $sess|get:"created_at":null
                    }
                    ```
                }
              
                db.query genie_message {
                  where = $db.genie_message.session == $sess.id && $db.genie_message.is_visible_to_user == true
                  sort = {id: "desc"}
                  return = {type: "list", paging: {page: 1, per_page: $limit}}
                } as $msg_page
              
                var $rows {
                  value = (($msg_page|get:"items":[])|safe_array)|reverse
                }
              
                foreach ($rows) {
                  each as $row {
                    var $is_genie {
                      value = (($row|get:"sender_type":"")|to_lower) == "genie"
                    }
                  
                    var $p {
                      value = ($row|get:"raw_payload":{}) ?? {}
                    }
                  
                    var $cards {
                      value = []
                    }
                  
                    var $event_rows {
                      value = []
                    }
                  
                    conditional {
                      if ($is_genie && ($input.include_cards ?? true)) {
                        foreach ((($p|get:"shown_venue_ids":[]) ?? [])|safe_array) {
                          each as $vid {
                            db.get genie_venues {
                              field_name = "id"
                              field_value = $vid
                            } as $vrow
                          
                            conditional {
                              if ($vrow != null) {
                                function.run "genie/fn_genie_slim_venue_row_dev" {
                                  input = {venue: $vrow}
                                } as $vcard
                              
                                var.update $cards {
                                  value = $cards|append:$vcard
                                }
                              }
                            }
                          }
                        }
                      
                        foreach ((($p|get:"shown_event_ids":[]) ?? [])|safe_array) {
                          each as $eid {
                            db.get genie_social_events {
                              field_name = "id"
                              field_value = $eid
                            } as $erow
                          
                            conditional {
                              if ($erow != null) {
                                var.update $event_rows {
                                  value = $event_rows|append:$erow
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  
                    // Plain variables only inside the object (no ternaries or filter chains).
                    var $m_id {
                      value = $row|get:"id":null
                    }
                  
                    var $m_text {
                      value = ($row|get:"message_text":"") ?? ""
                    }
                  
                    var $m_created_at {
                      value = $row|get:"created_at":null
                    }
                  
                    var $m_role {
                      value = "user"
                    }
                  
                    var $m_turn_index {
                      value = null
                    }
                  
                    var $m_turn_kind {
                      value = null
                    }
                  
                    var $m_request_index {
                      value = null
                    }
                  
                    var $m_refers {
                      value = null
                    }
                  
                    var $m_query_mode {
                      value = null
                    }
                  
                    var $m_picks {
                      value = []
                    }
                  
                    conditional {
                      if ($is_genie) {
                        var.update $m_role {
                          value = "genie"
                        }
                      
                        var.update $m_turn_index {
                          value = $p|get:"turn_index":null
                        }
                      
                        var.update $m_turn_kind {
                          value = $p|get:"turn_kind":null
                        }
                      
                        var.update $m_request_index {
                          value = $p|get:"request_index":null
                        }
                      
                        var.update $m_refers {
                          value = $p
                            |get:"refers_to_request_index":null
                        }
                      
                        var.update $m_query_mode {
                          value = $p|get:"query_mode":null
                        }
                      
                        var.update $m_picks {
                          value = (($p|get:"picks":[]) ?? [])|safe_array
                        }
                      }
                    }
                  
                    var $msg {
                      value = {
                        id                     : $m_id
                        role                   : $m_role
                        text                   : $m_text
                        created_at             : $m_created_at
                        turn_index             : $m_turn_index
                        turn_kind              : $m_turn_kind
                        request_index          : $m_request_index
                        refers_to_request_index: $m_refers
                        query_mode             : $m_query_mode
                        picks                  : $m_picks
                        turn_venues            : $cards
                        turn_events            : $event_rows
                      }
                    }
                  
                    var.update $messages_out {
                      value = $messages_out|append:$msg
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  response = {
    found          : $found
    conversation_id: $conversation_id_out
    session        : $session_out
    messages       : $messages_out
  }
}