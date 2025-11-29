// app/lib/analytics.ts
// Centralized Genie analytics for Phase 1
// In Phase 1, all analytics are logged locally.
// In Phase 2, we'll wire sendToBackend() to Xano.

export type EventPayload = {
  type: string;
  timestamp: string;
  userId?: string;           // optional (added in Phase 2)
  sessionId?: string;        // optional (Phase 2)
  city?: string;             // optional (Phase 2)
  country?: string;          // optional (Phase 2)
  data?: Record<string, any>;
};

// -------------------------------------------------------------
// Phase 1 backend function — just logs to console.
// Later this becomes an API POST → Xano.
// -------------------------------------------------------------
async function sendToBackend(payload: EventPayload) {
  console.log("[Genie Analytics]", payload);
}

// -------------------------------------------------------------
// 1) When the user submits a search query
// -------------------------------------------------------------
export function trackQuery(query: string) {
  return sendToBackend({
    type: "query",
    timestamp: new Date().toISOString(),
    data: { query },
  });
}

// -------------------------------------------------------------
// 2) When the user taps a venue card from the results
// -------------------------------------------------------------
export function trackVenueClick(venueId: string, query: string) {
  return sendToBackend({
    type: "venue_click",
    timestamp: new Date().toISOString(),
    data: { venueId, query },
  });
}

// -------------------------------------------------------------
// 3) When the user views a venue detail screen
// -------------------------------------------------------------
export function trackVenueView(venueId: string) {
  return sendToBackend({
    type: "venue_view",
    timestamp: new Date().toISOString(),
    data: { venueId },
  });
}

// -------------------------------------------------------------
// 4) When the user shares a venue
// -------------------------------------------------------------
export function trackShare(venueId: string) {
  return sendToBackend({
    type: "share",
    timestamp: new Date().toISOString(),
    data: { venueId },
  });
}

// -------------------------------------------------------------
// 5) When the user saves a venue
// -------------------------------------------------------------
export function trackSave(venueId: string) {
  return sendToBackend({
    type: "save",
    timestamp: new Date().toISOString(),
    data: { venueId },
  });
}

// -------------------------------------------------------------
// 6) When the user joins the Weekly Picks list
// -------------------------------------------------------------
export function trackWeeklySignup(contact: string) {
  return sendToBackend({
    type: "weekly_signup",
    timestamp: new Date().toISOString(),
    data: { contact }, // email or phone
  });
}

