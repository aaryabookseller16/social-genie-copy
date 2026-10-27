// Folder: genie
// PURPOSE: Single place that decides which supported city a Genie request is about,
// and whether the user's coordinates should be used for proximity.
// Priority: city named in message > client city_context > nearest city within 80 km of
// coordinates > session city > profile city > ask the user.
// Distance is computed inline (equirectangular) because genie/fn_geo_distance_m
// (util.geo_distance) currently returns null.
function "genie/fn_genie_resolve_city_dev" {
  input {
    // The user's message
    text message?
  
    // City sent by the client (an explicit pick or a remembered session city)
    text city_context?
  
    // Device latitude (0 or missing means no location)
    decimal lat?
  
    // Device longitude (0 or missing means no location)
    decimal lng?
  
    // Chat session token, used to read the session's last city
    text session_token?
  
    // External user id, used to read the profile city
    text external_user_id?
  }

  stack {
    // 1. Active cities
    db.query city_graph_cities {
      where = $db.city_graph_cities.active == true
      sort = {priority: "asc"}
      return = {type: "list", paging: {page: 1, per_page: 200}}
    } as $cities_page
  
    var $cities {
      value = ($cities_page.items ?? [])
    }
  
    var $supported_cities {
      value = []
    }
  
    foreach ($cities) {
      each as $city_item {
        array.push $supported_cities {
          value = $city_item.city_name
        }
      }
    }
  
    // 2. Normalize the message so whole-word matching works:
    // lowercase, punctuation turned into spaces, padded with a space on each side.
    var $msg_raw {
      value = ($input.message ?? "")|trim
    }
  
    var $msg_lower {
      value = $msg_raw|to_lower
    }
  
    var $msg_norm {
      value = $msg_lower
    }
  
    var.update $msg_norm {
      value = $msg_norm|replace:",":" "
    }
  
    var.update $msg_norm {
      value = $msg_norm|replace:".":" "
    }
  
    var.update $msg_norm {
      value = $msg_norm|replace:"?":" "
    }
  
    var.update $msg_norm {
      value = $msg_norm|replace:"!":" "
    }
  
    var.update $msg_norm {
      value = $msg_norm|replace:";":" "
    }
  
    var.update $msg_norm {
      value = $msg_norm|replace:":":" "
    }
  
    var.update $msg_norm {
      value = $msg_norm|replace:"'":" "
    }
  
    var.update $msg_norm {
      value = $msg_norm|replace:"(":" "
    }
  
    var.update $msg_norm {
      value = $msg_norm|replace:")":" "
    }
  
    var.update $msg_norm {
      value = (" " ~ $msg_norm) ~ " "
    }
  
    var $wants_near_me {
      value = (($msg_lower|contains:"near me") || ($msg_lower|contains:"nearby") || ($msg_lower|contains:"close to me") || ($msg_lower|contains:"around me"))
    }
  
    // 3. Validate the coordinates (0,0 or out of range means "no location")
    var $lat_v {
      value = 0
    }
  
    var $lng_v {
      value = 0
    }
  
    conditional {
      if ($input.lat != null && $input.lng != null) {
        var.update $lat_v {
          value = $input.lat|to_decimal
        }
      
        var.update $lng_v {
          value = $input.lng|to_decimal
        }
      }
    }
  
    var $has_geo {
      value = false
    }
  
    conditional {
      if (($lat_v != 0 || $lng_v != 0) && $lat_v >= -90 && $lat_v <= 90 && $lng_v >= -180 && $lng_v <= 180) {
        var.update $has_geo {
          value = true
        }
      }
    }
  
    var $cos_lat {
      value = (($lat_v * 3.14159265) / 180)|cos
    }
  
    conditional {
      if ($cos_lat < 0.01) {
        var.update $cos_lat {
          value = 0.01
        }
      }
    }
  
    // 4. Other city hints: client city_context, session city, profile city
    var $client_raw {
      value = ($input.city_context ?? "")|trim
    }
  
    var $client_norm {
      value = $client_raw|to_lower
    }
  
    var.update $client_norm {
      value = $client_norm|replace:",":" "
    }
  
    var.update $client_norm {
      value = $client_norm|replace:".":" "
    }
  
    var.update $client_norm {
      value = (" " ~ $client_norm) ~ " "
    }
  
    var $session_city_name {
      value = ""
    }
  
    var $session_tok {
      value = ($input.session_token ?? "")|trim
    }
  
    conditional {
      if ($session_tok != "") {
        db.query genie_session {
          where = $db.genie_session.session_token == $session_tok
          return = {type: "single"}
        } as $sess_row
      
        conditional {
          if ($sess_row != null) {
            var.update $session_city_name {
              value = ((($sess_row|get:"city_context":"") ?? "")|trim)|to_lower
            }
          }
        }
      }
    }
  
    var $profile_city_name {
      value = ""
    }
  
    var $ext_id {
      value = ($input.external_user_id ?? "")|trim
    }
  
    conditional {
      if ($ext_id != "" && $ext_id != "web_guest") {
        db.query genie_user {
          where = $db.genie_user.external_user_id == $ext_id
          return = {type: "single"}
        } as $u_row
      
        conditional {
          if ($u_row != null) {
            var.update $profile_city_name {
              value = ((($u_row|get:"preferred_city":"") ?? "")|trim)|to_lower
            }
          
            conditional {
              if ($profile_city_name == "") {
                var.update $profile_city_name {
                  value = ((($u_row|get:"home_city":"") ?? "")|trim)|to_lower
                }
              }
            }
          }
        }
      }
    }
  
    // 5. One pass over the active cities: message match, client match, session
    // match, profile match, and distance from the device.
    var $matched_city {
      value = null
    }
  
    var $matched_count {
      value = 0
    }
  
    var $client_city {
      value = null
    }
  
    var $session_city {
      value = null
    }
  
    var $profile_city {
      value = null
    }
  
    var $geo_city {
      value = null
    }
  
    var $geo_city_dist {
      value = 0
    }
  
    foreach ($cities) {
      each as $c {
        var $c_lower {
          value = $c.city_name|to_lower
        }
      
        var $c_needle {
          value = (" " ~ $c_lower) ~ " "
        }
      
        conditional {
          if ($msg_norm|contains:$c_needle) {
            math.add $matched_count {
              value = 1
            }
          
            conditional {
              if ($matched_city == null) {
                var.update $matched_city {
                  value = $c
                }
              }
            }
          }
        }
      
        conditional {
          if ($client_raw != "" && $client_city == null && ($client_norm|contains:$c_needle)) {
            var.update $client_city {
              value = $c
            }
          }
        }
      
        conditional {
          if ($session_city == null && $session_city_name != "" && $session_city_name == $c_lower) {
            var.update $session_city {
              value = $c
            }
          }
        }
      
        conditional {
          if ($profile_city == null && $profile_city_name != "" && $profile_city_name == $c_lower) {
            var.update $profile_city {
              value = $c
            }
          }
        }
      
        conditional {
          if ($has_geo && ($c.lat ?? "") != "" && ($c.lng ?? "") != "") {
            var $dy_c {
              value = (($c.lat|to_decimal) - $lat_v) * 111320
            }
          
            var $dx_c {
              value = ((($c.lng|to_decimal) - $lng_v) * 111320) * $cos_lat
            }
          
            var $dist_c {
              value = (($dy_c * $dy_c) + ($dx_c * $dx_c))|sqrt
            }
          
            conditional {
              if ($geo_city == null || $dist_c < $geo_city_dist) {
                var.update $geo_city {
                  value = $c
                }
              
                var.update $geo_city_dist {
                  value = $dist_c
                }
              }
            }
          }
        }
      }
    }
  
    var $geo_in_range {
      value = ($geo_city != null && $geo_city_dist <= 80000)
    }
  
    var $geo_outside {
      value = ($has_geo && ($geo_in_range == false))
    }
  
    // 6. A city the user named that we do not cover. Checked only when no
    // supported city was named, so GPS is never used as a silent fallback.
    var $unsupported_name {
      value = ""
    }
  
    var $known_other_cities {
      value = [
        "new york"
        "los angeles"
        "chicago"
        "dallas"
        "austin"
        "san antonio"
        "atlanta"
        "miami"
        "san francisco"
        "seattle"
        "denver"
        "phoenix"
        "boston"
        "philadelphia"
        "las vegas"
        "nashville"
        "new orleans"
        "san diego"
        "college station"
        "orlando"
        "detroit"
        "minneapolis"
        "fort worth"
      ]
    }
  
    conditional {
      if ($matched_city == null) {
        foreach ($known_other_cities) {
          each as $kc {
            conditional {
              if ($unsupported_name == "" && ($msg_norm|contains:(" " ~ $kc) ~ " ")) {
                var.update $unsupported_name {
                  value = $kc|capitalize
                }
              }
            }
          }
        }
      }
    }
  
    // Capitalized place after " in " (for example "bars in Springfield"),
    // skipping neighborhoods and phrases like "in the Heights".
    conditional {
      if ($matched_city == null && $unsupported_name == "") {
        var $in_parts {
          value = []
        }
      
        conditional {
          if ($msg_raw|contains:" in ") {
            var.update $in_parts {
              value = $msg_raw|split:" in "
            }
          }
        
          elseif ($msg_raw|contains:" In ") {
            var.update $in_parts {
              value = $msg_raw|split:" In "
            }
          }
        }
      
        conditional {
          if (($in_parts|count) > 1) {
            var $in_tail {
              value = $in_parts|last
            }
          
            var.update $in_tail {
              value = $in_tail|replace:",":"|"
            }
          
            var.update $in_tail {
              value = $in_tail|replace:".":"|"
            }
          
            var.update $in_tail {
              value = $in_tail|replace:"?":"|"
            }
          
            var.update $in_tail {
              value = $in_tail|replace:"!":"|"
            }
          
            var $in_cand {
              value = (($in_tail|split:"|")|first)|trim
            }
          
            var $cand_words {
              value = $in_cand|split:" "
            }
          
            var $cand_first_char {
              value = $in_cand|substr:0:1
            }
          
            var $cand_lower {
              value = $in_cand|to_lower
            }
          
            var $cand_first_word {
              value = ($cand_words|first)|to_lower
            }
          
            var $skip_words {
              value = [
                "the"
                "a"
                "an"
                "my"
                "this"
                "that"
                "our"
                "your"
                "town"
                "there"
                "here"
                "love"
                "time"
              ]
            }
          
            var $hood_words {
              value = [
                "third ward"
                "midtown"
                "montrose"
                "downtown"
                "heights"
                "river oaks"
                "eado"
                "east end"
                "museum district"
                "galleria"
                "medical center"
                "upper kirby"
                "west u"
                "bellaire"
                "meyerland"
                "memorial"
                "spring branch"
                "fifth ward"
                "sunnyside"
                "rice village"
                "washington ave"
              ]
            }
          
            var $is_hood {
              value = false
            }
          
            foreach ($hood_words) {
              each as $hw {
                conditional {
                  if ($cand_lower|contains:$hw) {
                    var.update $is_hood {
                      value = true
                    }
                  }
                }
              }
            }
          
            conditional {
              if ($in_cand != "" && ($cand_words|count) <= 3 && $cand_first_char == ($cand_first_char|to_upper) && $cand_first_char != ($cand_first_char|to_lower) && $is_hood == false && (($skip_words|in:$cand_first_word) == false)) {
                var.update $unsupported_name {
                  value = $in_cand
                }
              }
            }
          }
        }
      }
    }
  
    // 7. Decide
    var $resolved_row {
      value = null
    }
  
    var $source {
      value = "none"
    }
  
    var $location_status {
      value = "ok"
    }
  
    var $unsupported_final {
      value = ""
    }
  
    conditional {
      if ($matched_city != null) {
        var.update $resolved_row {
          value = $matched_city
        }
      
        var.update $source {
          value = "message"
        }
      }
    
      elseif ($unsupported_name != "") {
        var.update $location_status {
          value = "unsupported_city"
        }
      
        var.update $unsupported_final {
          value = $unsupported_name
        }
      
        var.update $source {
          value = "message"
        }
      }
    
      elseif ($client_city != null) {
        var.update $resolved_row {
          value = $client_city
        }
      
        var.update $source {
          value = "client"
        }
      }
    
      elseif ($client_raw != "") {
        var.update $location_status {
          value = "unsupported_city"
        }
      
        var.update $unsupported_final {
          value = $client_raw
        }
      
        var.update $source {
          value = "client"
        }
      }
    
      elseif ($geo_in_range) {
        var.update $resolved_row {
          value = $geo_city
        }
      
        var.update $source {
          value = "geo"
        }
      }
    
      elseif ($session_city != null) {
        var.update $resolved_row {
          value = $session_city
        }
      
        var.update $source {
          value = "session"
        }
      }
    
      elseif ($profile_city != null) {
        var.update $resolved_row {
          value = $profile_city
        }
      
        var.update $source {
          value = "profile"
        }
      }
    
      else {
        conditional {
          if ($has_geo) {
            var.update $location_status {
              value = "outside_supported_area"
            }
          }
        
          else {
            var.update $location_status {
              value = "city_missing"
            }
          }
        }
      }
    }
  
    // "near me" from outside every supported city, with only a remembered city
    // to fall back on: say so instead of quietly searching somewhere else.
    conditional {
      if ($location_status == "ok" && $geo_outside && $wants_near_me && ($source == "session" || $source == "profile")) {
        var.update $location_status {
          value = "outside_supported_area"
        }
      
        var.update $resolved_row {
          value = null
        }
      }
    }
  
    // 8. Proximity applies only when the device is within 80 km of the resolved city.
    var $geo_used {
      value = false
    }
  
    var $geo_distance_m {
      value = null
    }
  
    conditional {
      if ($location_status == "ok" && $has_geo && $resolved_row != null && ($resolved_row.lat ?? "") != "" && ($resolved_row.lng ?? "") != "") {
        var $dy_r {
          value = (($resolved_row.lat|to_decimal) - $lat_v) * 111320
        }
      
        var $dx_r {
          value = ((($resolved_row.lng|to_decimal) - $lng_v) * 111320) * $cos_lat
        }
      
        var $dist_r {
          value = (($dy_r * $dy_r) + ($dx_r * $dx_r))|sqrt
        }
      
        var.update $geo_distance_m {
          value = $dist_r
        }
      
        conditional {
          if ($dist_r <= 80000) {
            var.update $geo_used {
              value = true
            }
          }
        }
      }
    }
  }

  response = {
    location_status          : $location_status
    city_id                  : ($resolved_row != null ? $resolved_row.id : null)
    city_name                : ($resolved_row != null ? $resolved_row.city_name : "")
    city_state               : ($resolved_row != null ? ($resolved_row.state ?? "") : "")
    source                   : $source
    geo_used                 : $geo_used
    geo_distance_m           : $geo_distance_m
    has_geo                  : $has_geo
    geo_outside              : $geo_outside
    wants_near_me            : $wants_near_me
    unsupported_city         : $unsupported_final
    multiple_cities_mentioned: ($matched_count > 1)
    supported_cities         : $supported_cities
  }
}