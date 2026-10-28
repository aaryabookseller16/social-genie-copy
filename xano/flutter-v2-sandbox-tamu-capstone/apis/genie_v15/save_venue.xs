// Saves (or, if already saved, unsaves) a venue for a user or guest session.
// User context (2026-10-27): a new save by a signed-in user is a weak taste signal; see the
// block at the end of the stack. Reported in context_sync.
query "genie/save_venue" verb=POST {
  api_group = "genie_v15"

  input {
    // The ID of the venue to save
    int venue_id
  
    // The ID of the user saving the venue
    int user_id?
  
    // The ID of the session saving the venue
    int session_id?
  
    // The screen from which the venue was saved
    text source_screen?
  
    // The search query used when the venue was saved
    text source_query?
  }

  stack {
    // Ensure either user_id or session_id is provided
    precondition ($input.user_id != null || $input.session_id != null) {
      error_type = "inputerror"
      error = "A user_id or session_id is required to save a venue"
    }
  
    // Check if the venue is already saved by this user or session. Matched
    // by user_id alone when present (a logged-in user's identity is stable
    // across sessions, so session_id must not gate this) — same pattern as
    // saved_venues_GET. Falls back to session_id only for guests.
    db.query genie_saved_venues {
      where = $db.genie_saved_venues.venue_id == $input.venue_id && $db.genie_saved_venues.is_deleted == false && (($input.user_id != null && $db.genie_saved_venues.user_id == $input.user_id) || ($input.user_id == null && $db.genie_saved_venues.session_id ==? $input.session_id))
      return = {type: "single"}
    } as $existing_saved_venue
  
    // Toggle: if already saved, unsave it (soft-delete); otherwise save it
    conditional {
      if ($existing_saved_venue != null) {
        db.edit genie_saved_venues {
          field_name = "id"
          field_value = $existing_saved_venue.id
          enforce_hidden_fields = false
          data = {is_deleted: true}
        } as $unsaved_venue
      }
    
      else {
        db.add genie_saved_venues {
          enforce_hidden_fields = false
          data = {
            user_id      : $input.user_id
            session_id   : $input.session_id
            venue_id     : $input.venue_id
            saved_at     : now
            source_screen: $input.source_screen
            source_query : $input.source_query
            is_deleted   : false
          }
        } as $new_saved_venue
      }
    }
    // User context (2026-10-27, added without changing existing lines): a new save by a
    // signed-in user adds the venue's cuisines and price as weak learned preferences
    // (fn_genie_context_from_venue_save_dev). Unsaves and guest saves change nothing.
    var $context_sync {
      value = null
    }

    conditional {
      if ($existing_saved_venue == null && ($input.user_id ?? 0) > 0) {
        function.run "genie/fn_genie_context_from_venue_save_dev" {
          input = {venue_id: $input.venue_id, user_id: $input.user_id}
        } as $context_sync
      }
    }
  }

  response = {
    saved   : ($existing_saved_venue == null)
    venue_id: $input.venue_id
    context_sync: $context_sync
  }
}