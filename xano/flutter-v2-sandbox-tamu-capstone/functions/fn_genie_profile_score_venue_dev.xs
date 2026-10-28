// GEN-013 (2026-10-21): kill switch $use_social_profile_bonus, off. genie_user_context is now the
// one source of preferences (it reaches ranking through fn_genie_search_venues_dev and the pick
// prompt), and this bonus also ranked on community identity and music, which the plan does not
// allow without consent. With the switch off the bonus is 0; set it to true to restore the
// previous behavior. No existing line below was changed.
function "genie/fn_genie_profile_score_venue_dev" {
  input {
    json venue
    json social_music?
    json social_atmosphere?
    json social_experiences?
    json social_community?
    json social_bevy_bites?
    text social_price_range?
    int social_signal_count?
  }

  stack {
    var $use_social_profile_bonus {
      value = false
    }

    var $bonus {
      value = 0
    }

    conditional {
      if (($input.social_signal_count ?? 0) >= 1) {
        var $v_cuisine {
          value = $input.venue|get:"cuisine_tags":[]
        }

        conditional {
          if (($input.social_bevy_bites|count) > 0 && $v_cuisine != null && ($v_cuisine|is_array)) {
            foreach ($input.social_bevy_bites) {
              each as $pref_bite {
                conditional {
                  if (($v_cuisine|json_encode)|contains:$pref_bite) {
                    var.update $bonus {
                      value = $bonus + 3
                    }
                  }
                }
              }
            }
          }
        }

        var $v_cultural {
          value = $input.venue|get:"cultural_identity_tags":[]
        }

        conditional {
          if (($input.social_community|count) > 0) {
            foreach ($input.social_community) {
              each as $pref_comm {
                conditional {
                  if (($pref_comm|to_lower)|contains:"black") {
                    conditional {
                      if ($input.venue|get:"black_owned":false) {
                        var.update $bonus {
                          value = $bonus + 5
                        }
                      }
                    }
                  }
                }

                conditional {
                  if (($pref_comm|to_lower)|contains:"latino") {
                    conditional {
                      if ($input.venue|get:"latino_owned":false) {
                        var.update $bonus {
                          value = $bonus + 5
                        }
                      }
                    }
                  }
                }

                conditional {
                  if (($pref_comm|to_lower)|contains:"lgbtq") {
                    conditional {
                      if ($input.venue|get:"lgbtq_friendly":false) {
                        var.update $bonus {
                          value = $bonus + 5
                        }
                      }
                    }
                  }
                }

                conditional {
                  if (($pref_comm|to_lower)|contains:"woman") {
                    conditional {
                      if ($input.venue|get:"woman_owned":false) {
                        var.update $bonus {
                          value = $bonus + 5
                        }
                      }
                    }
                  }
                }

                conditional {
                  if ($v_cultural != null && ($v_cultural|is_array) && ($v_cultural|json_encode)|contains:$pref_comm) {
                    var.update $bonus {
                      value = $bonus + 4
                    }
                  }
                }
              }
            }
          }
        }

        var $v_music {
          value = $input.venue|get:"music":""
        }

        var $v_entertain {
          value = $input.venue|get:"entertainment_types":[]
        }

        conditional {
          if (($input.social_music|count) > 0) {
            foreach ($input.social_music) {
              each as $pref_music {
                conditional {
                  if ($v_music != null && ($v_music|to_lower)|contains:($pref_music|to_lower)) {
                    var.update $bonus {
                      value = $bonus + 3
                    }
                  }
                }

                conditional {
                  if ($v_entertain != null && ($v_entertain|is_array) && ($v_entertain|json_encode)|contains:$pref_music) {
                    var.update $bonus {
                      value = $bonus + 2
                    }
                  }
                }

                conditional {
                  if (($input.venue|get:"has_live_music":false) || ($input.venue|get:"has_dj":false)) {
                    var.update $bonus {
                      value = $bonus + 1
                    }
                  }
                }
              }
            }
          }
        }

        var $v_energy {
          value = $input.venue|get:"energy_level":""
        }

        var $v_crowd {
          value = $input.venue|get:"crowd":""
        }

        conditional {
          if (($input.social_atmosphere|count) > 0) {
            foreach ($input.social_atmosphere) {
              each as $pref_atm {
                conditional {
                  if ($v_energy != null && ($v_energy|to_lower)|contains:($pref_atm|to_lower)) {
                    var.update $bonus {
                      value = $bonus + 3
                    }
                  }
                }

                conditional {
                  if ($v_crowd != null && ($v_crowd|to_lower)|contains:($pref_atm|to_lower)) {
                    var.update $bonus {
                      value = $bonus + 2
                    }
                  }
                }

                conditional {
                  if (($pref_atm|to_lower)|contains:"rooftop") {
                    conditional {
                      if ($input.venue|get:"has_rooftop":false) {
                        var.update $bonus {
                          value = $bonus + 4
                        }
                      }
                    }
                  }
                }

                conditional {
                  if (($pref_atm|to_lower)|contains:"dance") {
                    conditional {
                      if ($input.venue|get:"has_dance_floor":false) {
                        var.update $bonus {
                          value = $bonus + 4
                        }
                      }
                    }
                  }
                }

                conditional {
                  if (($pref_atm|to_lower)|contains:"karaoke") {
                    conditional {
                      if ($input.venue|get:"has_karaoke":false) {
                        var.update $bonus {
                          value = $bonus + 4
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        var $v_occasion {
          value = $input.venue|get:"occasion_tags":[]
        }

        conditional {
          if (($input.social_experiences|count) > 0) {
            foreach ($input.social_experiences) {
              each as $pref_exp {
                conditional {
                  if ($v_occasion != null && ($v_occasion|is_array) && ($v_occasion|json_encode)|contains:$pref_exp) {
                    var.update $bonus {
                      value = $bonus + 2
                    }
                  }
                }

                conditional {
                  if (($pref_exp|to_lower)|contains:"group") {
                    conditional {
                      if ($input.venue|get:"good_for_groups":false) {
                        var.update $bonus {
                          value = $bonus + 3
                        }
                      }
                    }
                  }
                }

                conditional {
                  if (($pref_exp|to_lower)|contains:"date") {
                    conditional {
                      if ($input.venue|get:"good_for_dates":false) {
                        var.update $bonus {
                          value = $bonus + 3
                        }
                      }
                    }
                  }
                }

                conditional {
                  if (($pref_exp|to_lower)|contains:"famil") {
                    conditional {
                      if ($input.venue|get:"family_friendly":false) {
                        var.update $bonus {
                          value = $bonus + 3
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        var $v_price {
          value = $input.venue|get:"price_band":""
        }

        conditional {
          if ($input.social_price_range != null && (($input.social_price_range|trim)|is_empty) == false && $v_price != null && (($v_price|trim)|is_empty) == false) {
            conditional {
              if (($input.social_price_range|to_lower) == ($v_price|to_lower)) {
                var.update $bonus {
                  value = $bonus + 3
                }
              }
            }
          }
        }
      }
    }

    // GEN-013 kill switch: with the switch off, no social-profile bonus is applied.
    conditional {
      if ($use_social_profile_bonus == false) {
        var.update $bonus {
          value = 0
        }
      }
    }
  }

  response = {profile_bonus: $bonus}
}
