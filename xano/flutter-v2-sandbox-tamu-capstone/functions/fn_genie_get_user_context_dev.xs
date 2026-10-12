// Fetches the active user context row (GEN-010). Looks up by user_id first,
// then by device_id for guests (genie_user_id = 0). Returns null if none.
function "genie/fn_genie_get_user_context_dev" {
  input {
    int? user_id?=0
    text? device_id? filters=trim
  }

  stack {
    var $row {
      value = null
    }

    var $device_id_eff {
      value = ($input.device_id ?? "")|trim
    }

    conditional {
      if ($input.user_id != null && $input.user_id > 0) {
        db.query genie_user_context {
          where = $db.genie_user_context.genie_user_id == $input.user_id && $db.genie_user_context.status == "active"
          return = {type: "single"}
        } as $by_user

        var.update $row {
          value = $by_user
        }
      }

      elseif ($device_id_eff != "") {
        db.query genie_user_context {
          where = $db.genie_user_context.device_id == $device_id_eff && $db.genie_user_context.genie_user_id == 0 && $db.genie_user_context.status == "active"
          return = {type: "single"}
        } as $by_device

        var.update $row {
          value = $by_device
        }
      }
    }
  }

  response = $row
}
