// Converts a venue row into a model-safe object using an explicit field whitelist.
// Computes open status when needed and omits fields that are empty or unavailable.
// GEN-071 (additive): data_gaps lists the missing vibe / hours / price / rating fields.
function "genie/fn_genie_format_venue_for_model_dev" {
  input {
    json venue
  
    // Optional {open_now, today_hours} already worked out by the caller (the search does
    // this in bulk). When missing, it is computed here from the venue's hours.
    json open_info?
  }

  stack {
    var $v {
      value = $input.venue
    }
  
    var $info {
      value = $input.open_info
    }
  
    var $f_id {
      value = $v|get:"id":0
    }
  
    var $f_name {
      value = $v|get:"venue_name":""
    }
  
    var $f_hours {
      value = $v|get:"hours_json":null
    }
  
    var $open_item {
      value = {id: $f_id, hours_json: $f_hours}
    }
  
    var $open_items {
      value = [$open_item]
    }
  
    conditional {
      if ((($info|get:"open_now":null) == null) && (($info|get:"today_hours":"") == "")) {
        function.run "genie/fn_genie_venue_open_now_dev" {
          input = {items: $open_items}
        } as $open_rows
      
        var.update $info {
          value = $open_rows|first
        }
      }
    }
  
    var $out {
      value = {venue_id: $f_id, venue_name: $f_name}|set_ifnotempty:"neighborhood":(($v|get:"area_neighborhood":"")|first_notempty:($v|get:"neighborhood_text":""))|set_ifnotempty:"address":($v|get:"address":"")|set_ifnotempty:"vibe_notes":($v|get:"vibe_notes":"")|set_ifnotempty:"summary":($v|get:"google_editorial_summary":"")|set_ifnotempty:"review_summary":($v|get:"review_summary":"")|set_ifnotempty:"energy_level":($v|get:"energy_level":"")|set_ifnotempty:"crowd":($v|get:"crowd":"")|set_ifnotempty:"music":($v|get:"music":"")|set_ifnotempty:"noise_level":($v|get:"noise_level":"")|set_ifnotempty:"price_band":($v|get:"price_band":"")|set_ifnotempty:"rating":($v|get:"google_rating":0)|set_ifnotempty:"rating_count":($v|get:"google_user_ratings_total":0)|set_ifnotempty:"hours_text":($v|get:"hours_text":"")|set_ifnotempty:"happy_hour_details":($v|get:"happy_hour_details":"")|set_ifnotempty:"best_time_to_go":($v|get:"best_time_to_go":"")|set_ifnotempty:"dress_code":($v|get:"dress_code":"")|set_ifnotempty:"cover_charge_details":($v|get:"cover_charge_details":"")|set_ifnotempty:"has_rooftop":($v|get:"has_rooftop":false)|set_ifnotempty:"has_outdoor_seating":($v|get:"has_outdoor_seating":false)|set_ifnotempty:"has_live_music":($v|get:"has_live_music":false)|set_ifnotempty:"has_dj":($v|get:"has_dj":false)|set_ifnotempty:"has_dance_floor":($v|get:"has_dance_floor":false)|set_ifnotempty:"has_karaoke":($v|get:"has_karaoke":false)|set_ifnotempty:"has_sports_tv":($v|get:"has_sports_tv":false)|set_ifnotempty:"good_for_groups":($v|get:"good_for_groups":false)|set_ifnotempty:"good_for_dates":($v|get:"good_for_dates":false)|set_ifnotempty:"good_for_first_dates":($v|get:"good_for_first_dates":false)|set_ifnotempty:"good_for_celebrations":($v|get:"good_for_celebrations":false)|set_ifnotempty:"good_for_birthdays":($v|get:"good_for_birthdays":false)|set_ifnotempty:"family_friendly":($v|get:"family_friendly":false)|set_ifnotnull:"open_now":($info|get:"open_now":null)|set_ifnotempty:"today_hours":($info|get:"today_hours":"")
    }
  
    // Patio is free text in the data: yes, no, Unknown, or empty. Only yes and no mean something.
    var $patio {
      value = (($v|get:"patio":"")|trim)|to_lower
    }
  
    conditional {
      if ($patio == "yes" || $patio == "no") {
        var.update $out {
          value = $out|set:"patio":$patio
        }
      }
    }
  
    var $t_cuisine {
      value = $v|get:"cuisine_tags":[]
    }
  
    var $t_diet {
      value = $v|get:"dietary_tags":[]
    }
  
    var $t_occasion {
      value = $v|get:"occasion_tags":[]
    }
  
    conditional {
      if (($t_cuisine|count) > 0) {
        var.update $out {
          value = $out|set:"cuisine_tags":$t_cuisine
        }
      }
    }
  
    conditional {
      if (($t_diet|count) > 0) {
        var.update $out {
          value = $out|set:"dietary_tags":$t_diet
        }
      }
    }
  
    conditional {
      if (($t_occasion|count) > 0) {
        var.update $out {
          value = $out|set:"occasion_tags":$t_occasion
        }
      }
    }

    // GEN-071: data_gaps names what this venue has no data for (vibe, hours, price, rating), so the
    // model can see that a field is missing instead of guessing. Left out when nothing is missing.
    var $gaps {
      value = []
    }

    var $g_vibe {
      value = (($v|get:"vibe_notes":"") ?? "")|trim
    }

    conditional {
      if ($g_vibe == "") {
        array.push $gaps {
          value = "vibe"
        }
      }
    }

    var $g_periods {
      value = ($f_hours ?? {})|get:"periods":null
    }

    var $g_has_hours {
      value = false
    }

    conditional {
      if ($g_periods|is_array) {
        var.update $g_has_hours {
          value = ($g_periods|count) > 0
        }
      }
    }

    conditional {
      if ($g_has_hours == false) {
        array.push $gaps {
          value = "hours"
        }
      }
    }

    var $g_band {
      value = (($v|get:"price_band":"") ?? "")|trim
    }

    var $g_level {
      value = (($v|get:"price_level":0) ?? 0)|to_int
    }

    conditional {
      if ($g_band == "" && $g_level <= 0) {
        array.push $gaps {
          value = "price"
        }
      }
    }

    var $g_rating {
      value = (($v|get:"google_rating":0) ?? 0)|to_decimal
    }

    conditional {
      if ($g_rating <= 0) {
        array.push $gaps {
          value = "rating"
        }
      }
    }

    conditional {
      if (($gaps|count) > 0) {
        var.update $out {
          value = $out|set:"data_gaps":$gaps
        }
      }
    }
  }

  response = $out
}