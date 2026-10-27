// Turns one chat message, in any language, into a query mode and search filters (GEN-071).
// Model: gpt-4o-mini, JSON mode, temperature 0.1. It runs before the venue search, so it is
// kept small (about 1 s).
// The model decides by meaning, not by keywords: "a bar tonight" is a venue request, "conciertos
// este fin de semana" is an event request, a neighborhood name is a venue filter (no city-specific
// list). Keywords come back in English, as words that appear in venue descriptions, so Spanish
// and English requests search the same way.
// Conversation v1: with history_text / requests_text the same call also classifies the turn:
// turn_kind (request | followup), refers_to_request, inherit_filters, wants_more. The final
// decision is fn_genie_resolve_turn_kind_dev's. Without history the filters are the same as before
// and turn_kind is "request".
// Code only checks the shape: allowed values for mode, venue_type, meal_service, price_band and
// energy; text fields at most 40 characters; at most 5 keywords. Anything else is dropped.
// Any failure returns ok: false, and the caller keeps its keyword rules.
function "genie/fn_genie_extract_search_filters_dev" {
  input {
    // The user's chat message
    text message
  
    // City the app sent, if any (e.g. "Houston")
    text? city_context?
  
    // Conversation v1: recent messages as text, from fn_genie_load_conversation_dev
    text? history_text?
  
    // Conversation v1: one line per earlier request with its numbered picks
    text? requests_text?
  }

  stack {
    var $message {
      value = ($input.message ?? "")|trim
    }
  
    var $city_context {
      value = ($input.city_context ?? "")|trim
    }
  
    var $history_text {
      value = ($input.history_text ?? "")|trim
    }
  
    var $requests_text {
      value = ($input.requests_text ?? "")|trim
    }
  
    var $has_conversation {
      value = $history_text != "" || $requests_text != ""
    }
  
    var $raw {
      value = null
    }
  
    var $fail_reason {
      value = null
    }
  
    var $system {
      value = ""
    }
  
    text.append $system {
      value = """
        You read one message a user sent to Genie, a nightlife and dining concierge, and turn it into search filters. The message can be in any language. Judge by meaning, not by single words.
        
        mode:
        - "venue": the user wants places to go (bars, restaurants, clubs, cafes, lounges), even if they mention a time ("a bar tonight", "brunch this weekend") or a neighborhood ("cocktails in Montrose").
        - "event": the user wants events, shows, concerts, festivals, games or things happening ("what's happening this weekend", "conciertos esta noche", "any comedy shows Friday").
        - "ambient": open-ended with no type of place, vibe or event at all ("surprise me", "I'm bored, what should I do", "no plans tonight"). A vibe or plan to go out ("let's go party", "somewhere quiet to talk") is a venue request.
        
        Fix obvious typos and use the usual spelling of place names (e.g. "dwntwn" -> "Downtown", "sushie" -> "sushi").
        
        Filters (leave a filter empty when the message does not ask for it; never guess):
        - city: a city named in the message, in English (e.g. "Houston"). Empty if none.
        - neighborhood: a neighborhood or area named in the message, as written in English (e.g. "Montrose", "Midtown", "EaDo"). Empty if none.
        - venue_type: one of bar, restaurant, club, cafe, only when the message names that kind of place ("a bar", "un restaurante", "a club"). Empty for "spot", "place", "somewhere" or a food alone ("burger spot", "sushi").
        - cuisine: one food style in English, lower case (e.g. "sushi", "seafood", "soul food", "steakhouse", "tex-mex"). Brunch is a meal_service and drinks (cocktails, wine, beer) are keywords, not cuisines. A place named after a food ("pizzería", "taquería", "marisquería", "noodle house") means that cuisine (pizza, tacos, seafood, noodles). Empty if none.
        - meal_service: one of brunch, happy_hour, late_night. Empty if none.
        - open_now: true only if the user asks for somewhere open right now.
        - price_band: one of $, $$, $$$, $$$$ when the user asks for a price level in any language ("cheap" = $; "fancy", "upscale", "elegant", "high-end" = $$$$). Empty if none.
        - energy: one of Chill, Medium, High when the user asks for a level of energy in any language ("chill", "lowkey", "relaxed", "calm" = Chill; "lit", "turnt", "loud", "wild" = High). Empty if none.
        - keywords: up to 5 short English words or phrases that describe the place the user wants and that a venue description would contain: vibe, setting, crowd, music, features (e.g. "rooftop", "patio", "romantic", "live music", "sports", "hookah", "speakeasy", "dancing", "jazz"). Always write keywords in English, even when the message is in another language: translate the meaning, never copy a non-English word. Do not repeat venue_type, cuisine or neighborhood here. No dates or times.
        - language: the ISO 639-1 code of the message's main language (e.g. "en", "es").
        
        Examples:
        - "find me a rooftop bar in Midtown" -> {"mode":"venue","neighborhood":"Midtown","venue_type":"bar","keywords":["rooftop"],"language":"en"}
        - "un bar con terraza en Midtown" -> {"mode":"venue","neighborhood":"Midtown","venue_type":"bar","keywords":["patio"],"language":"es"}
        - "a chill spot for drinks tonight" -> {"mode":"venue","venue_type":"bar","energy":"Chill","language":"en"}
        - "eventos este fin de semana" -> {"mode":"event","language":"es"}
        - "cheap tacos open right now" -> {"mode":"venue","cuisine":"tacos","open_now":true,"price_band":"$","language":"en"}
        """
    }
  
    // Conversation v1: turn classification, only when there is a conversation to follow up on.
    conditional {
      if ($has_conversation) {
        text.append $system {
          value = """
            
            This message is part of a conversation. Earlier messages and earlier requests (with the numbered choices Genie showed) are given for context. Also classify the message:
            - turn_kind "request": the user wants NEW or DIFFERENT places or events: a new topic ("actually, live music Saturday"), more or other options ("show me more", "any others?"), or a change to an earlier search ("anything cheaper?", "what about brunch instead?", "closer to Montrose?").
            - turn_kind "followup": the user is asking about or reacting to places or events already shown ("does the second one take reservations?", "which is better for a group?", "how far is it?", "thanks!", "sounds good"). No new search is needed.
            - refers_to_request: the number of the earlier request the message is about (e.g. 2), or null if it is about none of them. A message that does not say otherwise is about the latest request.
            - inherit_filters: true when a request changes or extends an earlier request instead of starting fresh ("cheaper?", "more like that", "same but in Midtown"). False for a new topic.
            - wants_more: true when the user asks for more, other or different options than the ones already shown.
            Filters always describe only what THIS message asks for; do not copy filters from earlier requests (the app combines them when inherit_filters is true).
            
            Conversation examples:
            - after rooftop bars were shown: "anything cheaper?" -> {"turn_kind":"request","refers_to_request":1,"inherit_filters":true,"wants_more":false,"mode":"venue","price_band":"$","language":"en"}
            - after rooftop bars were shown: "does the second one have a patio?" -> {"turn_kind":"followup","refers_to_request":1,"inherit_filters":false,"wants_more":false,"mode":"venue","language":"en"}
            - "show me more" -> {"turn_kind":"request","refers_to_request":<latest>,"inherit_filters":true,"wants_more":true,"mode":"venue","language":"en"}
            - "actually, any comedy shows Friday?" -> {"turn_kind":"request","refers_to_request":null,"inherit_filters":false,"wants_more":false,"mode":"event","language":"en"}
            """
        }
      }
    }
  
    conditional {
      if ($has_conversation) {
        text.append $system {
          value = """
            
            Return only JSON with these keys: turn_kind, refers_to_request, inherit_filters, wants_more, mode, city, neighborhood, venue_type, cuisine, meal_service, open_now, price_band, energy, keywords, language.
            """
        }
      }
    
      else {
        text.append $system {
          value = """
            
            Return only JSON with these keys: mode, city, neighborhood, venue_type, cuisine, meal_service, open_now, price_band, energy, keywords, language.
            """
        }
      }
    }
  
    var $user_text {
      value = ""
    }
  
    conditional {
      if ($requests_text != "") {
        text.append $user_text {
          value = "Earlier requests in this conversation:\n" ~ $requests_text ~ "\n\n"
        }
      }
    }
  
    conditional {
      if ($history_text != "") {
        text.append $user_text {
          value = "Recent messages:\n" ~ $history_text ~ "\n\n"
        }
      }
    }
  
    text.append $user_text {
      value = "Message: " ~ $message
    }
  
    conditional {
      if ($city_context != "") {
        text.append $user_text {
          value = "\nCity the app is in: " ~ $city_context ~ " (use it only if the message names no city)"
        }
      }
    }
  
    conditional {
      if ($message == "") {
        var.update $fail_reason {
          value = "empty_message"
        }
      }
    
      else {
        try_catch {
          try {
            var $sys_msg {
              value = {role: "system", content: $system}
            }
          
            var $usr_msg {
              value = {role: "user", content: $user_text}
            }
          
            var $messages {
              value = [$sys_msg, $usr_msg]
            }
          
            var $payload {
              value = {messages: $messages}
            }
          
            function.run "genie/fn_genie_call_ai_dev" {
              input = {
                ai_payload : $payload
                model      : "gpt-4o-mini"
                max_tokens : 300
                temperature: 0.1
                timeout    : 8
                json_mode  : true
              }
            } as $ai
          
            var.update $raw {
              value = ($ai|get:"assistant_reply") ?? null
            }
          
            conditional {
              if ($raw == null) {
                var.update $fail_reason {
                  value = "no_model_reply"
                }
              }
            }
          }
        
          catch {
            var.update $fail_reason {
              value = "model_call_failed"
            }
          }
        }
      }
    }
  
    var $filters {
      value = {ok: false}
    }
  
    // Shape checks only. The judgement is the model's.
    conditional {
      if ($raw != null) {
        api.lambda {
          code = """
            let p = null;
            try { p = JSON.parse($var.raw); } catch (e) { return {ok: false, fail_reason: "bad_json"}; }
            if (!p || typeof p !== "object") return {ok: false, fail_reason: "bad_json"};
            const text = (v) => (typeof v === "string" ? v.trim() : "");
            const short = (v) => { const t = text(v); return t.length <= 40 ? t : ""; };
            // "the Heights" -> "Heights", so it matches "Houston Heights" in the venue data.
            const place = (v) => short(v).replace(/^the\s+/i, "");
            const oneOf = (v, list) => { const t = text(v); const hit = list.find((x) => x.toLowerCase() === t.toLowerCase()); return hit || ""; };
            const mode = oneOf(p.mode, ["venue", "event", "ambient"]);
            if (!mode) return {ok: false, fail_reason: "bad_mode"};
            // "brunch" is a meal service, not a cuisine, whichever field the model put it in.
            if (short(p.cuisine).toLowerCase() === "brunch") { p.cuisine = ""; if (!text(p.meal_service)) p.meal_service = "brunch"; }
            // Drinks are keywords, not cuisines, so "cocteles" and "cocktails" search the same way.
            if (/^(cocktails?|drinks?|wine|beer|craft beer|whiskey|bourbon|mimosas?|margaritas?|tequila|mezcal)$/i.test(short(p.cuisine))) {
              p.keywords = (Array.isArray(p.keywords) ? p.keywords : []).concat([short(p.cuisine)]);
              p.cuisine = "";
            }
            const keywords = (Array.isArray(p.keywords) ? p.keywords : [])
              .map((k) => short(k).toLowerCase())
              .filter((k, i, a) => k !== "" && a.indexOf(k) === i)
              .slice(0, 5);
            // Conversation v1: turn fields. Without a conversation every message is a request.
            const hasConversation = $var.has_conversation === true;
            const turnKind = hasConversation ? oneOf(p.turn_kind, ["request", "followup"]) : "request";
            const ref = Number(p.refers_to_request);
            return {
              ok: true,
              mode: mode,
              city: short(p.city),
              neighborhood: place(p.neighborhood),
              venue_type: oneOf(p.venue_type, ["bar", "restaurant", "club", "cafe"]),
              cuisine: short(p.cuisine).toLowerCase(),
              meal_service: oneOf(p.meal_service, ["brunch", "happy_hour", "late_night"]),
              open_now: p.open_now === true,
              price_band: oneOf(p.price_band, ["$", "$$", "$$$", "$$$$"]),
              energy: oneOf(p.energy, ["Chill", "Medium", "High"]),
              keywords: keywords,
              language: /^[a-z]{2}$/.test(text(p.language).toLowerCase()) ? text(p.language).toLowerCase() : "",
              turn_kind: turnKind,
              refers_to_request: hasConversation && Number.isInteger(ref) && ref > 0 ? ref : null,
              inherit_filters: hasConversation && p.inherit_filters === true,
              wants_more: hasConversation && p.wants_more === true
            };
            """
          timeout = 5
        } as $checked
      
        var.update $filters {
          value = $checked
        }
      }
    }
  
    conditional {
      if ($fail_reason != null) {
        var.update $filters {
          value = {ok: false, fail_reason: $fail_reason}
        }
      }
    }
  }

  response = $filters
}