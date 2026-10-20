// Full genie_venues row -> the slim card shape the frontend expects.
// Used for picks the model found through a tool (they are not in the handler's venue list),
// so run_turn can add a card for them before order_venues runs. Unlike the model formatter,
// this is for display, so it keeps social_energy_state and the image URLs and drops nothing
// the card needs. Nothing paid, ownership or sb_* related goes out.
//
// Shape from the handoff: id, venue_name, area_neighborhood, vibe_notes, price_band,
// address, image_primary_url, image_fallback_url, social_energy_score, social_energy_state.
// latitude and longitude are included (open decision in the handoff); remove the last two
// lines of the object to drop them.
// =====================================================================================
function "genie/fn_genie_slim_venue_row_dev" {
  input {
    json venue
  }

  stack {
    var $v {
      value = $input.venue
    }
  
    var $card {
      value = {
        id                 : $v|get:"id":0
        venue_name         : $v|get:"venue_name":""
        area_neighborhood  : ($v|get:"area_neighborhood":"")|first_notempty:($v|get:"neighborhood_text":"")
        vibe_notes         : $v|get:"vibe_notes":""
        price_band         : $v|get:"price_band":""
        address            : $v|get:"address":""
        image_primary_url  : $v|get:"image_primary_url":""
        image_fallback_url : $v|get:"image_fallback_url":""
        social_energy_score: $v|get:"social_energy_score":0
        social_energy_state: $v|get:"social_energy_state":""
        latitude           : $v|get:"latitude":0
        longitude          : $v|get:"longitude":0
      }
    }
  }

  response = $card
}
