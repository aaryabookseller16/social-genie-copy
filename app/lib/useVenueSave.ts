"use client";

import { useCallback, useEffect, useState } from "react";
import { readAuthToken } from "./localState";
import { fetchVenueIsSaved, saveVenueForUser, unsaveVenueForUser } from "./publicApiClient";

/**
 * Optimistic save/unsave for a venue, modeled on usePostLike.ts.
 *
 * The venue detail page is server-rendered with no auth context, so
 * `isSaved` is unknown until this fires a second, authenticated fetch on
 * mount.
 */
export function useVenueSave(
  venueId: string | number,
  initialIsSaved = false,
  onAuthRequired?: () => void
) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!readAuthToken()) return;
    let cancelled = false;
    fetchVenueIsSaved(venueId)
      .then((saved) => {
        if (!cancelled) setIsSaved(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  const toggleSave = useCallback(async () => {
    if (busy) return;
    if (!readAuthToken()) {
      onAuthRequired?.();
      return;
    }

    const prevSaved = isSaved;
    setIsSaved(!prevSaved);
    setBusy(true);
    try {
      const numericId = Number(venueId);
      if (prevSaved) {
        await unsaveVenueForUser(numericId);
      } else {
        await saveVenueForUser(numericId, "venue_detail");
      }
    } catch {
      setIsSaved(prevSaved);
      if (!readAuthToken()) onAuthRequired?.();
    } finally {
      setBusy(false);
    }
  }, [busy, isSaved, venueId, onAuthRequired]);

  return { isSaved, busy, toggleSave };
}
