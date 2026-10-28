// Enforces the user context caps after one preference op (GEN-013).
// Live = status active or user_edited. Caps: max_per_category live entries per category,
// max_live live entries in total, max_tombstones user_removed entries (oldest pruned).
// Expired entries are dropped. When a live cap is exceeded, the inferred entry with the
// lowest confidence (oldest last_reinforced on ties) is evicted. Stated entries are never
// evicted: if only stated entries are left, or the victim is the entry just written,
// rejected = true and the caller keeps its previous preferences.
function "genie/fn_genie_enforce_context_caps_dev" {
  input {
    json? prefs?

    // id (category:value) of the entry the op just wrote
    text key

    int? max_per_category?=10
    int? max_live?=60
    int? max_tombstones?=40
  }

  stack {
    var $prefs {
      value = []
    }

    conditional {
      if ($input.prefs|is_array) {
        var.update $prefs {
          value = $input.prefs
        }
      }
    }

    var $evicted {
      value = []
    }

    var $rejected {
      value = false
    }

    // 1) Expired entries carry no weight; drop them.
    array.filter ($prefs) if ($this.status != "expired") as $kept

    var.update $prefs {
      value = $kept
    }

    array.find ($prefs) if ($this.id == $input.key) as $touched

    var $category {
      value = ""
    }

    conditional {
      if ($touched != null) {
        var.update $category {
          value = $touched.category
        }
      }
    }

    // 2) Per-category live cap
    array.filter ($prefs) if (($this.status == "active" || $this.status == "user_edited") && $this.category == $category) as $cat_live

    conditional {
      if (($cat_live|count) > $input.max_per_category) {
        array.filter ($cat_live) if ($this.source != "stated") as $cat_candidates

        conditional {
          if (($cat_candidates|count) == 0) {
            var.update $rejected {
              value = true
            }
          }

          else {
            var $cat_victim {
              value = ($cat_candidates|sort:"last_reinforced":"number":true|sort:"confidence":"number":true)|first
            }

            conditional {
              if ($cat_victim.id == $input.key) {
                var.update $rejected {
                  value = true
                }
              }

              else {
                array.filter ($prefs) if ($this.id != $cat_victim.id) as $after_cat

                var.update $prefs {
                  value = $after_cat
                }

                array.push $evicted {
                  value = $cat_victim.id
                }
              }
            }
          }
        }
      }
    }

    // 3) Total live cap
    conditional {
      if ($rejected == false) {
        array.filter ($prefs) if ($this.status == "active" || $this.status == "user_edited") as $live

        conditional {
          if (($live|count) > $input.max_live) {
            array.filter ($live) if ($this.source != "stated") as $live_candidates

            conditional {
              if (($live_candidates|count) == 0) {
                var.update $rejected {
                  value = true
                }
              }

              else {
                var $live_victim {
                  value = ($live_candidates|sort:"last_reinforced":"number":true|sort:"confidence":"number":true)|first
                }

                conditional {
                  if ($live_victim.id == $input.key) {
                    var.update $rejected {
                      value = true
                    }
                  }

                  else {
                    array.filter ($prefs) if ($this.id != $live_victim.id) as $after_live

                    var.update $prefs {
                      value = $after_live
                    }

                    array.push $evicted {
                      value = $live_victim.id
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // 4) Tombstone cap: prune the oldest removals
    conditional {
      if ($rejected == false) {
        array.filter ($prefs) if ($this.status == "user_removed") as $tombs

        var $tomb_count {
          value = $tombs|count
        }

        conditional {
          if ($tomb_count > $input.max_tombstones) {
            var $overflow {
              value = 0
            }

            math.add $overflow {
              value = $tomb_count
            }

            math.sub $overflow {
              value = $input.max_tombstones
            }

            var $oldest {
              value = ($tombs|sort:"last_reinforced":"number":true)|slice:0:$overflow
            }

            foreach ($oldest) {
              each as $old {
                array.filter ($prefs) if ($this.id != $old.id) as $after_tomb

                var.update $prefs {
                  value = $after_tomb
                }

                array.push $evicted {
                  value = $old.id
                }
              }
            }
          }
        }
      }
    }
  }

  response = {
    prefs   : $prefs
    evicted : $evicted
    rejected: $rejected
  }
}
