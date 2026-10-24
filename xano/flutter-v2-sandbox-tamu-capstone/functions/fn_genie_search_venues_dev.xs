// Searches active venues in a city, excludes unsuitable records, applies optional filters, and ranks matches.
// Relaxes filters when needed and returns model-safe venue data, app cards, and search diagnostics.
function "genie/fn_genie_search_venues_dev" {
  input {
    // City to search (genie_venues.city_id)
    int city_id
  
    // bar, restaurant, club or cafe
    text venue_type?
  
    // e.g. steakhouse, sushi, soul food
    text cuisine?
  
    // Matched against neighborhood and address
    text neighborhood?
  
    // $, $$, $$$ or $$$$
    text price_band?
  
    // brunch, happy_hour, late_night or reverse_happy_hour
    text meal_service?
  
    // Only venues open right now (Central time)
    bool open_now?
  
    // Soft terms matched against vibe, crowd, music, name and cuisine, e.g. romantic, rooftop
    text[] keywords?
  
    // Preferred energy level, e.g. Chill, Medium, High
    text energy?
  
    // relevance (default) or rating
    text sort_by?
  
    // Venues to return, 1 to 10 (default 10)
    int limit?
  
    // Below this many matches the filters are relaxed (default 3)
    int min_results?
  }

  stack {
    // ---------- Inputs, cleaned ----------
    var $venue_type {
      value = (($input.venue_type|first_notempty:"")|trim)|to_lower
    }
  
    var $cuisine {
      value = (($input.cuisine|first_notempty:"")|trim)|to_lower
    }
  
    var $cuisine_tag {
      value = ($cuisine|replace:" ":"_")|replace:"-":"_"
    }
  
    var $neighborhood {
      value = (($input.neighborhood|first_notempty:"")|trim)|to_lower
    }
  
    var $price_band {
      value = ($input.price_band|first_notempty:"")|trim
    }
  
    var $meal_service {
      value = (($input.meal_service|first_notempty:"")|trim)|to_lower
    }
  
    var $want_open {
      value = $input.open_now == true
    }
  
    var $energy {
      value = (($input.energy|first_notempty:"")|trim)|to_lower
    }
  
    var $sort_by {
      value = (($input.sort_by|first_notempty:"relevance")|trim)|to_lower
    }
  
    var $limit_n {
      value = $input.limit|first_notempty:10
    }
  
    conditional {
      if ($limit_n > 10) {
        var.update $limit_n {
          value = 10
        }
      }
    
      elseif ($limit_n < 1) {
        var.update $limit_n {
          value = 1
        }
      }
    }
  
    var $min_n {
      value = $input.min_results|first_notempty:3
    }
  
    var $keywords {
      value = []
    }
  
    conditional {
      if ($input.keywords != null) {
        var.update $keywords {
          value = (($input.keywords|safe_array)|map:(($$|to_lower)|trim))|filter:(($$|strlen) > 0)
        }
      }
    }
  
    // ---------- Rules (edit here) ----------
    var $allowed_types {
      value = [
        "bar"
        "restaurant"
        "night_club"
        "cafe"
        "bakery"
        "food"
        "meal_takeaway"
        "meal_delivery"
      ]
    }
  
    var $block_terms {
      value = [
        "vape"
        "smoke shop"
        "dispensary"
        "party supply"
        "party house"
        "supply"
        "events"
        "event center"
        "wedding"
      ]
    }
  
    var $hospitality_terms {
      value = [
        "lounge"
        "loung"
        "bar"
        "grill"
        "cantina"
        "tavern"
        "pub"
        "kitchen"
        "cigar"
        "hookah"
        "hooka"
        "club"
        "cafe"
        "coffee"
        "restaurant"
        "bistro"
        "brewery"
        "taproom"
        "cocktail"
        "eatery"
        "diner"
      ]
    }
  
    // The google_types values that count as the requested venue_type.
    var $type_google {
      value = []
    }
  
    conditional {
      if ($venue_type == "bar") {
        var.update $type_google {
          value = ["bar"]
        }
      }
    
      elseif ($venue_type == "restaurant") {
        var.update $type_google {
          value = ["restaurant"]
        }
      }
    
      elseif ($venue_type == "club") {
        var.update $type_google {
          value = ["night_club"]
        }
      }
    
      elseif ($venue_type == "cafe") {
        var.update $type_google {
          value = ["cafe", "bakery"]
        }
      }
    
      elseif ($venue_type != "") {
        var.update $type_google {
          value = [$venue_type]
        }
      }
    }
  
    // Filters actually asked for, used by the relaxing step.
    var $requested {
      value = []
    }
  
    conditional {
      if ($venue_type != "") {
        array.push $requested {
          value = "venue_type"
        }
      }
    }
  
    conditional {
      if ($cuisine != "") {
        array.push $requested {
          value = "cuisine"
        }
      }
    }
  
    conditional {
      if ($neighborhood != "") {
        array.push $requested {
          value = "neighborhood"
        }
      }
    }
  
    conditional {
      if ($price_band != "") {
        array.push $requested {
          value = "price_band"
        }
      }
    }
  
    conditional {
      if ($meal_service != "") {
        array.push $requested {
          value = "meal_service"
        }
      }
    }
  
    conditional {
      if ($want_open) {
        array.push $requested {
          value = "open_now"
        }
      }
    }
  
    // ---------- Load: active, open-for-business venues in the city ----------
    db.query genie_venues {
      where = $db.genie_venues.city_id == $input.city_id && $db.genie_venues.status == "active" && $db.genie_venues.google_business_status != "CLOSED_PERMANENTLY" && $db.genie_venues.google_business_status != "CLOSED_TEMPORARILY" && $db.genie_venues.is_permanently_closed == false && $db.genie_venues.is_temporarily_closed == false
      sort = {id: "asc"}
      return = {type: "list"}
    } as $rows
  
    var $cands {
      value = []
    }
  
    var $excluded {
      value = {}
    }
  
    // ---------- Pass 1: exclude, test each filter, score ----------
    foreach ($rows) {
      each as $r {
        var $gt {
          value = ($r|get:"google_types":[])|safe_array
        }
      
        var $tags {
          value = (($r|get:"cuisine_tags":[])|safe_array)|filter:($$|is_text)
        }
      
        var $name_l {
          value = (($r|get:"venue_name":"")|trim)|to_lower
        }
      
        var $vibe {
          value = ($r|get:"vibe_notes":"")|trim
        }
      
        var $rating {
          value = ($r|get:"google_rating":0)|to_decimal
        }
      
        var $reason {
          value = ""
        }
      
        conditional {
          if ($name_l == "") {
            var.update $reason {
              value = "no_name"
            }
          }
        
          elseif ($gt|in:"lodging") {
            var.update $reason {
              value = "lodging"
            }
          }
        
          elseif ($block_terms|some:($name_l|icontains:$$)) {
            var.update $reason {
              value = "blocked_name"
            }
          }
        
          elseif ($rating <= 0 && $vibe == "" && ($tags|count) == 0) {
            var.update $reason {
              value = "no_data"
            }
          }
        
          elseif ((($gt|intersect:$allowed_types)|count) == 0 && ($hospitality_terms|some:($name_l|icontains:$$)) == false && $vibe == "") {
            var.update $reason {
              value = "not_hospitality"
            }
          }
        }
      
        conditional {
          if ($reason != "") {
            // Variables first: arithmetic inside a |set: argument breaks after Xano saves it.
            var $prev_count {
              value = $excluded|get:$reason:0
            }
          
            math.add $prev_count {
              value = 1
            }
          
            var.update $excluded {
              value = $excluded|set:$reason:$prev_count
            }
          }
        
          else {
            // Filter tests. A filter that was not asked for passes.
            var $ok_type {
              value = true
            }
          
            conditional {
              if (($type_google|count) > 0) {
                var.update $ok_type {
                  value = (($gt|intersect:$type_google)|count) > 0
                }
              }
            }
          
            var $ok_cuisine {
              value = true
            }
          
            conditional {
              if ($cuisine != "") {
                var.update $ok_cuisine {
                  value = ($tags|in:$cuisine_tag) || ($name_l|icontains:$cuisine) || ($vibe|icontains:$cuisine)
                }
              }
            }
          
            var $ok_hood {
              value = true
            }
          
            conditional {
              if ($neighborhood != "") {
                var.update $ok_hood {
                  value = (($r|get:"area_neighborhood":"") ~ " | " ~ ($r|get:"neighborhood_text":"") ~ " | " ~ ($r|get:"address":""))|icontains:$neighborhood
                }
              }
            }
          
            var $ok_price {
              value = true
            }
          
            conditional {
              if ($price_band != "") {
                var.update $ok_price {
                  value = ($r|get:"price_band":"") == $price_band
                }
              }
            }
          
            var $ok_meal {
              value = true
            }
          
            conditional {
              if ($meal_service == "brunch") {
                var.update $ok_meal {
                  value = $tags|in:"brunch"
                }
              }
            
              elseif ($meal_service == "happy_hour") {
                var.update $ok_meal {
                  value = ($r|get:"ms_happy_hour":false) == true
                }
              }
            
              elseif ($meal_service == "late_night") {
                var.update $ok_meal {
                  value = ($r|get:"ms_late_night":false) == true
                }
              }
            
              elseif ($meal_service == "reverse_happy_hour") {
                var.update $ok_meal {
                  value = ($r|get:"ms_reverse_happy_hour":false) == true
                }
              }
            }
          
            // Score. Rating is Bayesian: pulled toward 4.3 until there are many reviews.
            var $n_ratings {
              value = ($r|get:"google_user_ratings_total":0)|to_int
            }
          
            var $bayes {
              value = 0
            }
          
            conditional {
              if ($rating > 0) {
                var.update $bayes {
                  value = (($rating * $n_ratings) + (4.3 * 25)) / ($n_ratings + 25)
                }
              }
            }
          
            var $score {
              value = 0
            }
          
            var $hits {
              value = 0
            }
          
            conditional {
              if ($sort_by == "rating") {
                var.update $score {
                  value = $bayes
                }
              }
            
              else {
                conditional {
                  if ($bayes > 3.5) {
                    math.add $score {
                      value = 6 * ($bayes - 3.5)
                    }
                  }
                }
              
                conditional {
                  if ($vibe != "") {
                    math.add $score {
                      value = 1
                    }
                  }
                }
              
                conditional {
                  if (($r|get:"energy_level":"") != "") {
                    math.add $score {
                      value = 0.3
                    }
                  }
                }
              
                conditional {
                  if ((($r|get:"hours_json":{})|get:"periods":null)|is_array) {
                    math.add $score {
                      value = 0.3
                    }
                  }
                }
              
                conditional {
                  if (($r|get:"image_primary_url":"") != "") {
                    math.add $score {
                      value = 0.2
                    }
                  }
                }
              
                conditional {
                  if (($keywords|count) > 0) {
                    var $hay {
                      value = ($vibe ~ " " ~ ($r|get:"crowd":"") ~ " " ~ ($r|get:"music":"") ~ " " ~ $name_l ~ " " ~ ($tags|join:" "))
                    }
                  
                    var.update $hits {
                      value = ($keywords|filter:($hay|icontains:$$))|count
                    }
                  
                    var $hits_capped {
                      value = ($hits > 3) ? 3 : $hits
                    }
                  
                    math.add $score {
                      value = $hits_capped * 3
                    }
                  }
                }
              
                conditional {
                  if ($energy != "" && (($r|get:"energy_level":"")|to_lower) == $energy) {
                    math.add $score {
                      value = 2
                    }
                  }
                }
              }
            }
          
            var $r_id {
              value = $r|get:"id":0
            }
          
            array.push $cands {
              value = {
                id             : $r_id
                row            : $r
                ok_venue_type  : $ok_type
                ok_cuisine     : $ok_cuisine
                ok_neighborhood: $ok_hood
                ok_price_band  : $ok_price
                ok_meal_service: $ok_meal
                ok_open_now    : true
                score          : $score
                hits           : $hits
              }
            }
          }
        }
      }
    }
  
    // ---------- Open-now filter (computed from hours, all candidates) ----------
    var $open_map {
      value = {}
    }
  
    conditional {
      if ($want_open) {
        array.map ($cands) {
          by = {
            id        : $this.id
            hours_json: $this.row|get:"hours_json":null
          }
        } as $hour_items
      
        function.run "genie/fn_genie_venue_open_now_dev" {
          input = {items: $hour_items}
        } as $open_rows
      
        foreach ($open_rows) {
          each as $o {
            var $o_id {
              value = $o|get:"id":0
            }
          
            var $o_key {
              value = $o_id|to_text
            }
          
            var.update $open_map {
              value = $open_map|set:$o_key:$o
            }
          }
        }
      
        // Variables first: the open flag is computed before |set:, not inside its argument.
        var $cands_open {
          value = []
        }
      
        foreach ($cands) {
          each as $oc {
            var $oc_key {
              value = ($oc|get:"id":0)|to_text
            }
          
            var $oc_info {
              value = $open_map|get:$oc_key:{}
            }
          
            var $oc_is_open {
              value = ($oc_info|get:"open_now":null) == true
            }
          
            var $oc_updated {
              value = $oc|set:"ok_open_now":$oc_is_open
            }
          
            array.push $cands_open {
              value = $oc_updated
            }
          }
        }
      
        var.update $cands {
          value = $cands_open
        }
      }
    }
  
    // ---------- Relax least important filters until there are enough matches ----------
    var $relaxed {
      value = []
    }
  
    // A candidate stays in the pool unless it fails a filter that has not been relaxed.
    // Built with foreach, not a filter lambda: the long lambda is the suspected "Invalid expression".
    var $pool {
      value = []
    }
  
    foreach ($cands) {
      each as $pc {
        var $pc_keep {
          value = true
        }
      
        conditional {
          if ($pc.ok_venue_type == false && ($relaxed|in:"venue_type") == false) {
            var.update $pc_keep {
              value = false
            }
          }
        
          elseif ($pc.ok_cuisine == false && ($relaxed|in:"cuisine") == false) {
            var.update $pc_keep {
              value = false
            }
          }
        
          elseif ($pc.ok_neighborhood == false && ($relaxed|in:"neighborhood") == false) {
            var.update $pc_keep {
              value = false
            }
          }
        
          elseif ($pc.ok_price_band == false && ($relaxed|in:"price_band") == false) {
            var.update $pc_keep {
              value = false
            }
          }
        
          elseif ($pc.ok_meal_service == false && ($relaxed|in:"meal_service") == false) {
            var.update $pc_keep {
              value = false
            }
          }
        
          elseif ($pc.ok_open_now == false && ($relaxed|in:"open_now") == false) {
            var.update $pc_keep {
              value = false
            }
          }
        }
      
        conditional {
          if ($pc_keep) {
            array.push $pool {
              value = $pc
            }
          }
        }
      }
    }
  
    foreach ([
      "meal_service"
      "open_now"
      "price_band"
      "neighborhood"
      "cuisine"
      "venue_type"
    ]) {
      each as $step {
        conditional {
          if (($pool|count) < $min_n && ($requested|in:$step)) {
            array.push $relaxed {
              value = $step
            }
          
            // Same rule as the first pool build above, with this step now relaxed.
            var.update $pool {
              value = []
            }
          
            foreach ($cands) {
              each as $rc {
                var $rc_keep {
                  value = true
                }
              
                conditional {
                  if ($rc.ok_venue_type == false && ($relaxed|in:"venue_type") == false) {
                    var.update $rc_keep {
                      value = false
                    }
                  }
                
                  elseif ($rc.ok_cuisine == false && ($relaxed|in:"cuisine") == false) {
                    var.update $rc_keep {
                      value = false
                    }
                  }
                
                  elseif ($rc.ok_neighborhood == false && ($relaxed|in:"neighborhood") == false) {
                    var.update $rc_keep {
                      value = false
                    }
                  }
                
                  elseif ($rc.ok_price_band == false && ($relaxed|in:"price_band") == false) {
                    var.update $rc_keep {
                      value = false
                    }
                  }
                
                  elseif ($rc.ok_meal_service == false && ($relaxed|in:"meal_service") == false) {
                    var.update $rc_keep {
                      value = false
                    }
                  }
                
                  elseif ($rc.ok_open_now == false && ($relaxed|in:"open_now") == false) {
                    var.update $rc_keep {
                      value = false
                    }
                  }
                }
              
                conditional {
                  if ($rc_keep) {
                    array.push $pool {
                      value = $rc
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  
    var $pool_count {
      value = $pool|count
    }
  
    // ---------- Rank and take the top ----------
    var $top {
      value = ($pool|sort:"score":"number":false)|slice:0:$limit_n
    }
  
    // Open status for display, when it was not already computed for the filter.
    conditional {
      if ($want_open == false && ($top|count) > 0) {
        array.map ($top) {
          by = {
            id        : $this.id
            hours_json: $this.row|get:"hours_json":null
          }
        } as $top_items
      
        function.run "genie/fn_genie_venue_open_now_dev" {
          input = {items: $top_items}
        } as $top_open_rows
      
        foreach ($top_open_rows) {
          each as $o2 {
            var $o2_id {
              value = $o2|get:"id":0
            }
          
            var $o2_key {
              value = $o2_id|to_text
            }
          
            var.update $open_map {
              value = $open_map|set:$o2_key:$o2
            }
          }
        }
      }
    }
  
    // ---------- Build the outputs ----------
    var $venues {
      value = []
    }
  
    var $cards {
      value = []
    }
  
    var $ranking {
      value = []
    }
  
    foreach ($top) {
      each as $c {
        function.run "genie/fn_genie_format_venue_for_model_dev" {
          input = {
            venue    : $c.row
            open_info: $open_map|get:(($c.id)|to_text):null
          }
        } as $formatted
      
        function.run "genie/fn_genie_slim_venue_row_dev" {
          input = {venue: $c.row}
        } as $card
      
        array.push $venues {
          value = $formatted
        }
      
        array.push $cards {
          value = $card
        }
      
        array.push $ranking {
          value = {id: $c.id, score: $c.score, keyword_hits: $c.hits}
        }
      }
    }
  
    var $n_rows {
      value = $rows|count
    }
  
    var $n_cands {
      value = $cands|count
    }
  
    var $match_quality {
      value = "strong"
    }
  
    var $fail_reason {
      value = null
    }
  
    conditional {
      if ($pool_count == 0) {
        var.update $match_quality {
          value = "empty"
        }
      
        var.update $fail_reason {
          value = "no_matches"
        }
      }
    
      elseif (($relaxed|count) > 0 || $pool_count < $min_n) {
        var.update $match_quality {
          value = "loose"
        }
      }
    }
  
    var $debug_out {
      value = {
        base_rows : $n_rows
        candidates: $n_cands
        excluded  : $excluded
        requested : $requested
        sort_by   : $sort_by
        ranking   : $ranking
      }
    }
  }

  response = {
    venues       : $venues
    cards        : $cards
    match_quality: $match_quality
    relaxed      : $relaxed
    count        : $pool_count
    fail_reason  : $fail_reason
    debug        : $debug_out
  }
}