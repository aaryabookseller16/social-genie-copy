// Migrates genie_user_social_profile tag arrays into user context documents as
// source = stated preferences (GEN-011). Reads 25 rows per query (NF-004) and
// loops `pages` batches starting at `page`.
// dry_run (default true) only counts; it writes nothing. With dry_run = false it
// creates the context row if needed and applies the tags as stated adds.
function "genie/fn_genie_migrate_social_profile_to_context_dev" {
  input {
    bool dry_run?=true
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

    var $profiles_scanned {
      value = 0
    }

    var $profiles_with_tags {
      value = 0
    }

    var $tags_found {
      value = 0
    }

    var $would_create {
      value = 0
    }

    var $would_update {
      value = 0
    }

    var $created {
      value = 0
    }

    var $updated {
      value = 0
    }

    var $owner_device_only {
      value = 0
    }

    var $skipped_no_owner {
      value = 0
    }

    var $last_page {
      value = $input.page
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

        var.update $last_page {
          value = $current_page
        }

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
            math.add $profiles_scanned {
              value = 1
            }

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
                              value = {op: "add", category: $map.category, value: $label, source: "stated"}
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }

            var $tag_count {
              value = $ops|count
            }

            conditional {
              if ($tag_count == 0) {
                continue
              }
            }

            math.add $profiles_with_tags {
              value = 1
            }

            math.add $tags_found {
              value = $tag_count
            }

            // Resolve the owner: genie_user via external_user_id, else device only.
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

            conditional {
              if ($owner_user_id == 0 && $dev_id == "") {
                math.add $skipped_no_owner {
                  value = 1
                }

                continue
              }
            }

            conditional {
              if ($owner_user_id == 0) {
                math.add $owner_device_only {
                  value = 1
                }
              }
            }

            function.run "genie/fn_genie_get_user_context_dev" {
              input = {user_id: $owner_user_id, device_id: $dev_id}
            } as $existing

            conditional {
              if ($existing == null) {
                math.add $would_create {
                  value = 1
                }
              }

              else {
                math.add $would_update {
                  value = 1
                }
              }
            }

            conditional {
              if ($input.dry_run == false) {
                function.run "genie/fn_genie_create_user_context_dev" {
                  input = {user_id: $owner_user_id, device_id: $dev_id}
                } as $ctx_row

                function.run "genie/fn_genie_update_user_context_dev" {
                  input = {
                    user_id         : $owner_user_id
                    device_id       : $dev_id
                    expected_version: $ctx_row.version
                    ops             : $ops
                  }
                } as $update_result

                conditional {
                  if ($existing == null) {
                    math.add $created {
                      value = 1
                    }
                  }

                  else {
                    math.add $updated {
                      value = 1
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
    dry_run  : $input.dry_run
    last_page: $last_page
    done     : $done
    stats    : {
      profiles_scanned: $profiles_scanned
      profiles_with_tags: $profiles_with_tags
      tags_found: $tags_found
      would_create: $would_create
      would_update: $would_update
      created: $created
      updated: $updated
      owner_device_only: $owner_device_only
      skipped_no_owner: $skipped_no_owner
    }
  }
}
