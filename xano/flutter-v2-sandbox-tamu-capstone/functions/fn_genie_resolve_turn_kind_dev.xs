// Conversation v1: decides whether a message is a new REQUEST or a FOLLOWUP. Code only, no
// model call, so the rule table can be unit-tested. The handler routes on the result:
// - request: fresh search, always 3 choices (pick prompt, min 3 picks)
// - followup: no search, free-form reply about items already shown (converse prompt, 0-3 picks)
// Rules, first match wins:
//   1. turn_hint from the client ("request" | "followup"). A followup hint with no earlier
//      request is treated as a request (there is nothing to follow up on).
//   2. No earlier request in the conversation: request.
//   3. The filter model answered: its turn_kind, except that wants_more always means request.
//   4. The filter model failed: keyword rules (more/another/different/instead/cheaper... ->
//      request; references to shown items -> followup; find/show me/recommend -> request;
//      anything else -> followup).
// refers_to_request_index is the model's value when it is a real request index, else the latest.
function "genie/fn_genie_resolve_turn_kind_dev" {
  input {
    // The user's message for this turn
    text message
  
    // Optional client hint: "request" | "followup" (anything else is ignored)
    text? turn_hint?
  
    // Output of fn_genie_extract_search_filters_dev (ok, turn_kind, refers_to_request,
    // inherit_filters, wants_more)
    json model_result?
  
    // Earlier requests from fn_genie_load_conversation_dev (only request_index is read)
    json requests?
  }

  stack {
    api.lambda {
      code = """
        const msg = (typeof $input.message === "string" ? $input.message : "").trim();
        const hint = (typeof $input.turn_hint === "string" ? $input.turn_hint : "").trim().toLowerCase();
        const mf = $input.model_result && typeof $input.model_result === "object" ? $input.model_result : {};
        const requests = Array.isArray($input.requests) ? $input.requests : [];
        const indexes = requests.map((r) => Number(r && r.request_index) || 0).filter((n) => n > 0);
        const latest = indexes.length ? Math.max(...indexes) : 0;
        
        const refFrom = (v) => {
          const n = Number(v);
          return Number.isInteger(n) && indexes.includes(n) ? n : (latest || null);
        };
        
        // Keyword rules (used when the model failed). English plus common Spanish.
        const MORE_RE = /\b(more|another|other|others|else|different|instead|similar|alternatives?|cheaper|closer|fancier|quieter|livelier|bigger|smaller|m[aá]s|otros?|otras?|diferentes?|parecidos?|en vez)\b/i;
        const MORE_ONLY_RE = /\b(more|another|other|others|else|different|alternatives?|m[aá]s|otros?|otras?)\b/i;
        const REF_RE = /\b(first|second|third|1st|2nd|3rd|last one|that one|this one|that place|those|them|it|they|primero|segundo|tercero|ese|esa|esos)\b/i;
        const ASK_RE = /\b(find|show me|recommend|suggest|search|looking for|look for|where can|any good|buscar|busca|recomienda|recomi[eé]ndame|quiero)\b/i;
        const NEW_TOPIC_RE = /\b(what about|how about|actually|now|y si|qu[eé] tal)\b/i;
        
        let kind = null;
        let source = null;
        let inherit = false;
        let wantsMore = false;
        let ref = null;
        
        if (hint === "request" || hint === "followup") {
          source = "hint";
          kind = hint === "followup" && latest === 0 ? "request" : hint;
          if (hint === "followup" && latest === 0) source = "hint_followup_no_requests";
          ref = refFrom(mf.refers_to_request);
          inherit = kind === "request" && mf.ok === true && mf.inherit_filters === true && latest > 0;
          wantsMore = kind === "request" && mf.ok === true && mf.wants_more === true && latest > 0;
        } else if (latest === 0) {
          kind = "request";
          source = "first_request";
        } else if (mf.ok === true && (mf.turn_kind === "request" || mf.turn_kind === "followup")) {
          source = "model";
          wantsMore = mf.wants_more === true;
          kind = wantsMore ? "request" : mf.turn_kind;
          inherit = kind === "request" && (mf.inherit_filters === true || wantsMore);
          ref = refFrom(mf.refers_to_request);
        } else {
          source = "keywords";
          if (MORE_RE.test(msg)) {
            kind = "request";
            wantsMore = MORE_ONLY_RE.test(msg);
            inherit = true;
          } else if (REF_RE.test(msg)) {
            kind = "followup";
          } else if (ASK_RE.test(msg) || NEW_TOPIC_RE.test(msg)) {
            kind = "request";
          } else {
            kind = "followup";
          }
          ref = latest || null;
        }
        
        if (kind === "request" && !inherit) wantsMore = false;
        if (kind === "request" && !inherit && !wantsMore) ref = null;
        
        return {
          turn_kind: kind,
          refers_to_request_index: ref,
          inherit_filters: kind === "request" ? inherit : false,
          wants_more: kind === "request" ? wantsMore : false,
          source: source,
          latest_request_index: latest
        };
        """
      timeout = 5
    } as $decision
  }

  response = $decision
}