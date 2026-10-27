// Conversation v1: converts one genie_social_events row into a model-safe object, the event
// counterpart of fn_genie_format_venue_for_model_dev. Explicit field whitelist; empty fields are
// left out (empty means unknown, not no).
// Intentionally excluded: promotion and boost fields (promoted, boost_tier, featured_until),
// other users' activity (going/interested/rsvp/view/save counts, social energy), producer,
// payout and ticketing-account fields, moderation fields, and source/dedup ids.
function "genie/fn_genie_format_event_for_model_dev" {
  input {
    // One genie_social_events row
    json event
  
    // Optional venue name when the caller already loaded the venue
    text? venue_name?
  }

  stack {
    api.lambda {
      code = """
        const e = $input.event && typeof $input.event === "object" ? $input.event : {};
        const text = (v, n) => {
          if (typeof v !== "string") return "";
          const s = v.trim();
          return n && s.length > n ? s.slice(0, n - 1) + "…" : s;
        };
        const num = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);
        const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim() !== "").slice(0, 8) : []);
        
        const out = { event_id: Number(e.id) || 0, event_name: text(e.title, 120) };
        const put = (k, v) => {
          if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return;
          out[k] = v;
        };
        
        put("category", text(e.primary_category) || text(e.category));
        put("event_date", typeof e.event_date === "string" ? e.event_date : "");
        put("start_time", text(e.start_time));
        put("end_time", text(e.end_time));
        put("venue_name", text($input.venue_name) || text(e.venue_name));
        put("neighborhood", text(e.neighborhood));
        put("city", text(e.city));
        put("description", text(e.description, 400));
        put("dress_code", text(e.dress_code));
        put("age_requirement", text(e.age_requirement_text));
        put("performers", list(e.performers));
        put("hosted_by", text(e.hosted_by));
        put("special_notes", text(e.special_notes, 200));
        if (e.is_free === true) out.is_free = true;
        if (e.is_sold_out === true) out.is_sold_out = true;
        put("ticket_price_min", num(e.ticket_price_min) || num(e.tm_price_min));
        put("ticket_price_max", num(e.ticket_price_max) || num(e.tm_price_max));
        if (e.is_recurring === true) put("recurrence", text(e.recurrence_type) || "recurring");
        return out;
        """
      timeout = 5
    } as $formatted
  }

  response = $formatted
}