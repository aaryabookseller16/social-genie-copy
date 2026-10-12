// Creates the user context row if it does not exist yet (GEN-010). Idempotent:
// returns the existing active row when there is one. Guests are keyed by
// device_id with genie_user_id = 0.
function "genie/fn_genie_create_user_context_dev" {
  input {
    int? user_id?=0
    text? device_id? filters=trim
  }

  stack {
    var $user_id_eff {
      value = ($input.user_id ?? 0)|to_int
    }

    var $device_id_eff {
      value = ($input.device_id ?? "")|trim
    }

    precondition ($user_id_eff > 0 || $device_id_eff != "") {
      error_type = "inputerror"
      error = "user_id or device_id is required"
    }

    function.run "genie/fn_genie_get_user_context_dev" {
      input = {user_id: $user_id_eff, device_id: $device_id_eff}
    } as $existing

    var $row {
      value = $existing
    }

    conditional {
      if ($existing == null) {
        db.add genie_user_context {
          data = {
            genie_user_id: $user_id_eff
            device_id    : ($device_id_eff == "") ? null : $device_id_eff
            context_json : {schema: 1, preferences: [], profile: {}, onboarding: {}}
            version      : 1
            status       : "active"
            updated_at   : now
          }
        } as $new_row

        var.update $row {
          value = $new_row
        }
      }
    }
  }

  response = $row
}
