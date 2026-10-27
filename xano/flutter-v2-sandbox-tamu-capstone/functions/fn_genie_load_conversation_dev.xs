// Conversation v1: loads one Genie conversation (one genie_session) from genie_message.
// User rows are the user's messages (logged by fn_genie_request_lifecycle_dev); genie rows are
// Genie's replies (logged by fn_genie_handle_message_v2_dev) and carry the turn state in
// raw_payload (v: 1, turn_kind, request_index, filters, shown_venue_ids, picks, ...).
// Returns:
// - history: the last max_history messages as chat messages [{role, content}] for the model
// - history_text: the same messages as plain text for the filter/turn classifier
// - requests: every request turn in order [{request_index, request_text, query_mode, city,
//   filters, shown_venue_ids, shown_event_ids, picks}]
// - requests_text: one line per request with its numbered picks, for "the second one" references
// - latest_request_index, turn_count, last_genie_payload
// The current turn's user message is excluded with exclude_message_id.
// Plain XanoScript only (no lambda), so it gives the same result on every call. Read-only and
// never throws: a failure returns an empty conversation with ok = false and the error.
function "genie/fn_genie_load_conversation_dev" {
  input {
    // genie_session.id of the conversation
    int session_id
  
    // The current turn's genie_message id, left out of the history
    int? exclude_message_id?
  
    // How many recent messages go to the model (default 6)
    int max_history?
  
    // How many rows to read (default 80)
    int max_rows?
  }

  stack {
    var $max_history {
      value = $input.max_history|first_notempty:6
    }
  
    var $max_rows {
      value = $input.max_rows|first_notempty:80
    }
  
    var $exclude_id {
      value = ($input.exclude_message_id ?? 0)|to_int
    }
  
    var $ok {
      value = true
    }
  
    var $error_out {
      value = null
    }
  
    var $row_count {
      value = 0
    }
  
    var $visible {
      value = []
    }
  
    var $history {
      value = []
    }
  
    var $history_text {
      value = ""
    }
  
    var $requests {
      value = []
    }
  
    var $requests_text {
      value = ""
    }
  
    var $latest_request_index {
      value = 0
    }
  
    var $turn_count {
      value = 0
    }
  
    var $last_genie_payload {
      value = null
    }
  
    try_catch {
      try {
        var $rows_newest_first {
          value = []
        }
      
        conditional {
          if ((($input.session_id ?? 0)|to_int) > 0) {
            db.query genie_message {
              where = $db.genie_message.session == $input.session_id
              sort = {id: "desc"}
              return = {type: "list", paging: {page: 1, per_page: $max_rows}}
            } as $msg_page
          
            var.update $rows_newest_first {
              value = (($msg_page|get:"items":[]) ?? [])|safe_array
            }
          }
        }
      
        var.update $row_count {
          value = $rows_newest_first|count
        }
      
        var $rows {
          value = $rows_newest_first|reverse
        }
      
        // 1) Visible rows in order, without the current turn's user message.
        foreach ($rows) {
          each as $r {
            var $r_id {
              value = ($r|get:"id":0)|to_int
            }
          
            var $r_visible {
              value = ($r|get:"is_visible_to_user":true) ?? true
            }
          
            var $r_sender {
              value = (($r|get:"sender_type":"") ?? "")|to_lower
            }
          
            var $r_text {
              value = (($r|get:"message_text":"") ?? "")|trim
            }
          
            var $r_payload {
              value = ($r|get:"raw_payload":null) ?? null
            }
          
            conditional {
              if ($r_id != $exclude_id && $r_visible != false && $r_text != "") {
                var $r_item {
                  value = {
                    is_genie: $r_sender == "genie"
                    text    : $r_text
                    payload : $r_payload
                  }
                }
              
                array.push $visible {
                  value = $r_item
                }
              }
            }
          }
        }
      
        // 2) Requests, turn count and the last Genie payload.
        foreach ($visible) {
          each as $vg {
            var $vg_payload {
              value = $vg|get:"payload":null
            }
          
            var $vg_v {
              value = 0
            }
          
            conditional {
              if (($vg|get:"is_genie":false) && $vg_payload != null) {
                var.update $vg_v {
                  value = (($vg_payload|get:"v":0) ?? 0)|to_int
                }
              }
            }
          
            conditional {
              if ($vg_v >= 1) {
                var.update $last_genie_payload {
                  value = $vg_payload
                }
              
                var $vg_turn_index {
                  value = (($vg_payload|get:"turn_index":0) ?? 0)|to_int
                }
              
                conditional {
                  if ($vg_turn_index > $turn_count) {
                    var.update $turn_count {
                      value = $vg_turn_index
                    }
                  }
                }
              
                var $vg_kind {
                  value = ($vg_payload|get:"turn_kind":"") ?? ""
                }
              
                var $vg_request_index {
                  value = (($vg_payload|get:"request_index":0) ?? 0)|to_int
                }
              
                conditional {
                  if ($vg_kind == "request" && $vg_request_index > 0) {
                    conditional {
                      if ($vg_request_index > $latest_request_index) {
                        var.update $latest_request_index {
                          value = $vg_request_index
                        }
                      }
                    }
                  
                    var $q_text {
                      value = (($vg_payload|get:"request_text":"") ?? "")|substr:0:200
                    }
                  
                    var $q_mode {
                      value = ($vg_payload|get:"query_mode":"venue") ?? "venue"
                    }
                  
                    var $q_city {
                      value = ($vg_payload|get:"city":"") ?? ""
                    }
                  
                    var $q_filters {
                      value = ($vg_payload|get:"filters":{}) ?? {}
                    }
                  
                    var $q_venue_ids {
                      value = (($vg_payload|get:"shown_venue_ids":[]) ?? [])|safe_array
                    }
                  
                    var $q_event_ids {
                      value = (($vg_payload|get:"shown_event_ids":[]) ?? [])|safe_array
                    }
                  
                    var $q_picks {
                      value = (($vg_payload|get:"picks":[]) ?? [])|safe_array
                    }
                  
                    var $q_item {
                      value = {
                        request_index  : $vg_request_index
                        request_text   : $q_text
                        query_mode     : $q_mode
                        city           : $q_city
                        filters        : $q_filters
                        shown_venue_ids: $q_venue_ids
                        shown_event_ids: $q_event_ids
                        picks          : $q_picks
                      }
                    }
                  
                    array.push $requests {
                      value = $q_item
                    }
                  
                    // "Request 2 (venues, Houston): "brunch" -> 1. A, 2. B, 3. C"
                    var $q_names {
                      value = []
                    }
                  
                    var $q_n {
                      value = 0
                    }
                  
                    foreach ($q_picks) {
                      each as $qp {
                        var $qp_name {
                          value = ($qp|get:"venue_name":"") ?? ""
                        }
                      
                        conditional {
                          if ($qp_name == "") {
                            var.update $qp_name {
                              value = ($qp|get:"event_name":"") ?? ""
                            }
                          }
                        }
                      
                        conditional {
                          if ($qp_name != "") {
                            var.update $q_n {
                              value = $q_n + 1
                            }
                          
                            var $qp_line {
                              value = ($q_n|to_text) ~ ". " ~ $qp_name
                            }
                          
                            array.push $q_names {
                              value = $qp_line
                            }
                          }
                        }
                      }
                    }
                  
                    var $q_what {
                      value = "venues"
                    }
                  
                    conditional {
                      if ($q_mode == "event") {
                        var.update $q_what {
                          value = "events"
                        }
                      }
                    }
                  
                    var $q_line {
                      value = "Request " ~ ($vg_request_index|to_text) ~ " (" ~ $q_what
                    }
                  
                    conditional {
                      if ($q_city != "") {
                        var.update $q_line {
                          value = $q_line ~ ", " ~ $q_city
                        }
                      }
                    }
                  
                    var.update $q_line {
                      value = $q_line ~ '): "' ~ $q_text ~ '"'
                    }
                  
                    conditional {
                      if (($q_names|count) > 0) {
                        var.update $q_line {
                          value = $q_line ~ " -> " ~ ($q_names|join:", ")
                        }
                      }
                    }
                  
                    conditional {
                      if ($requests_text != "") {
                        var.update $requests_text {
                          value = $requests_text ~ "\n"
                        }
                      }
                    }
                  
                    var.update $requests_text {
                      value = $requests_text ~ $q_line
                    }
                  }
                }
              }
            }
          }
        }
      
        // 3) The last max_history messages as chat history and as text.
        var $visible_count {
          value = $visible|count
        }
      
        var $start {
          value = $visible_count - $max_history
        }
      
        conditional {
          if ($start < 0) {
            var.update $start {
              value = 0
            }
          }
        }
      
        var $recent {
          value = $visible|slice:$start:$max_history
        }
      
        foreach ($recent) {
          each as $h {
            var $h_is_genie {
              value = $h|get:"is_genie":false
            }
          
            var $h_text {
              value = ($h|get:"text":"") ?? ""
            }
          
            var $h_role {
              value = "user"
            }
          
            var $h_tag {
              value = "User"
            }
          
            conditional {
              if ($h_is_genie) {
                var.update $h_role {
                  value = "assistant"
                }
              
                var.update $h_tag {
                  value = "Genie"
                }
              
                var $h_payload {
                  value = $h|get:"payload":null
                }
              
                conditional {
                  if ($h_payload != null) {
                    var $h_req {
                      value = (($h_payload|get:"request_index":0) ?? 0)|to_int
                    }
                  
                    var $h_ref {
                      value = (($h_payload|get:"refers_to_request_index":0) ?? 0)|to_int
                    }
                  
                    conditional {
                      if ((($h_payload|get:"turn_kind":"") ?? "") == "request" && $h_req > 0) {
                        var.update $h_tag {
                          value = "Genie (request " ~ ($h_req|to_text) ~ ")"
                        }
                      }
                    
                      elseif ($h_ref > 0) {
                        var.update $h_tag {
                          value = "Genie (follow-up on request " ~ ($h_ref|to_text) ~ ")"
                        }
                      }
                    }
                  }
                }
              }
            }
          
            var $h_content {
              value = $h_text|substr:0:1200
            }
          
            var $h_msg {
              value = {role: $h_role, content: $h_content}
            }
          
            array.push $history {
              value = $h_msg
            }
          
            var $h_line {
              value = $h_tag ~ ": " ~ ($h_text|substr:0:300)
            }
          
            conditional {
              if ($history_text != "") {
                var.update $history_text {
                  value = $history_text ~ "\n"
                }
              }
            }
          
            var.update $history_text {
              value = $history_text ~ $h_line
            }
          }
        }
      }
    
      catch {
        var.update $ok {
          value = false
        }
      
        var.update $error_out {
          value = {code: $error.code, message: $error.message}
        }
      
        var.update $history {
          value = []
        }
      
        var.update $history_text {
          value = ""
        }
      
        var.update $requests {
          value = []
        }
      
        var.update $requests_text {
          value = ""
        }
      
        var.update $latest_request_index {
          value = 0
        }
      
        var.update $turn_count {
          value = 0
        }
      
        var.update $last_genie_payload {
          value = null
        }
      
        debug.log {
          value = {
            checkpoint: "LOAD_CONVERSATION_FAILED"
            session_id: $input.session_id
            error     : $error.message
          }
        }
      }
    }
  }

  response = {
    ok                  : $ok
    error               : $error_out
    history             : $history
    history_text        : $history_text
    requests            : $requests
    requests_text       : $requests_text
    latest_request_index: $latest_request_index
    turn_count          : $turn_count
    last_genie_payload  : $last_genie_payload
    row_count           : $row_count
  }
}