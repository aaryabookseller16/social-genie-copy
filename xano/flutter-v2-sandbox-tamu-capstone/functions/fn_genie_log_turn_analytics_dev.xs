// GEN-072: the analytics writes that fn_genie_handle_message_dev made at the end of a turn
// (genie_query_log and the behavior signal), split out so the v2 handler can write them once the
// final venue count is known, without running the legacy venue stage. Never throws.
function "genie/fn_genie_log_turn_analytics_dev" {
  input {
    int user_id?
    text external_user_id?
    text message?
    text city?
    text query_mode?
  
    // The session id the endpoint sent (genie_temp_sessions), as text; stored on the query log.
    text temp_session_id?
  
    // The genie_session id from the lifecycle function, as text; sent with the behavior signal.
    text session_id?
  
    // {acquisition_source, nearest_match_id} from the lifecycle function.
    json session_meta?
  
    int venue_count?
    text detected_intent?
  }

  stack {
    var $ok {
      value = true
    }
  
    var $error_out {
      value = null
    }
  
    var $query_category {
      value = "general"
    }
  
    try_catch {
      try {
        var $m {
          value = ($input.message ?? "")|to_lower
        }
      
        conditional {
          if (($m|contains:"watch") || ($m|contains:"match") || ($m|contains:"fifa") || ($m|contains:"world cup") || ($m|contains:"game")) {
            var.update $query_category {
              value = "world_cup"
            }
          }
        }
      
        conditional {
          if (($query_category == "general") && (($m|contains:"restaurant") || ($m|contains:"eat") || ($m|contains:"food") || ($m|contains:"brunch") || ($m|contains:"dinner") || ($m|contains:"lunch"))) {
            var.update $query_category {
              value = "dining"
            }
          }
        }
      
        conditional {
          if (($query_category == "general") && (($m|contains:"bar") || ($m|contains:"club") || ($m|contains:"nightlife") || ($m|contains:"drinks") || ($m|contains:"late night"))) {
            var.update $query_category {
              value = "nightlife"
            }
          }
        }
      
        conditional {
          if (($query_category == "general") && (($m|contains:"event") || ($m|contains:"concert") || ($m|contains:"show") || ($m|contains:"tonight"))) {
            var.update $query_category {
              value = "event_discovery"
            }
          }
        }
      
        conditional {
          if (($query_category == "general") && (($m|contains:"near me") || ($m|contains:"nearby") || ($m|contains:"close to"))) {
            var.update $query_category {
              value = "venue_discovery"
            }
          }
        }
      
        conditional {
          if (($query_category == "general") && (($m|contains:"directions") || ($m|contains:"how do i get") || ($m|contains:"uber"))) {
            var.update $query_category {
              value = "directions"
            }
          }
        }
      
        conditional {
          if (($query_category == "general") && (($m|contains:"midtown") || ($m|contains:"downtown") || ($m|contains:"montrose") || ($m|contains:"heights") || ($m|contains:"eado") || ($m|contains:"galleria") || ($m|contains:"museum district") || ($m|contains:"third ward"))) {
            var.update $query_category {
              value = "neighborhood"
            }
          }
        }
      
        var $in_wc_window {
          value = false
        }
      
        var $today {
          value = now|format_timestamp:"Y-m-d":"UTC"
        }
      
        conditional {
          if (($today >= "2026-06-14") && ($today <= "2026-07-19")) {
            var.update $in_wc_window {
              value = true
            }
          }
        }
      
        db.add genie_query_log {
          enforce_hidden_fields = false
          data = {
            session_id           : ($input.temp_session_id ?? "")
            user_id              : ($input.user_id ?? 0)|to_int
            query_text           : ($input.message ?? "")
            query_language       : "en"
            query_category       : $query_category
            neighborhood_queried : ($input.city ?? "")
            venue_returned       : (($input.venue_count ?? 0) > 0)
            venues_returned_count: ($input.venue_count ?? 0)
            is_worldcup_window   : $in_wc_window
            acquisition_source   : (($input.session_meta|get:"acquisition_source":"") ?? "")
            nearest_match_id     : (($input.session_meta|get:"nearest_match_id":null)|to_int)
            created_at           : now|to_ms
          }
        } as $qlog_entry
      
        // The behavior signal needs a real user.
        conditional {
          if ((($input.user_id ?? 0)|to_int) > 0) {
            function.run "genie/fn_genie_write_behavior_signal_dev" {
              input = {
                user_id         : ($input.user_id ?? 0)|to_int
                external_user_id: ($input.external_user_id ?? "")
                message_text    : ($input.message ?? "")
                city            : ($input.city ?? "")
                query_mode      : ($input.query_mode ?? "venue")
                detected_intent : ($input.detected_intent ?? "general")
                query_category  : $query_category
                session_id      : ($input.session_id ?? "")
              }
            } as $behavior_signal_resp
          }
        }
      }
    
      catch {
        var.update $ok {
          value = false
        }
      
        var.update $error_out {
          value = {
            message: "analytics_exception"
            code   : $error.code
            detail : $error.message
          }
        }
      }
    }
  }

  response = {
    ok            : $ok
    query_category: $query_category
    error         : $error_out
  }
}