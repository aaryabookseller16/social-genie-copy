// Returns the caller's user context document and its rendered prompt text (GEN-010).
// Signed-in users are resolved from external_user_id; guests use device_id.
// Does not create a context; found = false when there is none yet.
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

    function.run "genie/fn_genie_get_user_context_dev" {
      input = {user_id: $user_id, device_id: $device_id_eff}
    } as $row

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
  }

  response = {
    found   : $row != null
    user_id : $user_id
    version : $version
    context : $context
    rendered: $rendered.text
  }
}
