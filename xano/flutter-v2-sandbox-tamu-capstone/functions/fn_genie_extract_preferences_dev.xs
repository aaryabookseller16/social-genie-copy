// Picks up the user's likes and dislikes from one chat message (GEN-014). Model: gpt-4o at
// temperature 0.2 (runs after the reply, so it does not slow chat down).
// The model does all the judging: whether the user is reacting positively or negatively,
// whether it is a lasting taste or a one-off request, whether it is about the user or someone
// else, and how strongly they mean it (confidence). It sees Genie's previous reply, so
// reactions such as "love that first one" or "those look too pricey" count, and the user's
// current preferences, so it can flip a like to a dislike.
// The model first decides whether the message is about the user's tastes at all
// (about_user_tastes); if it says no, nothing is saved.
// Code only applies safety limits, never sentiment rules: the evidence quote must appear in the
// message or the previous reply, category on the allow-list, value at most 40 characters, no
// sensitive categories (music, community: no consent flow yet), at most 5 updates.
// Confidence decides how an update is stored: >= $stated_min -> stated, >= $inferred_min ->
// inferred at that confidence, lower -> not saved. Returns ops for
// fn_genie_apply_context_ops_dev. Any failure returns no ops.
// 2026-10-28 (additive): optional `model` (default gpt-4o). The batch learning job
// (fn_genie_learn_from_session_dev) passes several user messages as one message, one per line.
function "genie/fn_genie_extract_preferences_dev" {
  input {
    // The user's chat message
    text message

    // Genie's previous reply, with the names and tags of the venues it showed (optional)
    text? previous_reply?

    // The user's current preferences as rendered text (optional)
    text? current?

    // Model override (optional, default gpt-4o)
    text? model?
  }

  stack {
    // Confidence cut-offs. Change them here.
    var $stated_min {
      value = 0.8
    }

    // 0.5 is how the model grades a guess ("first date" -> dinner), so the floor sits above it.
    var $inferred_min {
      value = 0.6
    }

    var $max_updates {
      value = 5
    }

    var $model {
      value = ($input.model ?? "")|trim
    }

    conditional {
      if ($model == "") {
        var.update $model {
          value = "gpt-4o"
        }
      }
    }

    var $ops {
      value = []
    }

    var $dropped {
      value = []
    }

    var $fail_reason {
      value = null
    }

    var $raw {
      value = null
    }

    var $message {
      value = ($input.message ?? "")|trim
    }

    var $previous {
      value = ($input.previous_reply ?? "")|trim
    }

    var $current {
      value = ($input.current ?? "")|trim
    }

    var $system {
      value = ""
    }

    text.append $system {
      value = """
        You read one message a user sent to Genie, a nightlife and dining concierge in Houston, and decide what it tells Genie about the user's own lasting tastes.

        First decide about_user_tastes: does this message say how the user feels about something in general (what they like, love, avoid, can't stand, usually do), as opposed to only asking for something right now? Asking for something ("is there a sports bar near me", "something with outdoor seating?", "where should I take my date saturday") is not, by itself, a statement about their tastes. If about_user_tastes is false, return no updates.

        Then judge each taste yourself, the way a perceptive friend would:
        - Is the user reacting positively or negatively to something (a kind of place, food, vibe, time, price, activity, or one of the venues Genie just showed)?
        - Is it a lasting taste ("I love speakeasies", "not into clubs anymore", "too loud for me") or only about this one request ("tonight I want tacos", "somewhere near Midtown")? Only lasting tastes count. A request is not a taste.
        - Is it about the user, or about someone else ("my friend loves karaoke")? Only the user counts.
        - How sure are you that this is a lasting taste of the user? That is the confidence, from 0 to 1. A plain statement ("I hate happy hours") is high. A passing reaction ("eh, a bit loud") is medium. A guess is low.
        If the message says nothing about the user's tastes, return no updates. Saving nothing is better than guessing.

        Examples of judgement (not rules; use your own sense):
        - "i dont like lunch or happy hours but im into dinner and rooftop" -> four updates: Lunch dislike, Happy Hour dislike, Dinner like, Rooftop like. One update per thing.
        - "rooftop bars in Midtown" -> a request for this search, not a taste: nothing.
        - "what about something cheaper?" / "anything closer?" -> refining this search: nothing.
        - "eh, maybe" / "ok" / "thanks!" / "hey how's it going" -> nothing.
        - "honestly I can't stand loud places" -> Loud & Lit dislike, high confidence.
        - "nah those look too pricey" after Genie showed $$$$ places -> $$$$ dislike, medium confidence.

        For reactions to the previous reply, turn "the first one" / "those" into what the user is reacting to, using the venue details given (its cuisine, vibe, price, type), not the venue name.

        Categories (use exactly these): experience, atmosphere, food, occasion, neighborhood, price, group_size, typical_time, event, sports_team.
        Prefer these existing values when they fit; otherwise use a short, plain value in English (at most 40 characters), whatever language the user wrote in:
        - experience: Happy Hour, Brunch, Dinner, Lunch, Day Party, Late Night, Live Band, Lounges, Karaoke, Trivia Night, Game Night, Theme Nights, Hookah Nights, Comedy Shows, Bowling / Arcade, Rooftop Bars
        - atmosphere: Rooftop, Patio, Speakeasy Vibe, Chill & Intimate, Indoor Cozy, Live DJ, Club Vibe, Dancing Allowed, Lounge, Loud & Lit, Dive Bar Vibes, Upscale, Outdoor / Open Air, Smoke-Free
        - food: Seafood, Barbecue, Soul Food, Cajun, Vegan, Tex-Mex, Mexican, Italian, Thai, Vietnamese, Mediterranean, Ethiopian, Sushi, Tapas / Small Plates, Comfort Food, Street Food, Signature Cocktails, Bottomless Mimosas, Whiskey / Bourbon Bars, Wine Focused
        - price: $, $$, $$$, $$$$
        Do not use music or community (identity) categories. Never infer age, gender, ethnicity, religion, or health.

        "evidence" is a short fragment copied word for word from the message (or from the previous reply, for "the first one") that shows the taste; it can be just the key words, such as "into dinner" or "rooftop". Never paraphrase.

        Return only JSON: {"about_user_tastes": boolean, "updates": [{"category": string, "value": string, "sentiment": "like" | "dislike", "confidence": number, "evidence": string}]}
        """
    }

    var $user_text {
      value = "Message: " ~ $message
    }

    conditional {
      if ($previous != "") {
        text.append $user_text {
          value = "\nGenie's previous reply: " ~ $previous
        }
      }
    }

    conditional {
      if ($current != "") {
        text.append $user_text {
          value = "\nWhat Genie already knows: " ~ $current
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
                ai_payload: $payload
                model      : $model
                max_tokens : 400
                temperature: 0.2
                timeout    : 20
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

    // Safety limits only. The sentiment and strength are the model's.
    conditional {
      if ($raw != null) {
        api.lambda {
          code = """
            const allowed = ["experience", "atmosphere", "food", "occasion", "neighborhood", "price", "group_size", "typical_time", "event", "sports_team"];
            const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
            // Evidence is checked by words, so a fragment like "into rooftop" still matches
            // "im into dinner and rooftop", but invented words never do.
            const words = (s) => norm(s).replace(/[^a-z0-9$&'\s]/g, " ").split(" ").filter((w) => w.length > 1);
            const haystack = new Set(words($var.message).concat(words($var.previous)));
            let parsed = null;
            try { parsed = JSON.parse($var.raw); } catch (e) { return {ops: [], dropped: [], fail_reason: "bad_json"}; }
            // The model's own verdict: a message that only asks for something saves nothing.
            if (parsed && parsed.about_user_tastes === false) return {ops: [], dropped: [], fail_reason: null, about_user_tastes: false};
            const updates = parsed && Array.isArray(parsed.updates) ? parsed.updates : [];
            const ops = [];
            const dropped = [];
            for (const u of updates) {
              const category = norm(u && u.category);
              const value = String((u && u.value) || "").trim();
              const sentiment = norm(u && u.sentiment) === "dislike" ? "dislike" : "like";
              const confidence = Math.max(0, Math.min(1, Number(u && u.confidence) || 0));
              const evidence = norm(u && u.evidence);
              let reason = "";
              if (!allowed.includes(category)) reason = "category";
              else if (value === "" || value.length > 40) reason = "value";
              else if (evidence === "" || words(evidence).length === 0 || !words(evidence).every((w) => haystack.has(w))) reason = "evidence_not_found";
              else if (confidence < $var.inferred_min) reason = "low_confidence";
              else if (ops.length >= $var.max_updates) reason = "too_many";
              if (reason) { dropped.push({category, value, sentiment, confidence, reason}); continue; }
              const stated = confidence >= $var.stated_min;
              ops.push({op: "add", category, value, sentiment, source: stated ? "stated" : "inferred", confidence, evidence});
            }
            return {ops, dropped, fail_reason: null, about_user_tastes: true};
            """
          timeout = 5
        } as $checked

        var.update $ops {
          value = ($checked|get:"ops") ?? []
        }

        var.update $dropped {
          value = ($checked|get:"dropped") ?? []
        }

        var.update $fail_reason {
          value = ($checked|get:"fail_reason") ?? null
        }
      }
    }
  }

  response = {
    ops        : $ops
    dropped    : $dropped
    fail_reason: $fail_reason
  }
}
