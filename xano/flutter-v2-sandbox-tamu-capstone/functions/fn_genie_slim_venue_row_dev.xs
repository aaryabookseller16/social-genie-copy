//  Full genie_venues row -> the slim card shape the frontend expects.
//  Used for picks the model found through a tool (they are not in the handler's venue list),
//  so run_turn can add a card for them before order_venues runs. Unlike the model formatter,
//  this is for display, so it keeps social_energy_state and the image URLs and drops nothing
//  the card needs. Nothing paid, ownership or sb_* related goes out.
// 
//  Shape from the handoff: id, venue_name, area_neighborhood, vibe_notes, price_band,
//  address, image_primary_url, image_fallback_url, social_energy_score, social_energy_state.
//  latitude and longitude are included (open decision in the handoff); remove the latitude and longitude
//  variables and their two lines in the object to drop them.
//  =====================================================================================
function "genie/fn_genie_slim_venue_row_dev" {
  input {
    json venue
  }

  stack {
    var $v {
      value = $input.venue
    }
  
    // Each value is set in its own variable first. A multi-line object that holds filters
    // directly can be saved by Xano as a backtick expression and misparsed, so the object
    // below only holds plain variable references, separated by commas.
    var $f_id {
      value = $v|get:"id":0
    }
  
    var $f_name {
      value = $v|get:"venue_name":""
    }
  
    var $f_hood {
      value = (($v|get:"area_neighborhood":"")|first_notempty:($v|get:"neighborhood_text":""))|first_notempty:""
    }
  
    var $f_vibe {
      value = $v|get:"vibe_notes":""
    }
  
    var $f_price {
      value = $v|get:"price_band":""
    }
  
    var $f_address {
      value = $v|get:"address":""
    }
  
    var $f_img1 {
      value = $v|get:"image_primary_url":""
    }
  
    var $f_img2 {
      value = $v|get:"image_fallback_url":""
    }
  
    var $f_score {
      value = $v|get:"social_energy_score":0
    }
  
    var $f_state {
      value = $v|get:"social_energy_state":""
    }
  
    var $f_lat {
      value = $v|get:"latitude":0
    }
  
    var $f_lng {
      value = $v|get:"longitude":0
    }
  
    var $card {
      value = {
        id                 : $f_id
        venue_name         : $f_name
        area_neighborhood  : $f_hood
        vibe_notes         : $f_vibe
        price_band         : $f_price
        address            : $f_address
        image_primary_url  : $f_img1
        image_fallback_url : $f_img2
        social_energy_score: $f_score
        social_energy_state: $f_state
        latitude           : $f_lat
        longitude          : $f_lng
      }
    }
  }

  response = $card
}