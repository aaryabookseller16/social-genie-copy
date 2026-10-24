// Routes Genie requests by query mode, resolving the city and coordinating lifecycle, event, and venue flows.
// Enriches venue results with search, context, weather, and model picks, then returns a unified response.
// Conversation v1: every message is one turn of a conversation (one genie_session, keyed by
// session_token). Each turn is either:
// - a REQUEST: a fresh search that always returns 3 choices (venues, or events for event mode).
//   It can build on an earlier request (inherit its filters, exclude what was already shown).
// - a FOLLOWUP: no search; a free-form reply about venues and events shown earlier in the
//   conversation, with cards only for the items the reply is about.
// fn_genie_resolve_turn_kind_dev makes the call (client hint > first request > model > keywords).
// Genie's reply is logged to genie_message with the turn state in raw_payload, which
// fn_genie_load_conversation_dev reads back on the next turn.
function "genie/fn_genie_handle_message_v2_dev" {
  input {
    // The user's message
    text message

    // The messaging channel
    text channel

    // The unique identifier for the user on the channel
    text external_user_id

    // The user's display name
    text user_name?

    // The city context for the conversation
    text city_context?

    // The session token if available
    text session_token?

    // The user's latitude
    decimal lat?

    // The user's longitude
    decimal lng?

    // The search radius in meters
    int radius_meters?

    // A label for the user's location
    text location_label?

    // Current query number in session
    int? session_query_number?=0

    // Session ID if available
    text? session_id?

    // Device ID from the web app; finds a guest's user context (GEN-013)
    text? device_id? filters=trim

    // Conversation v1: optional client hint, "request" | "followup"
    text? turn_hint? filters=trim
  }

  stack {
    var $v2_started_at {
      value = "now"|to_ms
    }

    var $filter_extraction_ms {
      value = 0
    }

    var $lifecycle_ms {
      value = 0
    }

    var $search_ms {
      value = 0
    }

    var $pick_ms {
      value = 0
    }

    var $inner_timings {
      value = {}
    }

    var $ranked_search_cards {
      value = []
    }

    // 1. Declare variables
    var $final_reply {
      value = null
    }

    var $final_use_xano {
      value = false
    }

    var $final_reply_mode {
      value = ""
    }

    var $final_needs_location {
      value = false
    }

    var $final_filters {
      value = {}
    }

    var $final_show_intake_prompt {
      value = false
    }

    var $final_intake_prompt_copy {
      value = ""
    }

    var $final_profile_strength_tier {
      value = null
    }

    var $final_debug {
      value = null
    }

    var $venue_results {
      value = []
    }

    var $final_more_nearby_venues {
      value = []
    }

    var $event_results {
      value = []
    }

    var $enriched_events {
      value = []
    }

    var $query_mode {
      value = "venue"
    }

    var $weather_context_text {
      value = ""
    }

    var $should_avoid_outdoor {
      value = false
    }

    var $should_promote_outdoor {
      value = false
    }

    var $neighborhood_context {
      value = null
    }

    // City fields below are filled in by the resolver in step 1b.
    var $city_id {
      value = null
    }

    var $resolved_city_name {
      value = ""
    }

    var $loc_source {
      value = "none"
    }

    var $geo_used {
      value = false
    }

    var $loc_status {
      value = "ok"
    }

    var $supported_cities {
      value = []
    }

    var $unsupported_city_name {
      value = ""
    }

    var $inner_lat {
      value = 0
    }

    var $inner_lng {
      value = 0
    }

    // GEN-013: user context and request-first search. Kill switches: set to false to skip.
    var $context_enabled {
      value = true
    }

    var $search_enabled {
      value = true
    }

    var $user_context_text {
      value = ""
    }

    var $preference_keywords {
      value = []
    }

    // GEN-014: the user's dislikes ("not into"), a small ranking penalty in the search.
    var $avoid_keywords {
      value = []
    }

    var $context_debug {
      value = {enabled: $context_enabled, source: "none"}
    }

    var $search_match_quality {
      value = ""
    }

    var $search_debug {
      value = {enabled: $search_enabled, used: false}
    }

    // GEN-071: model filters (any language) and one ranker. Kill switches: set to false to skip.
    var $filters_model_enabled {
      value = true
    }

    var $search_all_turns {
      value = true
    }

    var $mf {
      value = {ok: false}
    }

    // The resolver only returns "ok" for an active city, so the search city is always usable then.
    var $search_city_ok {
      value = true
    }

    var $city_debug {
      value = {source: "none", city_id: null}
    }

    var $event_fallback {
      value = false
    }

    // GEN-072: lifecycle result, intent for the reply bank, and the search failure flag.
    var $lifecycle {
      value = {}
    }

    // True only on venue/event request turns: gates the search-result replies and analytics,
    // as before. The lifecycle itself now runs on every turn (conversation v1).
    var $lifecycle_ran {
      value = false
    }

    var $detected_intent {
      value = "general"
    }

    var $search_failed {
      value = false
    }

    // Conversation v1: turn state.
    var $conversation_enabled {
      value = true
    }

    var $conv {
      value = {
        ok                  : false
        history             : []
        history_text        : ""
        requests            : []
        requests_text       : ""
        latest_request_index: 0
        turn_count          : 0
        last_genie_payload  : null
      }
    }

    var $conv_session_id {
      value = 0
    }

    var $turn {
      value = {
        turn_kind              : "request"
        refers_to_request_index: null
        inherit_filters        : false
        wants_more             : false
        source                 : "default"
      }
    }

    var $turn_kind {
      value = "request"
    }

    var $turn_index {
      value = 1
    }

    var $request_index {
      value = null
    }

    var $refers_to_request_index {
      value = null
    }

    var $base_request {
      value = null
    }

    var $exclude_venue_ids {
      value = []
    }

    var $exclude_event_ids {
      value = []
    }

    var $excluded_count {
      value = 0
    }

    var $stored_filters {
      value = {}
    }

    var $turn_venues {
      value = []
    }

    var $turn_events {
      value = []
    }

    var $followup_query_mode {
      value = "venue"
    }

    var $genie_message_id {
      value = null
    }

    // The text the request is about. Usually the message; after a "which city?" prompt it is
    // the pending request plus the user's answer.
    var $search_message {
      value = ($input.message ?? "")|trim
    }

    // Local time for the prompts. Supported cities are on US Central time today.
    var $now_text {
      value = ""
    }

    try_catch {
      try {
        var.update $now_text {
          value = now|format_timestamp:"l, F j, Y g:i A":"America/Chicago"
        }
      }

      catch {
        var.update $now_text {
          value = ""
        }
      }
    }

    // 1b. Resolve which supported city this request is about, and whether the
    // user's coordinates apply to it.
    function.run "genie/fn_genie_resolve_city_dev" {
      input = {
        message         : $input.message
        city_context    : $input.city_context
        lat             : $input.lat
        lng             : $input.lng
        session_token   : $input.session_token
        external_user_id: $input.external_user_id
      }
    } as $city_res

    var.update $loc_status {
      value = $city_res
        |get:"location_status":"city_missing"
    }

    var.update $city_id {
      value = $city_res|get:"city_id":null
    }

    var.update $resolved_city_name {
      value = $city_res|get:"city_name":""
    }

    var.update $loc_source {
      value = $city_res|get:"source":"none"
    }

    var.update $geo_used {
      value = $city_res|get:"geo_used":false
    }

    var.update $supported_cities {
      value = $city_res|get:"supported_cities":[]
    }

    var.update $unsupported_city_name {
      value = $city_res|get:"unsupported_city":""
    }

    var.update $city_debug {
      value = {
        source  : $loc_source
        city_id : $city_id
        city    : $resolved_city_name
        geo_used: $geo_used
        status  : $loc_status
      }
    }

    // Only pass coordinates down when they belong to the resolved city.
    conditional {
      if ($geo_used) {
        var.update $inner_lat {
          value = ($input.lat ?? 0)|to_decimal
        }

        var.update $inner_lng {
          value = ($input.lng ?? 0)|to_decimal
        }
      }
    }

    // 1c. Conversation v1: lifecycle on every turn (identify user, get or create the session,
    // log the user message), then load the conversation so far.
    var $lifecycle_started_at {
      value = "now"|to_ms
    }

    function.run "genie/fn_genie_request_lifecycle_dev" {
      input = {
        message         : $input.message
        channel         : $input.channel
        external_user_id: $input.external_user_id
        user_name       : $input.user_name
        city_name       : $resolved_city_name
        session_token   : $input.session_token
      }
    } as $lifecycle_resp

    var.update $lifecycle {
      value = $lifecycle_resp
    }

    var.update $lifecycle_ms {
      value = ("now"|to_ms) - $lifecycle_started_at
    }

    var.update $inner_timings {
      value = {
        user_ms   : $lifecycle|get:"t_user_ms":null
        session_ms: $lifecycle|get:"t_session_ms":null
        log_ms    : $lifecycle|get:"t_log_ms":null
        total_ms  : $lifecycle|get:"t_total_ms":null
      }
    }

    var.update $conv_session_id {
      value = (($lifecycle|get:"session_id":0) ?? 0)|to_int
    }

    conditional {
      if ($conversation_enabled && $conv_session_id > 0) {
        function.run "genie/fn_genie_load_conversation_dev" {
          input = {
            session_id        : $conv_session_id
            exclude_message_id: $lifecycle|get:"user_message_id":null
            max_history       : 6
          }
        } as $conv_resp

        var.update $conv {
          value = $conv_resp
        }
      }
    }

    var.update $turn_index {
      value = ((($conv|get:"turn_count":0) ?? 0)|to_int) + 1
    }

    // After a "which city?" prompt, the answer completes the pending request.
    var $last_payload {
      value = $conv|get:"last_genie_payload":null
    }

    conditional {
      if ($last_payload != null && ($last_payload|get:"kind":"") == "location_prompt" && ((($last_payload|get:"pending_request_text":"") ?? "")|trim) != "") {
        var.update $search_message {
          value = ((($last_payload|get:"pending_request_text":"")|trim) ~ " ") ~ $search_message
        }
      }
    }

    // 1d. No usable city: answer with a follow-up question instead of searching. The question is
    // logged as a turn so the answer can complete the request next time.
    conditional {
      if ($loc_status != "ok") {
        var $supported_text {
          value = $supported_cities|join:", "
        }

        var $early_reply {
          value = ""
        }

        conditional {
          if ($loc_status == "unsupported_city") {
            var.update $early_reply {
              value = ((("I don't cover " ~ $unsupported_city_name) ~ " yet. Right now I can search ") ~ $supported_text) ~ ". Want me to look there?"
            }
          }

          elseif ($loc_status == "outside_supported_area") {
            var.update $early_reply {
              value = ("It looks like you're outside the cities I cover right now. I can search " ~ $supported_text) ~ ". Which one should I use?"
            }
          }

          else {
            var.update $early_reply {
              value = ("Which city should I search? I can cover " ~ $supported_text) ~ "."
            }
          }
        }

        debug.log {
          value = {
            checkpoint      : "V2_CITY_UNRESOLVED"
            location_status : $loc_status
            source          : $loc_source
            unsupported_city: $unsupported_city_name
          }
        }

        var $early_latest {
          value = (($conv|get:"latest_request_index":0) ?? 0)|to_int
        }

        var $early_refers {
          value = null
        }

        conditional {
          if ($early_latest > 0) {
            var.update $early_refers {
              value = $early_latest
            }
          }
        }

        var $early_user_message_id {
          value = ($lifecycle|get:"user_message_id":null) ?? null
        }

        var $early_token {
          value = ($lifecycle|get:"session_token":null) ?? $input.session_token
        }

        conditional {
          if ($conv_session_id > 0) {
            try_catch {
              try {
                var $early_payload {
                  value = {
                    v                      : 1
                    kind                   : "location_prompt"
                    turn_index             : $turn_index
                    turn_kind              : "followup"
                    request_index          : null
                    refers_to_request_index: $early_refers
                    pending_request_text   : $search_message
                    location_status        : $loc_status
                    user_message_id        : $early_user_message_id
                  }
                }

                function.run "genie/fn_genie_log_message_dev" {
                  input = {
                    session_id  : $conv_session_id
                    sender_type : "genie"
                    message_text: $early_reply
                    raw_payload : $early_payload
                  }
                } as $early_log
              }

              catch {
                debug.log {
                  value = {checkpoint: "V2_EARLY_REPLY_LOG_FAILED"}
                }
              }
            }
          }
        }

        return {
          value = {
            success                : true
            reply                  : $early_reply
            use_xano               : false
            reply_mode             : $loc_status
            venues                 : []
            more_nearby_venues     : []
            events                 : []
            query_mode             : "venue"
            needs_location         : ($city_res|get:"wants_near_me":false) && (($city_res|get:"has_geo":false) == false)
            filters                : {}
            show_intake_prompt     : false
            intake_prompt_copy     : ""
            profile_strength_tier  : null
            debug                  : null
            weather_context_text   : ""
            should_avoid_outdoor   : false
            should_promote_outdoor : false
            neighborhood_context   : null
            is_outdoor_sensitive   : false
            detected_neighborhood  : ""
            pick_reasons           : []
            llm                    : {enabled: false, used: false}
            context                : {enabled: false, source: "none"}
            search                 : {enabled: false, used: false}
            resolved_city          : null
            city_source            : $loc_source
            geo_used               : false
            location_status        : $loc_status
            supported_cities       : $supported_cities
            unsupported_city       : $unsupported_city_name
            search_filters         : {ok: false}
            city                   : $city_debug
            turn_kind              : "followup"
            turn_index             : $turn_index
            request_index          : null
            refers_to_request_index: $early_refers
            turn_venues            : []
            turn_events            : []
            conversation_id        : $early_token
            turn                   : {source: "location_prompt"}
          }
        }
      }
    }

    // 2. Detect query mode
    function.run "genie/fn_genie_detect_query_mode_dev" {
      input = {message: $search_message, city_name: $resolved_city_name}
    } as $mode_result

    var.update $query_mode {
      value = $mode_result|get:"query_mode":"venue"
    }

    // 2b. GEN-071: the model reads the message in any language and sets the mode and filters.
    // The resolved city is passed as context. On any failure the keyword result above stands.
    // Conversation v1: the same call classifies the turn when there is a conversation.
    conditional {
      if ($filters_model_enabled) {
        try_catch {
          try {
            var $filter_started_at {
              value = "now"|to_ms
            }

            function.run "genie/fn_genie_extract_search_filters_dev" {
              input = {
                message      : $search_message
                city_context : $resolved_city_name
                history_text : $conv|get:"history_text":""
                requests_text: $conv|get:"requests_text":""
              }
            } as $mf_result

            var.update $filter_extraction_ms {
              value = ("now"|to_ms) - $filter_started_at
            }

            var.update $mf {
              value = $mf_result ?? {ok: false}
            }
          }

          catch {
            var.update $mf {
              value = {ok: false, fail_reason: "exception"}
            }
          }
        }
      }
    }

    // 2c. Conversation v1: request or follow-up. Code has the final say.
    function.run "genie/fn_genie_resolve_turn_kind_dev" {
      input = {
        message     : $input.message
        turn_hint   : $input.turn_hint
        model_result: $mf
        requests    : $conv|get:"requests":[]
      }
    } as $turn_resp

    var.update $turn {
      value = $turn_resp
    }

    var.update $turn_kind {
      value = ($turn|get:"turn_kind":"request") ?? "request"
    }

    var.update $refers_to_request_index {
      value = $turn|get:"refers_to_request_index":null
    }

    // The earlier request this turn refers to or builds on.
    conditional {
      if ($refers_to_request_index != null) {
        foreach (($conv|get:"requests":[])|safe_array) {
          each as $rq {
            conditional {
              if ((($rq|get:"request_index":0)|to_int) == ($refers_to_request_index|to_int)) {
                var.update $base_request {
                  value = $rq
                }
              }
            }
          }
        }
      }
    }

    conditional {
      if ($turn_kind == "request") {
        var.update $request_index {
          value = ((($conv|get:"latest_request_index":0) ?? 0)|to_int) + 1
        }

        // 2d. A request that builds on an earlier one: the earlier filters are the base and this
        // message's non-empty filters override them. With a failed filter model the earlier
        // filters are used as they are ("show me more").
        conditional {
          if (($turn|get:"inherit_filters":false) && $base_request != null) {
            var $base_filters {
              value = ($base_request|get:"filters":{}) ?? {}
            }

            api.lambda {
              code = """
                const base = $var.base_filters && typeof $var.base_filters === "object" ? $var.base_filters : {};
                const mf = $var.mf && typeof $var.mf === "object" ? $var.mf : {};
                const keys = ["venue_type", "cuisine", "meal_service", "neighborhood", "price_band", "energy", "language", "city"];
                const out = Object.assign({}, mf, { ok: true });
                for (const k of keys) {
                  const nv = typeof mf[k] === "string" ? mf[k].trim() : "";
                  const bv = typeof base[k] === "string" ? base[k].trim() : "";
                  out[k] = mf.ok === true && nv !== "" ? nv : bv;
                }
                out.open_now = (mf.ok === true && mf.open_now === true) || base.open_now === true;
                const kw = [].concat(Array.isArray(base.keywords) ? base.keywords : [], mf.ok === true && Array.isArray(mf.keywords) ? mf.keywords : []);
                out.keywords = kw.map((k) => String(k).toLowerCase().trim()).filter((k, i, a) => k !== "" && a.indexOf(k) === i).slice(-5);
                const modes = ["venue", "event", "ambient"];
                out.mode = mf.ok === true && modes.includes(mf.mode) ? mf.mode : (modes.includes(base.mode) ? base.mode : "venue");
                out.inherited_from = $var.refers_to_request_index;
                return out;
                """
              timeout = 5
            } as $merged_mf

            var.update $mf {
              value = $merged_mf
            }
          }
        }

        // "More" / "different": leave out what was already shown in this conversation.
        conditional {
          if ($turn|get:"wants_more":false) {
            foreach (($conv|get:"requests":[])|safe_array) {
              each as $rq2 {
                var.update $exclude_venue_ids {
                  value = ($exclude_venue_ids|merge:(($rq2|get:"shown_venue_ids":[])|safe_array))|unique
                }

                var.update $exclude_event_ids {
                  value = ($exclude_event_ids|merge:(($rq2|get:"shown_event_ids":[])|safe_array))|unique
                }
              }
            }
          }
        }
      }

      else {
        // A follow-up never searches: the mode blocks below all skip "followup".
        var.update $followup_query_mode {
          value = ($base_request|get:"query_mode":"venue") ?? "venue"
        }

        var.update $query_mode {
          value = "followup"
        }
      }
    }

    conditional {
      if ($turn_kind == "request" && ($mf|get:"ok")) {
        var.update $query_mode {
          value = $mf|get:"mode"
        }
      }
    }

    // Event turns query events directly. If none match, route the same turn through venue search.
    conditional {
      if ($query_mode == "event") {
        var $ev_today {
          value = now|format_timestamp:"Y-m-d":"UTC"
        }

        var $ev_per_page {
          value = (($exclude_event_ids|count) > 0) ? 25 : 10
        }

        db.query genie_social_events {
          where = ($db.genie_social_events.city == $resolved_city_name || $db.genie_social_events.city == ($resolved_city_name|to_lower)) && $db.genie_social_events.status == "active" && $db.genie_social_events.event_date >= $ev_today
          sort = {event_date: "asc"}
          return = {type: "list", paging: {page: 1, per_page: $ev_per_page}}
        } as $ev_result

        var $ev_items {
          value = (($ev_result|get:"items") ?? [])|safe_array
        }

        // Conversation v1: "more events" leaves out the ones already shown.
        foreach ($ev_items) {
          each as $ev_item {
            conditional {
              if (($exclude_event_ids|in:(($ev_item|get:"id":0)|to_int)) == false && ($event_results|count) < 10) {
                var.update $event_results {
                  value = $event_results|append:$ev_item
                }
              }

              elseif (($exclude_event_ids|in:(($ev_item|get:"id":0)|to_int))) {
                var.update $excluded_count {
                  value = $excluded_count + 1
                }
              }
            }
          }
        }

        conditional {
          if (($event_results|count) > 0) {
            var.update $final_reply_mode {
              value = "has_results"
            }

            var.update $final_use_xano {
              value = true
            }

            var.update $final_reply {
              value = (("Here are some events happening in " ~ $resolved_city_name) ~ " that match your vibe.")
            }
          }

          else {
            var.update $event_fallback {
              value = true
            }

            var.update $query_mode {
              value = "venue"
            }
          }
        }
      }
    }

    // 3. Get weather context. Wrapped so a weather subsystem failure
    // can't take down the whole chat endpoint; falls back to safe defaults.
    var $weather_result {
      value = null
    }

    try_catch {
      try {
        function.run "genie/fn_genie_update_handle_message_weather_dev" {
          input = {city_id: $city_id, message: $search_message}
        } as $weather_result
      }

      catch {
        var.update $weather_result {
          value = null
        }
      }
    }

    var.update $weather_context_text {
      value = $weather_result|get:"weather_context_text":""
    }

    var.update $should_avoid_outdoor {
      value = $weather_result|get:"should_avoid_outdoor":false
    }

    var.update $should_promote_outdoor {
      value = $weather_result
        |get:"should_promote_outdoor":false
    }

    // 4. Route by query_mode

    // VENUE MODE (default)
    // GEN-072: lifecycle results are applied for venue and event turns. Venue search and the direct
    // event query are the only sources of results; analytics are written at the end of the turn.
    conditional {
      if ($query_mode == "venue" || $query_mode == "event") {
        var.update $lifecycle_ran {
          value = true
        }

        var.update $final_show_intake_prompt {
          value = $lifecycle|get:"show_intake_prompt":false
        }

        var.update $final_intake_prompt_copy {
          value = $lifecycle|get:"intake_prompt_copy":""
        }

        var.update $final_profile_strength_tier {
          value = $lifecycle|get:"profile_strength_tier":null
        }

        // Filters returned to the client and used by the search's rules fallback when the model
        // filter extraction failed: keyword rules from the lifecycle function, overlaid with the
        // model's cuisine, meal service and venue type when it answered.
        var.update $final_filters {
          value = $lifecycle|get:"rules_filters":{}
        }

        conditional {
          if ($mf|get:"ok") {
            conditional {
              if ((($mf|get:"cuisine") ?? "") != "") {
                var.update $final_filters {
                  value = $final_filters
                    |merge:{cuisine: ($mf|get:"cuisine")}
                }
              }
            }

            conditional {
              if ((($mf|get:"meal_service") ?? "") != "") {
                var.update $final_filters {
                  value = $final_filters
                    |merge:{type: ($mf|get:"meal_service")}
                }
              }
            }

            conditional {
              if ((($mf|get:"venue_type") ?? "") != "") {
                var.update $final_filters {
                  value = $final_filters
                    |merge:{venue_type: ($mf|get:"venue_type")}
                }
              }
            }
          }
        }

        // Intent for the reply-bank fallback, from the model's meal service or the rules type.
        var $intent_src {
          value = (($mf|get:"meal_service") ?? "")|to_lower
        }

        conditional {
          if (["brunch", "happy_hour", "late_night"]|in:$intent_src) {
            var.update $detected_intent {
              value = $intent_src
            }
          }

          else {
            var $rules_type {
              value = (($final_filters|get:"type") ?? "")|to_lower
            }

            conditional {
              if (["brunch", "happy_hour", "late_night", "hookah", "patio", "date_night", "dinner"]|in:$rules_type) {
                var.update $detected_intent {
                  value = $rules_type
                }
              }
            }
          }
        }
      }
    }

    // NEIGHBORHOOD MODE
    conditional {
      if ($query_mode == "neighborhood") {
        function.run "genie/fn_genie_get_neighborhood_context_dev" {
          input = {
            neighborhood_name: $mode_result|get:"detected_neighborhood":""
            city_id          : $city_id
          }
        } as $hood_context

        var.update $neighborhood_context {
          value = $hood_context
        }

        function.run "genie/fn_genie_get_neighborhood_venues_dev" {
          input = {
            neighborhood_name: $mode_result|get:"detected_neighborhood":""
            city_id          : $city_id
            limit            : 10
          }
        } as $hood_venues

        var.update $venue_results {
          value = $hood_venues|get:"venues":[]
        }

        var.update $final_use_xano {
          value = (($venue_results|count) > 0)
        }

        conditional {
          if (($venue_results|count) > 0) {
            var.update $final_reply_mode {
              value = "has_results"
            }
          }

          else {
            var.update $final_reply_mode {
              value = "supported_no_results"
            }
          }
        }

        function.run "genie/fn_genie_get_reply_v2_dev" {
          input = {
            intent           : "general"
            reply_mode       : "neighborhood_intro"
            neighborhood_name: $mode_result|get:"detected_neighborhood":""
          }
        } as $hood_reply

        var.update $final_reply {
          value = $hood_reply
        }
      }
    }

    // AMBIENT MODE
    conditional {
      if ($query_mode == "ambient") {
        function.run "genie/fn_genie_get_ambient_recommendations_dev" {
          input = {
            city_id            : $city_id
            is_raining_now     : $weather_result|get:"is_raining_now":false
            is_good_for_outdoor: $weather_result|get:"is_good_for_outdoor":true
            limit              : 8
          }
        } as $ambient_result

        var.update $venue_results {
          value = $ambient_result|get:"venues":[]
        }

        var.update $event_results {
          value = $ambient_result|get:"events":[]
        }

        var.update $final_use_xano {
          value = ((($venue_results|count) + ($event_results|count)) > 0)
        }

        conditional {
          if ((($venue_results|count) + ($event_results|count)) > 0) {
            var.update $final_reply_mode {
              value = "has_results"
            }
          }

          else {
            var.update $final_reply_mode {
              value = "supported_no_results"
            }
          }
        }

        function.run "genie/fn_genie_get_reply_v2_dev" {
          input = {intent: "general", reply_mode: "ambient_tonight"}
        } as $ambient_reply

        var.update $final_reply {
          value = $ambient_reply
        }
      }
    }

    // 4a. User context (GEN-013). Read-only: linking happens at sign-in (merge_guest_profile),
    // never here. A failure leaves the context empty and never blocks the turn.
    // Conversation v1: follow-ups get it too (for the converse prompt).
    conditional {
      if ($context_enabled && ($query_mode == "venue" || $query_mode == "followup")) {
        try_catch {
          try {
            var $ctx_ext_id {
              value = ($input.external_user_id ?? "")|trim
            }

            var $ctx_user_id {
              value = 0
            }

            conditional {
              if ($ctx_ext_id != "" && $ctx_ext_id != "web_guest") {
                db.query genie_user {
                  where = $db.genie_user.external_user_id == $ctx_ext_id
                  return = {type: "single"}
                } as $ctx_user

                conditional {
                  if ($ctx_user != null) {
                    var.update $ctx_user_id {
                      value = $ctx_user.id
                    }
                  }
                }
              }
            }

            function.run "genie/fn_genie_resolve_user_context_dev" {
              input = {
                user_id         : $ctx_user_id
                device_id       : $input.device_id
                external_user_id: $ctx_ext_id
                link            : false
              }
            } as $ctx_resolved

            var $ctx_row {
              value = ($ctx_resolved|get:"row") ?? null
            }

            var $ctx_source {
              value = ($ctx_resolved|get:"source") ?? "none"
            }

            var $ctx_count {
              value = 0
            }

            var $ctx_truncated {
              value = false
            }

            conditional {
              if ($ctx_row != null) {
                var $ctx_json {
                  value = ($ctx_row|get:"context_json") ?? {}
                }

                function.run "genie/fn_genie_render_user_context_dev" {
                  input = {context: $ctx_json}
                } as $ctx_render

                var.update $user_context_text {
                  value = (($ctx_render|get:"text") ?? "")|trim
                }

                var.update $ctx_count {
                  value = ($ctx_render|get:"count") ?? 0
                }

                var.update $ctx_truncated {
                  value = ($ctx_render|get:"truncated") ?? false
                }

                // Preference keywords for the search bonus: live, non-sensitive tastes only.
                var $ctx_prefs {
                  value = ($ctx_json|get:"preferences") ?? []
                }

                conditional {
                  if ($ctx_prefs|is_array) {
                    var $ctx_live {
                      value = $ctx_prefs|filter:(($$.status == "active" || $$.status == "user_edited") && $$.sensitivity != "sensitive" && (["atmosphere", "experience", "food", "occasion"]|in:$$.category) && ($$|get:"sentiment") != "dislike")
                    }

                    var.update $preference_keywords {
                      value = ($ctx_live|map:(($$.value|to_lower)|trim))|slice:0:10
                    }

                    // GEN-014: dislikes, same categories; entries without sentiment are likes.
                    var $ctx_dislikes {
                      value = $ctx_prefs|filter:(($$.status == "active" || $$.status == "user_edited") && $$.sensitivity != "sensitive" && (["atmosphere", "experience", "food", "occasion"]|in:$$.category) && ($$|get:"sentiment") == "dislike")
                    }

                    var.update $avoid_keywords {
                      value = ($ctx_dislikes|map:(($$.value|to_lower)|trim))|slice:0:10
                    }
                  }
                }
              }
            }

            var.update $context_debug {
              value = {
                enabled  : true
                source   : $ctx_source
                user_id  : $ctx_user_id
                count    : $ctx_count
                chars    : $user_context_text|strlen
                truncated: $ctx_truncated
                keywords : $preference_keywords
                avoid    : $avoid_keywords
              }
            }
          }

          catch {
            var.update $user_context_text {
              value = ""
            }

            var.update $preference_keywords {
              value = []
            }

            var.update $avoid_keywords {
              value = []
            }

            var.update $context_debug {
              value = {enabled: true, source: "error"}
            }
          }
        }
      }
    }

    // 4a2. Request-first search (Zach's fn_genie_search_venues_dev) on every venue turn (GEN-071).
    // The user's location goes to the search ONLY when geo_used is true (device within 80 km of the
    // resolved city); a device in another city never restricts or distorts the search. When it finds
    // matches, its card rows replace the shortlist sent to the model and its match_quality goes into
    // the prompt; otherwise the legacy result stays. $search_all_turns = false restores the GEN-013
    // rule (only turns with legacy results, and not when the location is in use).
    conditional {
      if ($search_enabled && $query_mode == "venue" && $search_city_ok && ($search_all_turns || ($final_reply_mode == "has_results" && ($venue_results|count) > 0))) {
        conditional {
          if ($geo_used && $search_all_turns == false) {
            var.update $search_debug {
              value = {enabled: true, used: false, skipped: "location_used"}
            }
          }

          else {
            try_catch {
              try {
                var $sf {
                  value = $final_filters ?? {}
                }

                var $sf_type {
                  value = (($sf|get:"type") ?? "")|to_lower
                }

                var $s_meal {
                  value = ""
                }

                conditional {
                  if (["brunch", "happy_hour", "late_night", "reverse_happy_hour"]|in:$sf_type) {
                    var.update $s_meal {
                      value = $sf_type
                    }
                  }
                }

                var $s_cuisine {
                  value = (($sf|get:"cuisine") ?? "")|replace:"_":" "
                }

                var $s_keywords {
                  value = []
                }

                var $sf_venue_type {
                  value = ((($sf|get:"venue_type") ?? "")|replace:"_":" ")|trim
                }

                conditional {
                  if ($sf_venue_type != "") {
                    array.push $s_keywords {
                      value = $sf_venue_type
                    }
                  }
                }

                var $sf_occasion {
                  value = ((($sf|get:"occasion") ?? "")|replace:"_":" ")|trim
                }

                conditional {
                  if ($sf_occasion != "") {
                    array.push $s_keywords {
                      value = $sf_occasion
                    }
                  }
                }

                var $sf_vibe {
                  value = (($sf|get:"vibe") ?? "")|trim
                }

                conditional {
                  if ($sf_vibe != "") {
                    array.push $s_keywords {
                      value = $sf_vibe
                    }
                  }
                }

                conditional {
                  if ($sf_type == "hookah" || $sf_type == "patio") {
                    array.push $s_keywords {
                      value = $sf_type
                    }
                  }
                }

                // Venue type from the words of the message (bar, club, cafe, restaurant).
                var $msg_tokens {
                  value = ((((($search_message ?? "")|to_lower)|replace:",":" ")|replace:".":" ")|replace:"?":" ")|replace:"!":" "
                }

                var $msg_words {
                  value = $msg_tokens|split:" "
                }

                var $s_venue_type {
                  value = ""
                }

                conditional {
                  if (($msg_words|in:"club") || ($msg_words|in:"clubs") || ($msg_words|in:"nightclub")) {
                    var.update $s_venue_type {
                      value = "club"
                    }
                  }

                  elseif (($msg_words|in:"bar") || ($msg_words|in:"bars")) {
                    var.update $s_venue_type {
                      value = "bar"
                    }
                  }

                  elseif (($msg_words|in:"cafe") || ($msg_words|in:"coffee")) {
                    var.update $s_venue_type {
                      value = "cafe"
                    }
                  }

                  elseif (($msg_words|in:"restaurant") || ($msg_words|in:"restaurants") || ($msg_words|in:"dinner")) {
                    var.update $s_venue_type {
                      value = "restaurant"
                    }
                  }
                }

                var $s_open_now {
                  value = (($search_message ?? "")|icontains:"open now") || (($search_message ?? "")|icontains:"right now")
                }

                // GEN-071: the model's filters replace the English rules above when it answered.
                var $s_hood {
                  value = ""
                }

                var $s_price {
                  value = ""
                }

                var $s_energy {
                  value = ""
                }

                var $s_language {
                  value = ""
                }

                var $s_source {
                  value = "rules"
                }

                conditional {
                  if ($mf|get:"ok") {
                    var.update $s_venue_type {
                      value = ($mf|get:"venue_type") ?? ""
                    }

                    var.update $s_cuisine {
                      value = ($mf|get:"cuisine") ?? ""
                    }

                    var.update $s_meal {
                      value = ($mf|get:"meal_service") ?? ""
                    }

                    var.update $s_open_now {
                      value = ($mf|get:"open_now") == true
                    }

                    var.update $s_keywords {
                      value = ($mf|get:"keywords") ?? []
                    }

                    var.update $s_hood {
                      value = ($mf|get:"neighborhood") ?? ""
                    }

                    var.update $s_price {
                      value = ($mf|get:"price_band") ?? ""
                    }

                    var.update $s_energy {
                      value = ($mf|get:"energy") ?? ""
                    }

                    var.update $s_language {
                      value = ($mf|get:"language") ?? ""
                    }

                    var.update $s_source {
                      value = (($mf|get:"inherited_from":null) != null) ? "model_inherited" : "model"
                    }
                  }
                }

                // Conversation v1: the filters this request searched with, saved on the turn so a
                // later "cheaper?" or "more" can build on them.
                var.update $stored_filters {
                  value = {
                    mode        : "venue"
                    venue_type  : $s_venue_type
                    cuisine     : $s_cuisine
                    meal_service: $s_meal
                    open_now    : $s_open_now
                    keywords    : $s_keywords
                    neighborhood: $s_hood
                    price_band  : $s_price
                    energy      : $s_energy
                    language    : $s_language
                  }
                }

                // Location for the search: only when it belongs to the resolved city.
                var $s_lat {
                  value = null
                }

                var $s_lng {
                  value = null
                }

                var $s_radius {
                  value = null
                }

                conditional {
                  if ($geo_used) {
                    var.update $s_lat {
                      value = $inner_lat
                    }

                    var.update $s_lng {
                      value = $inner_lng
                    }
                  }
                }

                conditional {
                  if ($geo_used && (($input.radius_meters ?? 0)|to_int) > 0) {
                    var.update $s_radius {
                      value = $input.radius_meters|to_int
                    }
                  }
                }

                // Conversation v1: ask for more rows when already-shown venues will be left out.
                var $s_limit {
                  value = (($exclude_venue_ids|count) > 0) ? 25 : 10
                }

                var $search_started_at {
                  value = "now"|to_ms
                }

                function.run "genie/fn_genie_search_venues_dev" {
                  input = {
                    city_id            : $city_id
                    venue_type         : $s_venue_type
                    cuisine            : $s_cuisine
                    meal_service       : $s_meal
                    open_now           : $s_open_now
                    keywords           : $s_keywords
                    preference_keywords: $preference_keywords
                    avoid_keywords     : $avoid_keywords
                    limit              : $s_limit
                    neighborhood       : $s_hood
                    price_band         : $s_price
                    energy             : $s_energy
                    lat                : $s_lat
                    lng                : $s_lng
                    radius_m           : $s_radius
                    language           : $s_language
                  }
                } as $search_result

                var.update $search_ms {
                  value = ("now"|to_ms) - $search_started_at
                }

                var $s_cards_raw {
                  value = (($search_result|get:"cards") ?? [])|safe_array
                }

                var $s_cards {
                  value = []
                }

                foreach ($s_cards_raw) {
                  each as $s_card {
                    conditional {
                      if (($exclude_venue_ids|in:(($s_card|get:"id":0)|to_int)) == false && ($s_cards|count) < 10) {
                        var.update $s_cards {
                          value = $s_cards|append:$s_card
                        }
                      }

                      elseif (($exclude_venue_ids|in:(($s_card|get:"id":0)|to_int))) {
                        var.update $excluded_count {
                          value = $excluded_count + 1
                        }
                      }
                    }
                  }
                }

                var.update $ranked_search_cards {
                  value = $s_cards
                }

                var $s_quality {
                  value = ($search_result|get:"match_quality") ?? "empty"
                }

                var $s_used {
                  value = false
                }

                conditional {
                  if ($s_quality != "empty" && ($s_cards|is_array) && ($s_cards|count) > 0) {
                    var.update $venue_results {
                      value = $s_cards
                    }

                    var.update $search_match_quality {
                      value = $s_quality
                    }

                    var.update $s_used {
                      value = true
                    }

                    var.update $final_reply_mode {
                      value = "has_results"
                    }

                    var.update $final_use_xano {
                      value = true
                    }
                  }
                }

                var.update $search_debug {
                  value = {
                    enabled       : true
                    used          : $s_used
                    match_quality : $s_quality
                    relaxed       : ($search_result|get:"relaxed") ?? []
                    count         : ($search_result|get:"count") ?? 0
                    venue_type    : $s_venue_type
                    cuisine       : $s_cuisine
                    meal_service  : $s_meal
                    open_now      : $s_open_now
                    keywords      : $s_keywords
                    pref_keywords : $preference_keywords
                    avoid_keywords: $avoid_keywords
                    source        : $s_source
                    neighborhood  : $s_hood
                    price_band    : $s_price
                    energy        : $s_energy
                    geo_used      : $geo_used
                    excluded      : $excluded_count
                    ranking       : (($search_result|get:"debug") ?? {})|get:"ranking"
                  }
                }
              }

              catch {
                var.update $search_failed {
                  value = true
                }

                var.update $search_debug {
                  value = {enabled: true, used: false, skipped: "error"}
                }
              }
            }
          }
        }
      }
    }

    // GEN-071: the model's filters and the city also go into the search debug, which the chat
    // endpoint already returns.
    var.update $search_debug {
      value = ($search_debug|set:"filters":$mf)|set:"city":$city_debug
    }

    // GEN-072: search is the only source of venues on a venue turn. A search exception is its own
    // reply_mode; zero cards is a normal no-results answer (no legacy fallback list).
    conditional {
      if ($lifecycle_ran && $query_mode == "venue") {
        conditional {
          if ($search_failed) {
            var.update $final_reply_mode {
              value = "search_error"
            }

            var.update $final_use_xano {
              value = false
            }

            var.update $final_reply {
              value = "I hit a snag searching just now. Give it another try in a moment."
            }
          }

          elseif (($venue_results|count) == 0) {
            var.update $final_reply_mode {
              value = "supported_no_results"
            }

            var.update $final_use_xano {
              value = false
            }

            conditional {
              if ($excluded_count > 0) {
                var.update $final_reply {
                  value = (("That's everything I've got for that in " ~ $resolved_city_name) ~ " right now. Want to try a different vibe, cuisine or neighborhood?")
                }
              }

              else {
                var.update $final_reply {
                  value = (("I couldn't find a match for that in " ~ $resolved_city_name) ~ ". Try a different vibe, cuisine or neighborhood?")
                }
              }
            }
          }
        }
      }
    }

    // 4b. Model-driven picks for has_results turns (replaces LLM commentary).
    // Kill switch: set to false to go back to reply-bank text.
    var $model_call_enabled {
      value = true
    }

    var $pick_reasons {
      value = []
    }

    var $picked_venue_ids {
      value = []
    }

    var $selected_venue_ids {
      value = []
    }

    var $more_nearby_source {
      value = []
    }

    var $more_nearby_count {
      value = 0
    }

    var $llm_debug {
      value = {enabled: $model_call_enabled, used: false}
    }

    conditional {
      if ($model_call_enabled && $query_mode == "venue" && $final_reply_mode == "has_results" && ($venue_results|count) > 0) {
        try_catch {
          try {
            var $pick_started_at {
              value = "now"|to_ms
            }

            // Conversation v1: a request always uses the pick prompt (3 choices); the
            // conversation goes in as history so "cheaper" or "same vibe" make sense.
            function.run "genie/fn_genie_run_turn_dev" {
              input = {
                message      : $search_message
                venues       : $venue_results
                city         : $resolved_city_name
                match_quality: $search_match_quality
                user_context : $user_context_text
                now_text     : $now_text
                weather_text : $weather_context_text
                prompt_type  : "pick"
                history      : $conv|get:"history":[]
              }
            } as $model_result

            var.update $pick_ms {
              value = ("now"|to_ms) - $pick_started_at
            }

            conditional {
              if ($model_result|get:"used":false) {
                var.update $final_reply {
                  value = $model_result.reply
                }

                var.update $pick_reasons {
                  value = $model_result.pick_reasons
                }

                var.update $picked_venue_ids {
                  value = $model_result|get:"picked_ids":[]|safe_array
                }

                var.update $venue_results {
                  value = $model_result.venues
                }
              }
            }

            var.update $llm_debug {
              value = (($model_result|unpick:["reply", "pick_reasons", "venues"])|set:"enabled":true)|set:"prompt_type":"pick"
            }
          }

          catch {
            var.update $llm_debug {
              value = {enabled: true, used: false, fail_reason: "exception"}
            }
          }
        }
      }
    }

    // GEN-072: the pick model did not write a reply: use the reply bank, as the legacy handler did.
    conditional {
      if ($lifecycle_ran && $query_mode == "venue" && $final_reply_mode == "has_results" && (($final_reply == null) || (($final_reply|trim) == ""))) {
        try_catch {
          try {
            var $bank_mode {
              value = "has_results"
            }

            conditional {
              if (($city_res|get:"wants_near_me":false) && $geo_used) {
                var.update $bank_mode {
                  value = "near_me"
                }
              }
            }

            function.run "genie/fn_genie_get_reply_dev" {
              input = {intent: $detected_intent, reply_mode: $bank_mode}
            } as $bank_reply

            var.update $final_reply {
              value = $bank_reply
            }
          }

          catch {
            debug.log {
              value = {checkpoint: "V2_REPLY_BANK_FALLBACK_FAILED"}
            }
          }
        }
      }
    }

    // 4c. Conversation v1: FOLLOW-UP. No search. The candidates are the venues and events shown in
    // earlier requests (the referenced request first, then the most recent), and the reply is the
    // model's own text with cards only for the items it is about.
    var $followup_fallback_reply {
      value = "I'm not sure I caught that. Want me to tell you more about one of those spots, or look for something new?"
    }

    conditional {
      if ($turn_kind == "followup") {
        var $fu_requests {
          value = ($conv|get:"requests":[])|safe_array
        }

        api.lambda {
          code = """
            const reqs = Array.isArray($var.fu_requests) ? $var.fu_requests.slice() : [];
            const ref = Number($var.refers_to_request_index || 0);
            reqs.sort((a, b) => {
              const ai = Number(a.request_index) === ref ? 1 : 0;
              const bi = Number(b.request_index) === ref ? 1 : 0;
              if (ai !== bi) return bi - ai;
              return Number(b.request_index) - Number(a.request_index);
            });
            const venueIds = [];
            const eventIds = [];
            for (const r of reqs) {
              for (const id of (Array.isArray(r.shown_venue_ids) ? r.shown_venue_ids : [])) {
                const n = Number(id);
                if (n > 0 && !venueIds.includes(n) && venueIds.length < 15) venueIds.push(n);
              }
              for (const id of (Array.isArray(r.shown_event_ids) ? r.shown_event_ids : [])) {
                const n = Number(id);
                if (n > 0 && !eventIds.includes(n) && eventIds.length < 10) eventIds.push(n);
              }
            }
            return { venues: venueIds.map((id) => ({ id: id })), event_ids: eventIds };
            """
          timeout = 5
        } as $fu_cands

        var $fu_event_rows {
          value = []
        }

        foreach (($fu_cands|get:"event_ids":[])|safe_array) {
          each as $fu_eid {
            db.get genie_social_events {
              field_name = "id"
              field_value = $fu_eid
            } as $fu_event_row

            conditional {
              if ($fu_event_row != null) {
                var.update $fu_event_rows {
                  value = $fu_event_rows|append:$fu_event_row
                }
              }
            }
          }
        }

        var.update $final_reply_mode {
          value = "followup"
        }

        try_catch {
          try {
            var $fu_started_at {
              value = "now"|to_ms
            }

            function.run "genie/fn_genie_run_turn_dev" {
              input = {
                message          : $input.message
                venues           : $fu_cands|get:"venues":[]
                city             : $resolved_city_name
                user_context     : $user_context_text
                now_text         : $now_text
                weather_text     : $weather_context_text
                prompt_type      : "converse"
                history          : $conv|get:"history":[]
                conversation_text: $conv|get:"requests_text":""
                turn_note        : ($refers_to_request_index != null) ? ($refers_to_request_index|to_text) : ""
                event_rows       : $fu_event_rows
                max_candidates   : 15
                max_tokens       : 400
              }
            } as $fu_result

            var.update $pick_ms {
              value = ("now"|to_ms) - $fu_started_at
            }

            conditional {
              if ($fu_result|get:"used":false) {
                var.update $final_reply {
                  value = $fu_result.reply
                }

                var.update $pick_reasons {
                  value = $fu_result.pick_reasons
                }

                // Cards for the venues the reply is about, in the model's order.
                foreach (($fu_result|get:"picked_ids":[])|safe_array) {
                  each as $fu_vid {
                    db.get genie_venues {
                      field_name = "id"
                      field_value = $fu_vid
                    } as $fu_venue_row

                    conditional {
                      if ($fu_venue_row != null) {
                        function.run "genie/fn_genie_slim_venue_row_dev" {
                          input = {venue: $fu_venue_row}
                        } as $fu_card

                        var.update $turn_venues {
                          value = $turn_venues|append:$fu_card
                        }
                      }
                    }
                  }
                }

                var $fu_picked_events {
                  value = ($fu_result|get:"picked_event_ids":[])|safe_array
                }

                foreach ($fu_picked_events) {
                  each as $fu_peid {
                    foreach ($fu_event_rows) {
                      each as $fu_er {
                        conditional {
                          if ((($fu_er|get:"id":0)|to_int) == ($fu_peid|to_int)) {
                            var.update $turn_events {
                              value = $turn_events|append:$fu_er
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }

            var.update $llm_debug {
              value = (($fu_result|unpick:["reply", "pick_reasons", "venues"])|set:"enabled":true)|set:"prompt_type":"converse"
            }
          }

          catch {
            var.update $llm_debug {
              value = {
                enabled    : true
                prompt_type: "converse"
                used       : false
                fail_reason: "exception"
              }
            }
          }
        }

        conditional {
          if (($final_reply == null) || (($final_reply|trim) == "")) {
            var.update $final_reply {
              value = $followup_fallback_reply
            }
          }
        }

        // Old clients read venues/events: on a follow-up they are only the cards of this reply.
        var.update $venue_results {
          value = $turn_venues
        }

        var.update $final_use_xano {
          value = (($turn_venues|count) + ($turn_events|count)) > 0
        }
      }
    }

    // Keep the alternatives relevant and small: take the next ranked search cards,
    // excluding the picks already shown as primary venues.
    conditional {
      if (($picked_venue_ids|count) > 0) {
        var.update $selected_venue_ids {
          value = $picked_venue_ids
        }
      }

      else {
        foreach ($venue_results|slice:0:3) {
          each as $selected_venue {
            var.update $selected_venue_ids {
              value = $selected_venue_ids
                |append:(($selected_venue|get:"id":0)|to_int)
            }
          }
        }
      }
    }

    conditional {
      if (($ranked_search_cards|count) > 0) {
        var.update $more_nearby_source {
          value = $ranked_search_cards
        }
      }

      else {
        var.update $more_nearby_source {
          value = $final_more_nearby_venues
        }
      }
    }

    var.update $final_more_nearby_venues {
      value = []
    }

    foreach ($more_nearby_source) {
      each as $nearby_venue {
        var $nearby_id {
          value = (($nearby_venue|get:"id":0)|to_int)
        }

        conditional {
          if (($nearby_id > 0) && ($selected_venue_ids|in:$nearby_id) == false && $more_nearby_count < 5) {
            conditional {
              if (($ranked_search_cards|count) > 0) {
                var.update $final_more_nearby_venues {
                  value = $final_more_nearby_venues|append:$nearby_venue
                }
              }

              else {
                function.run "genie/fn_genie_slim_venue_row_dev" {
                  input = {venue: $nearby_venue}
                } as $nearby_card

                var.update $final_more_nearby_venues {
                  value = $final_more_nearby_venues|append:$nearby_card
                }
              }
            }

            var.update $more_nearby_count {
              value = $more_nearby_count + 1
            }
          }
        }
      }
    }

    debug.log {
      value = {
        checkpoint             : "V2_HANDLER_AFTER_ROUTING"
        turn_kind              : $turn_kind
        turn_source            : $turn|get:"source":null
        query_mode             : $query_mode
        final_reply            : $final_reply
        final_use_xano         : $final_use_xano
        final_reply_mode       : $final_reply_mode
        venue_count            : $venue_results|count
        more_nearby_venue_count: $final_more_nearby_venues|count
        event_count            : $event_results|count
        resolved_city          : $resolved_city_name
        city_source            : $loc_source
        geo_used               : $geo_used
      }
    }

    // 5. Post-process events for enrichment
    conditional {
      if (($event_results|count) > 0) {
        foreach ($event_results) {
          each as $evt {
            var $evt_venue {
              value = null
            }

            conditional {
              if ((($evt|get:"venue_id":0)|to_int) > 0) {
                db.get genie_venues {
                  field_name = "id"
                  field_value = $evt.venue_id
                } as $evt_venue_record

                var.update $evt_venue {
                  value = $evt_venue_record
                }
              }
            }

            var $enriched_evt {
              value = $evt|merge:{venue: $evt_venue}
            }

            var.update $enriched_events {
              value = $enriched_events|append:$enriched_evt
            }
          }
        }
      }
    }

    // 6. Apply weather override
    conditional {
      if ($should_avoid_outdoor && ($mode_result|get:"is_outdoor_sensitive":false) && (($final_reply == null) || (($final_reply|trim) == ""))) {
        function.run "genie/fn_genie_get_reply_v2_dev" {
          input = {
            intent        : "general"
            reply_mode    : "weather_raining"
            is_raining_now: true
          }
        } as $weather_reply

        var.update $final_reply {
          value = $weather_reply
        }
      }
    }

    // 7. Final fallback
    conditional {
      if (($final_reply == null) || (($final_reply|trim) == "")) {
        var.update $final_reply {
          value = "Let me find something great for you."
        }
      }
    }

    conditional {
      if ($event_fallback) {
        var.update $final_reply {
          value = (("I couldn't find any events in " ~ $resolved_city_name) ~ ". ") ~ $final_reply
        }
      }
    }

    // 7b. Conversation v1: the choices of a request turn. Always the top 3 (picks first after the
    // model reorders); on a model failure the top 3 search results, so a request with results
    // always returns 3 choices.
    conditional {
      if ($turn_kind == "request") {
        conditional {
          if ($query_mode == "event") {
            var.update $turn_events {
              value = $enriched_events|slice:0:3
            }
          }

          elseif ($query_mode == "ambient") {
            var.update $turn_venues {
              value = $venue_results|slice:0:3
            }

            var.update $turn_events {
              value = $enriched_events|slice:0:3
            }
          }

          else {
            var.update $turn_venues {
              value = $venue_results|slice:0:3
            }
          }
        }

        conditional {
          if (($stored_filters|count) == 0) {
            var.update $stored_filters {
              value = ($mf|get:"ok") ? (($mf|unpick:["ok", "fail_reason", "turn_kind", "refers_to_request", "inherit_filters", "wants_more", "inherited_from"])|set:"mode":$query_mode) : {mode: $query_mode}
            }
          }
        }
      }
    }

    // 8. Remember the resolved city on the session so follow-ups ("what about brunch?")
    // stay in the same city. Never touches the profile. A failure here never blocks the reply.
    var $persist_token {
      value = ($input.session_token ?? "")|trim
    }

    conditional {
      if ($loc_status == "ok" && $persist_token != "" && $resolved_city_name != "" && $loc_source != "session") {
        try_catch {
          try {
            db.query genie_session {
              where = $db.genie_session.session_token == $persist_token
              return = {type: "single"}
            } as $persist_sess

            conditional {
              if ($persist_sess != null && ((($persist_sess|get:"city_context":"") ?? "")|to_lower) != ($resolved_city_name|to_lower)) {
                db.edit genie_session {
                  field_name = "id"
                  field_value = $persist_sess.id
                  data = {city_context: $resolved_city_name}
                } as $persist_updated
              }
            }
          }

          catch {
            debug.log {
              value = {
                checkpoint: "V2_SESSION_CITY_PERSIST_FAILED"
                city      : $resolved_city_name
              }
            }
          }
        }
      }
    }

    // 9. GEN-072: the analytics the legacy handler wrote at the end of a turn (genie_query_log and
    // the behavior signal). Never blocks the reply. Only venue/event requests, as before.
    conditional {
      if ($lifecycle_ran) {
        try_catch {
          try {
            function.run "genie/fn_genie_log_turn_analytics_dev" {
              input = {
                user_id         : (($lifecycle|get:"user_id":0) ?? 0)|to_int
                external_user_id: ($input.external_user_id ?? "")|trim
                message         : $input.message
                city            : $resolved_city_name
                query_mode      : $query_mode
                temp_session_id : ($input.session_id ?? "")
                session_id      : ((($lifecycle|get:"session_id":"") ?? "")|to_text)
                session_meta    : $lifecycle|get:"session_meta":{}
                venue_count     : $venue_results|count
                detected_intent : $detected_intent
              }
            } as $analytics_resp
          }

          catch {
            debug.log {
              value = {checkpoint: "V2_ANALYTICS_FAILED"}
            }
          }
        }
      }
    }

    // The mode the client sees: a follow-up keeps the mode of the request it is about.
    var $response_query_mode {
      value = ($turn_kind == "followup") ? $followup_query_mode : $query_mode
    }

    // 10. Conversation v1: log Genie's reply with the turn state, so the next turn can follow up
    // on it. Never blocks the reply. Every object is built from plain variables first (no filter
    // chains or ternaries inside object literals), and a failure is returned in turn.log_error.
    var $log_error {
      value = null
    }

    var $payload_turn_source {
      value = ($turn|get:"source":"") ?? ""
    }

    var $payload_inherit {
      value = ($turn|get:"inherit_filters":false) ?? false
    }

    var $payload_wants_more {
      value = ($turn|get:"wants_more":false) ?? false
    }

    conditional {
      if ($conversation_enabled && $conv_session_id > 0) {
        try_catch {
          try {
            var $shown_venue_ids {
              value = []
            }

            var $shown_event_ids {
              value = []
            }

            var $stored_picks {
              value = []
            }

            var $reason_list {
              value = ($pick_reasons ?? [])|safe_array
            }

            foreach ($turn_venues) {
              each as $tv {
                var $tv_id {
                  value = ($tv|get:"id":0)|to_int
                }

                var $tv_name {
                  value = ($tv|get:"venue_name":"") ?? ""
                }

                conditional {
                  if ($tv_name == "") {
                    var.update $tv_name {
                      value = ($tv|get:"name":"") ?? ""
                    }
                  }
                }

                // The model's reason when it picked this venue, else empty.
                var $tv_reason {
                  value = ""
                }

                foreach ($reason_list) {
                  each as $pr {
                    var $pr_id {
                      value = ($pr|get:"venue_id":0)|to_int
                    }

                    conditional {
                      if ($pr_id == $tv_id) {
                        var.update $tv_reason {
                          value = ($pr|get:"reason":"") ?? ""
                        }
                      }
                    }
                  }
                }

                conditional {
                  if ($tv_id > 0) {
                    array.push $shown_venue_ids {
                      value = $tv_id
                    }

                    var $tv_pick {
                      value = {
                        kind      : "venue"
                        venue_id  : $tv_id
                        venue_name: $tv_name
                        reason    : $tv_reason
                      }
                    }

                    array.push $stored_picks {
                      value = $tv_pick
                    }
                  }
                }
              }
            }

            foreach ($turn_events) {
              each as $te {
                var $te_id {
                  value = ($te|get:"id":0)|to_int
                }

                var $te_name {
                  value = ($te|get:"title":"") ?? ""
                }

                conditional {
                  if ($te_id > 0) {
                    array.push $shown_event_ids {
                      value = $te_id
                    }

                    var $te_pick {
                      value = {
                        kind      : "event"
                        event_id  : $te_id
                        event_name: $te_name
                        reason    : ""
                      }
                    }

                    array.push $stored_picks {
                      value = $te_pick
                    }
                  }
                }
              }
            }

            var $payload_request_text {
              value = ""
            }

            var $payload_filters {
              value = {}
            }

            conditional {
              if ($turn_kind == "request") {
                var.update $payload_request_text {
                  value = $search_message
                }

                var.update $payload_filters {
                  value = $stored_filters ?? {}
                }
              }
            }

            var $payload_user_message_id {
              value = ($lifecycle|get:"user_message_id":null) ?? null
            }

            var $genie_payload {
              value = {
                v                      : 1
                kind                   : $turn_kind
                turn_index             : $turn_index
                turn_kind              : $turn_kind
                turn_source            : $payload_turn_source
                request_index          : $request_index
                refers_to_request_index: $refers_to_request_index
                request_text           : $payload_request_text
                query_mode             : $response_query_mode
                reply_mode             : $final_reply_mode
                city                   : $resolved_city_name
                filters                : $payload_filters
                shown_venue_ids        : $shown_venue_ids
                shown_event_ids        : $shown_event_ids
                picks                  : $stored_picks
                user_message_id        : $payload_user_message_id
              }
            }

            var $reply_text_for_log {
              value = ($final_reply ?? "")|to_text
            }

            function.run "genie/fn_genie_log_message_dev" {
              input = {
                session_id  : $conv_session_id
                sender_type : "genie"
                message_text: $reply_text_for_log
                raw_payload : $genie_payload
              }
            } as $genie_log

            var.update $genie_message_id {
              value = $genie_log|get:"message_id":null
            }
          }

          catch {
            var.update $log_error {
              value = {code: $error.code, message: $error.message}
            }

            debug.log {
              value = {
                checkpoint: "V2_GENIE_REPLY_LOG_FAILED"
                error     : $error.message
              }
            }
          }
        }
      }

      else {
        var.update $log_error {
          value = {message: "no session_id from lifecycle"}
        }
      }
    }

    // Response values computed up front: plain variables only in the response object.
    var $response_events {
      value = $enriched_events
    }

    conditional {
      if ($turn_kind == "followup") {
        var.update $response_events {
          value = $turn_events
        }
      }
    }

    var $dbg_latest_request_index {
      value = ($conv|get:"latest_request_index":0) ?? 0
    }

    var $dbg_history {
      value = ($conv|get:"history":[]) ?? []
    }

    var $dbg_history_count {
      value = $dbg_history|count
    }

    var $response_conversation_id {
      value = ($lifecycle|get:"session_token":null) ?? $input.session_token
    }

    var $dbg_conv_ok {
      value = ($conv|get:"ok":false) ?? false
    }

    var $dbg_conv_error {
      value = ($conv|get:"error":null) ?? null
    }

    var $turn_debug {
      value = {
        source              : $payload_turn_source
        inherit_filters     : $payload_inherit
        wants_more          : $payload_wants_more
        excluded_count      : $excluded_count
        latest_request_index: $dbg_latest_request_index
        history_count       : $dbg_history_count
        conversation_ok     : $dbg_conv_ok
        search_message      : $search_message
        session_id          : $conv_session_id
        conversation_error  : $dbg_conv_error
        log_error           : $log_error
      }
    }

    debug.log {
      value = {
        checkpoint             : "V2_HANDLER_FINAL_STATE"
        turn_kind              : $turn_kind
        turn_index             : $turn_index
        request_index          : $request_index
        refers_to_request_index: $refers_to_request_index
        final_reply            : $final_reply
        venue_count            : $venue_results|count
        turn_venue_count       : $turn_venues|count
        more_nearby_venue_count: $final_more_nearby_venues|count
        event_count            : $enriched_events|count
        query_mode             : $response_query_mode
        final_use_xano         : $final_use_xano
      }
    }
  }

  response = {
    success                : true
    reply                  : $final_reply
    use_xano               : $final_use_xano
    reply_mode             : $final_reply_mode
    venues                 : $venue_results
    more_nearby_venues     : $final_more_nearby_venues
    events                 : $response_events
    query_mode             : $response_query_mode
    needs_location         : $final_needs_location
    filters                : $final_filters
    show_intake_prompt     : $final_show_intake_prompt
    intake_prompt_copy     : $final_intake_prompt_copy
    profile_strength_tier  : $final_profile_strength_tier
    debug                  : $final_debug
    weather_context_text   : $weather_context_text
    should_avoid_outdoor   : $should_avoid_outdoor
    should_promote_outdoor : $should_promote_outdoor
    neighborhood_context   : $neighborhood_context
    is_outdoor_sensitive   : $mode_result|get:"is_outdoor_sensitive":false
    detected_neighborhood  : $mode_result|get:"detected_neighborhood":""
    pick_reasons           : $pick_reasons
    turn_kind              : $turn_kind
    turn_index             : $turn_index
    request_index          : $request_index
    refers_to_request_index: $refers_to_request_index
    turn_venues            : $turn_venues
    turn_events            : $turn_events
    conversation_id        : $response_conversation_id
    genie_message_id       : $genie_message_id
    turn                   : $turn_debug
    timings                : ```
      {
        v2_total_ms          : ("now"|to_ms) - $v2_started_at
        filter_extraction_ms : $filter_extraction_ms
        lifecycle_ms         : $lifecycle_ms
        inner                : $inner_timings
        search_ms            : $search_ms
        pick_ms              : $pick_ms
      }
      ```
    llm                    : $llm_debug
    context                : $context_debug
    search                 : $search_debug
    resolved_city          : {id: $city_id, name: $resolved_city_name}
    city_source            : $loc_source
    geo_used               : $geo_used
    location_status        : $loc_status
    supported_cities       : $supported_cities
    unsupported_city       : $unsupported_city_name
    search_filters         : $mf
    city                   : $city_debug
  }
}
