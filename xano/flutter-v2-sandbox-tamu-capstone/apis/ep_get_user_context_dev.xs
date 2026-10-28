// Returns the caller's user context document and its rendered prompt text (GEN-010).
// Signed-in users are resolved from external_user_id; guests use device_id.
// Does not create a context; found = false when there is none yet.
// Each preference also gets first_seen_at / last_reinforced_at (and onboarding.at_text): the
// stored milliseconds as readable Central time. Response only; storage is unchanged.
query "genie/ep_get_user_context_dev" verb=GET {
  api_group = "Genie_Dev"

  input {
    text? external_user_id? filters=trim
    text? device_id? filters=trim
  }

  stack {
    var $external_user_id_eff {
      value = ($input.external_user_id ?? "")|trim
    }

    var $device_id_eff {
      value = ($input.device_id ?? "")|trim
    }

    precondition ($external_user_id_eff != "" || $device_id_eff != "") {
      error_type = "inputerror"
      error = "external_user_id or device_id is required"
    }

    var $user_id {
      value = 0
    }

    conditional {
      if ($external_user_id_eff != "") {
        db.query genie_user {
          where = $db.genie_user.external_user_id == $external_user_id_eff
          return = {type: "single"}
        } as $user_row

        conditional {
          if ($user_row != null) {
            var.update $user_id {
              value = $user_row.id
            }
          }
        }
      }
    }

    // Read-only: link = false, so this never claims, merges or creates (GEN-013).
    function.run "genie/fn_genie_resolve_user_context_dev" {
      input = {user_id: $user_id, device_id: $device_id_eff, external_user_id: $external_user_id_eff, link: false}
    } as $resolved

    var $row {
      value = $resolved.row
    }

    var $context {
      value = null
    }

    var $version {
      value = 0
    }

    conditional {
      if ($row != null) {
        var.update $context {
          value = $row.context_json
        }

        var.update $version {
          value = $row.version
        }
      }
    }

    function.run "genie/fn_genie_render_user_context_dev" {
      input = {context: $context}
    } as $rendered

    // Readable dates next to the stored milliseconds, in Central time, e.g. first_seen_at:
    // "2026-10-12 11:00 CT". Only in this response; storage keeps milliseconds.
    api.lambda {
      code = """
        const ctx = $var.context;
        if (!ctx || typeof ctx !== "object") return ctx;
        const fmt = (ms) => {
          if (typeof ms !== "number" || !(ms > 0)) return null;
          const p = {};
          new Intl.DateTimeFormat("en-US", {timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"})
            .formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
          return p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute + " CT";
        };
        const out = JSON.parse(JSON.stringify(ctx));
        for (const pref of (Array.isArray(out.preferences) ? out.preferences : [])) {
          if (!pref || typeof pref !== "object") continue;
          pref.first_seen_at = fmt(pref.first_seen);
          pref.last_reinforced_at = fmt(pref.last_reinforced);
        }
        if (out.onboarding && typeof out.onboarding === "object" && out.onboarding.at) out.onboarding.at_text = fmt(out.onboarding.at);
        return out;
        """
      timeout = 5
    } as $readable
  }

  response = {
    found   : $row != null
    user_id : $user_id
    version : $version
    context : $readable
    rendered: $rendered.text
  }
}
