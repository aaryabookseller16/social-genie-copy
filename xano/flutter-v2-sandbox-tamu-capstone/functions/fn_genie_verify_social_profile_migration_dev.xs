// Read-only check for GEN-011: for every social profile tag, confirms the owner's
// user context has a matching active stated entry. Same mapping and batching as
// fn_genie_migrate_social_profile_to_context_dev.
function "genie/fn_genie_verify_social_profile_migration_dev" {
  input {
    int page?=1 filters=min:1
    int pages?=1 filters=min:1|max:100
  }

  stack {
    var $field_map {
      value = [
        {field: "experiences_tags", category: "experience"}
        {field: "atmosphere_tags", category: "atmosphere"}
        {field: "bevy_bites_tags", category: "food"}
        {field: "community_tags", category: "community"}
        {field: "music_tags", category: "music"}
        {field: "sports_tags", category: "sports_team"}
        {field: "events_tags", category: "event"}
        {field: "occasions_tags", category: "occasion"}
        {field: "neighborhood_prefs", category: "neighborhood"}
        {field: "price_range", category: "price"}
        {field: "budget_preference", category: "price"}
        {field: "group_size", category: "group_size"}
        {field: "typical_time", category: "typical_time"}
      ]
    }
  
    var $tags_checked {
      value = 0
    }
  
    var $tags_matched {
      value = 0
    }
  
    var $missing {
      value = []
    }
  
    var $done {
      value = false
    }
  
    for ($input.pages) {
      each as $batch_index {
        conditional {
          if ($done) {
            continue
          }
        }
      
        var $current_page {
          value = $input.page + $batch_index
        }
      
        db.query genie_user_social_profile {
          sort = {id: "asc"}
          return = {type: "list", paging: {page: $current_page, per_page: 25}}
        } as $batch
      
        conditional {
          if (($batch.items|count) == 0) {
            var.update $done {
              value = true
            }
          
            continue
          }
        }
      
        foreach ($batch.items) {
          each as $profile {
            var $ops {
              value = []
            }
          
            foreach ($field_map) {
              each as $map {
                var $raw {
                  value = $profile|get:$map.field
                }
              
                var $values {
                  value = []
                }
              
                conditional {
                  if ($raw|is_array) {
                    var.update $values {
                      value = $raw
                    }
                  }
                
                  elseif ($raw|is_text) {
                    var.update $values {
                      value = [$raw]
                    }
                  }
                }
              
                foreach ($values) {
                  each as $item {
                    conditional {
                      if ($item|is_text) {
                        var $label {
                          value = $item|trim
                        }
                      
                        conditional {
                          if ($label != "" && $label != "{}" && ($label|to_lower) != "[object object]") {
                            array.push $ops {
                              value = {
                                op      : "add"
                                category: $map.category
                                value   : $label
                                source  : "stated"
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          
            conditional {
              if (($ops|count) == 0) {
                continue
              }
            }
          
            var $owner_user_id {
              value = 0
            }
          
            var $ext_id {
              value = (($profile.external_user_id ?? "")|to_text)|trim
            }
          
            var $dev_id {
              value = (($profile.device_id ?? "")|to_text)|trim
            }
          
            conditional {
              if ($ext_id != "") {
                db.query genie_user {
                  where = $db.genie_user.external_user_id == $ext_id
                  return = {type: "single"}
                } as $owner
              
                conditional {
                  if ($owner != null) {
                    var.update $owner_user_id {
                      value = $owner.id
                    }
                  }
                }
              }
            }
          
            function.run "genie/fn_genie_get_user_context_dev" {
              input = {user_id: $owner_user_id, device_id: $dev_id}
            } as $ctx
          
            var $prefs {
              value = []
            }
          
            conditional {
              if ($ctx != null && ($ctx.context_json|get:"preferences")|is_array) {
                var.update $prefs {
                  value = $ctx.context_json|get:"preferences"
                }
              }
            }
          
            foreach ($ops) {
              each as $op {
                math.add $tags_checked {
                  value = 1
                }
              
                var $key {
                  value = $op.category ~ ":" ~ ($op.value|to_lower)
                }
              
                array.find ($prefs) if ($this.id == $key && $this.source == "stated" && $this.status == "active") as $hit
                conditional {
                  if ($hit != null) {
                    math.add $tags_matched {
                      value = 1
                    }
                  }
                
                  else {
                    array.push $missing {
                      value = {profile_id: $profile.id, key: $key}
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  response = {
    done        : $done
    tags_checked: $tags_checked
    tags_matched: $tags_matched
    missing     : $missing|slice:0:50
  }
}