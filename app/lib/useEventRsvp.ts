"use client";

import { useCallback, useEffect, useState } from "react";
import { readAuthToken } from "./localState";
import { rsvpToEvent, type RsvpStatus } from "./publicApiClient";

export type UserRsvpStatus = "going" | "interested" | "saved" | null;

/**
 * Optimistic Going/Interested toggle for an event, shared by the in-app
 * event detail screen and the public event microsite.
 *
 * Mirrors the useFollow pattern (HomescreenSection.tsx): update local state
 * first, fire the request, revert on failure. `status` is mutually
 * exclusive between "going" and "interested" — tapping the active one
 * un-RSVPs (sends "removed"); tapping the other switches.
 */
export function useEventRsvp(
  eventId: number | null | undefined,
  initialStatus: UserRsvpStatus,
  initialGoingCount: number,
  initialInterestedCount: number,
  source: string,
  onAuthRequired?: () => void
) {
  const [status, setStatus] = useState<UserRsvpStatus>(initialStatus ?? null);
  const [goingCount, setGoingCount] = useState(initialGoingCount || 0);
  const [interestedCount, setInterestedCount] = useState(initialInterestedCount || 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => setStatus(initialStatus ?? null), [initialStatus]);
  useEffect(() => setGoingCount(initialGoingCount || 0), [initialGoingCount]);
  useEffect(() => setInterestedCount(initialInterestedCount || 0), [initialInterestedCount]);

  const setRsvp = useCallback(
    async (next: "going" | "interested") => {
      if (busy || !eventId) return;
      if (!readAuthToken()) {
        onAuthRequired?.();
        return;
      }

      const prevStatus = status;
      const prevGoing = goingCount;
      const prevInterested = interestedCount;
      const isUnsetting = prevStatus === next;
      const sendStatus: RsvpStatus = isUnsetting ? "removed" : next;

      let nextGoing = prevGoing;
      let nextInterested = prevInterested;
      if (prevStatus === "going") nextGoing = Math.max(0, nextGoing - 1);
      if (prevStatus === "interested") nextInterested = Math.max(0, nextInterested - 1);
      if (!isUnsetting) {
        if (next === "going") nextGoing += 1;
        else nextInterested += 1;
      }

      setStatus(isUnsetting ? null : next);
      setGoingCount(nextGoing);
      setInterestedCount(nextInterested);
      setBusy(true);
      try {
        await rsvpToEvent(eventId, sendStatus, source);
      } catch {
        setStatus(prevStatus);
        setGoingCount(prevGoing);
        setInterestedCount(prevInterested);
      } finally {
        setBusy(false);
      }
    },
    [busy, eventId, status, goingCount, interestedCount, source, onAuthRequired]
  );

  return { status, goingCount, interestedCount, busy, setRsvp };
}
