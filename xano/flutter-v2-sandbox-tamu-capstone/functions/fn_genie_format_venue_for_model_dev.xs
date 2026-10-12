// One genie_venues row -> the object the model is allowed to see.
// Field whitelist: no paid placement (priority_*), no ownership/community flags, no
// vendor/monetization fields, no sb_* counts. Add fields here and every caller gets them.
// =====================================================================================
function "genie/fn_genie_format_venue_for_model_dev" {
  input {
    json venue
  }

  stack {
    var $v {
      value = $input.venue
    }
  
    var $out {
      value = {
        venue_id              : $v|get:"id":0
        venue_name            : $v|get:"venue_name":""
        neighborhood          : $v|get:"neighborhood_text":""
        venue_type            : $v|get:"venue_type":""
        address               : $v|get:"address":""
        vibe_notes            : $v|get:"vibe_notes":""
        summary               : $v|get:"google_editorial_summary":""
        review_summary        : $v|get:"review_summary":""
        energy_level          : $v|get:"energy_level":""
        crowd                 : $v|get:"crowd":""
        music                 : $v|get:"music":""
        noise_level           : $v|get:"noise_level":""
        price_band            : $v|get:"price_band":""
        rating                : $v|get:"google_rating":null
        rating_count          : $v|get:"google_user_ratings_total":null
        hours_text            : $v|get:"hours_text":""
        is_open_now           : $v|get:"is_open_now":null
        cuisine_tags          : $v|get:"cuisine_tags":[]
        dietary_tags          : $v|get:"dietary_tags":[]
        occasion_tags         : $v|get:"occasion_tags":[]
        has_rooftop           : $v|get:"has_rooftop":null
        has_outdoor_seating   : $v|get:"has_outdoor_seating":null
        has_live_music        : $v|get:"has_live_music":null
        has_dj                : $v|get:"has_dj":null
        has_dance_floor       : $v|get:"has_dance_floor":null
        has_karaoke           : $v|get:"has_karaoke":null
        has_sports_tv         : $v|get:"has_sports_tv":null
        brunch                : $v|get:"ms_brunch":null
        happy_hour            : $v|get:"ms_happy_hour":null
        happy_hour_details    : $v|get:"happy_hour_details":""
        late_night            : $v|get:"ms_late_night":null
        best_time_to_go       : $v|get:"best_time_to_go":""
        good_for_groups       : $v|get:"good_for_groups":null
        good_for_dates        : $v|get:"good_for_dates":null
        good_for_first_dates  : $v|get:"good_for_first_dates":null
        good_for_celebrations : $v|get:"good_for_celebrations":null
        reservations_supported: $v|get:"reservations_supported":null
        dress_code            : $v|get:"dress_code":""
        cover_charge          : $v|get:"cover_charge":null
        social_energy_state   : $v|get:"social_energy_state":""
      }
    }
  }

  response = $out
}