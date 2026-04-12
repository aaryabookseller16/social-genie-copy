"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AccountSection,
  type AccountScreenMode,
} from "@/app/components/single-page/AccountSection";
import { DrawerMenu } from "@/app/components/single-page/DrawerMenu";
import { VendorSection } from "@/app/components/single-page/VendorSection";
import {
  BottomDock,
  GenieBubble,
  ResultCard,
  SectionShell,
  TagPill,
  type FlowAnchor,
  buildVenueTags,
} from "@/app/components/single-page/ui";
import { HomeScreen } from "@/app/components/discovery/HomeScreen";
import { GenieOrb } from "@/app/components/shared/GenieOrb";
import { requestPushPermission } from "@/app/components/shared/NotificationsBoot";
import {
  trackEvent,
  trackHomeScreenViewed,
  trackQuickChipTapped,
  trackSave,
  trackShare,
  trackTypedQueryStarted,
  trackVenueClick,
  trackVoiceOrbTapped,
} from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import {
  callGenie,
  type GenieResponseEnvelope,
  type GenieVenue,
} from "@/app/lib/genieClient";
import {
  readAuthToken,
  readConsumerAccount,
  type ConsumerAccount,
} from "@/app/lib/localState";
import {
  type SocialProfile,
  type VibeeOffer,
  type VibeeRedemption,
  clearStoredSession,
  convertGuestSession,
  fetchSocialProfile,
  fetchUserRedemptions,
  fetchVibeeOffers,
  fetchCurrentUser,
  fetchSavedVenues,
  fetchSubscriptionStatus,
  fetchSubscriptionStatusForSession,
  initGuestSession,
  initDeviceProfile,
  loginWithMagicToken,
  logVendorInteraction,
  markNotificationOpened,
  mergeGuestProfile,
  persistAuthSession,
  registerPushToken,
  redeemVibeeOffer,
  saveVenueForUser,
  syncSavedVenueIds,
  trackSocialSignal,
  toConsumerAccount,
  updateSocialProfile,
  unsaveVenueForUser,
} from "@/app/lib/publicApiClient";
import { getRuntimeConfig } from "@/app/lib/runtimeConfig";
import {
  readSignupPromptState,
  shouldSuppressSignupPrompt,
  writeSignupPromptState,
  type SignupPromptTriggerReason,
} from "@/app/lib/signupPrompt";
import {
  readExternalUserId,
  readSessionId,
  writeExternalUserId,
} from "@/app/lib/sessionToken";

type SpeechRecognitionResultShape = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorShape = {
  error: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultShape) => void) | null;
  onerror: ((event: SpeechRecognitionErrorShape) => void) | null;
  start: () => void;
  stop?: () => void;
  abort?: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function getVenueId(venue: GenieVenue) {
  return String(venue.id);
}

function getVenueDistance(venue: GenieVenue, index: number) {
  if (venue.latitude && venue.longitude) {
    return `${(0.5 + index * 0.7).toFixed(1)} mi`;
  }

  return `${(0.8 + index * 0.9).toFixed(1)} mi`;
}

function getVenueHeadline(venue: GenieVenue) {
  const parts = [venue.area_neighborhood, venue.city].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Houston";
}

function getVenueDescription(venue: GenieVenue) {
  return (
    venue.vibe_notes ??
    "Genie thinks this spot matches your vibe for tonight."
  );
}

function getVenueStatus(venue: GenieVenue, index: number) {
  if (venue.is_open_now) {
    return "Open now";
  }

  if (venue.best_time_to_go) {
    return venue.best_time_to_go;
  }

  const fallbacks = ["Busy right now", "Good time to go", "Picks up after 9p"];
  return fallbacks[index % fallbacks.length];
}

function buildNativeMapsUrl(venue: GenieVenue) {
  if (venue.google_maps_url?.trim()) {
    return venue.google_maps_url.trim();
  }

  const latitude = venue.latitude != null ? String(venue.latitude).trim() : undefined;
  const longitude = venue.longitude != null ? String(venue.longitude).trim() : undefined;
  if (latitude && longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }

  const query =
    venue.address?.trim() ||
    [venue.venue_name, venue.city].filter(Boolean).join(", ");
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

function buildStaticMapUrl(venue: GenieVenue) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const latitude = venue.latitude != null ? String(venue.latitude).trim() : undefined;
  const longitude = venue.longitude != null ? String(venue.longitude).trim() : undefined;
  const location =
    latitude && longitude
      ? `${latitude},${longitude}`
      : venue.address?.trim() ||
        [venue.venue_name, venue.city].filter(Boolean).join(", ");

  if (!location) {
    return null;
  }

  const encodedLocation = encodeURIComponent(location);
  return `https://maps.googleapis.com/maps/api/staticmap?center=${encodedLocation}&zoom=15&size=1200x720&scale=2&markers=color:0xff4f4f%7C${encodedLocation}&key=${apiKey}`;
}

const socialTagOptions = {
  experiences_tags: ["Brunch", "Happy Hour", "Day Party", "Dinner", "Late Night"],
  atmosphere_tags: ["Rooftop", "Patio", "Live DJ", "Lounge", "Sports Bar"],
  bevy_bites_tags: ["Soul Food", "Seafood", "Signature Cocktails", "Tacos", "Wine"],
  community_tags: ["Black-Owned", "LGBTQ+ Friendly", "Free Parking", "Date Night"],
  music_tags: ["R&B / Soul", "Hip-Hop / Rap", "AfroBeats", "House", "Top 40"],
} as const;

const socialPreferenceOptions = {
  price_range: ["Budget-Friendly", "Mid-Range", "Upscale", "Luxury"],
  group_size: ["solo", "couple", "small_group", "large_group"],
  typical_time: ["afternoon", "evening", "late_night", "weekend_brunch"],
} as const;

function buildQrImageUrl(value: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    value
  )}`;
}

function formatTimestamp(value?: number | null) {
  if (!value || !Number.isFinite(value)) {
    return "Unknown time";
  }

  const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Date(timestamp).toLocaleString();
}

type SinglePageGenieAppProps = {
  initialScreen?: FlowAnchor;
  initialVenueId?: string | null;
};

export function SinglePageGenieApp({
  initialScreen = "home",
  initialVenueId = null,
}: SinglePageGenieAppProps = {}) {
  const config = getRuntimeConfig();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const hasTrackedTypingRef = useRef(false);
  const decisionImpressionResponseRef = useRef<GenieResponseEnvelope | null>(
    null
  );
  const moreNearbyImpressionResponseRef =
    useRef<GenieResponseEnvelope | null>(null);
  const screenHistoryRef = useRef<FlowAnchor[]>([]);
  const homeRef = useRef<HTMLElement | null>(null);
  const listeningRef = useRef<HTMLElement | null>(null);
  const thinkingRef = useRef<HTMLElement | null>(null);
  const decisionRef = useRef<HTMLElement | null>(null);
  const moreRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  const savedRef = useRef<HTMLElement | null>(null);
  const offersRef = useRef<HTMLElement | null>(null);
  const preferencesRef = useRef<HTMLElement | null>(null);
  const accountRef = useRef<HTMLElement | null>(null);
  const vendorRef = useRef<HTMLElement | null>(null);
  const [activeScreen, setActiveScreen] = useState<FlowAnchor>(initialScreen);
  const [detailReturnScreen, setDetailReturnScreen] = useState<
    "decision" | "more" | "saved"
  >("decision");
  const [inputValue, setInputValue] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<GenieResponseEnvelope | null>(null);
  const [savedVenueIds, setSavedVenueIds] = useState<string[]>([]);
  const [savedVenues, setSavedVenues] = useState<GenieVenue[]>([]);
  const [offers, setOffers] = useState<VibeeOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<VibeeRedemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [activeRedemption, setActiveRedemption] = useState<{
    offer_id: number;
    offer_title: string;
    verify_url: string;
    redeemed_at: number;
    redemption_token: string;
  } | null>(null);
  const [redeemingOfferId, setRedeemingOfferId] = useState<number | null>(null);
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialSaving, setSocialSaving] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(
    initialVenueId ? String(initialVenueId) : null
  );
  const [account, setAccount] = useState<ConsumerAccount | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [mapPreviewFailed, setMapPreviewFailed] = useState(false);
  const [accountScreenMode, setAccountScreenMode] =
    useState<AccountScreenMode>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [queryCount, setQueryCount] = useState(0);
  const [browseCount, setBrowseCount] = useState(0);
  const [hasOpenedMoreNearby, setHasOpenedMoreNearby] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const hasPromptedForPushRef = useRef(false);
  const offersLoadedRef = useRef(false);
  const profileLoadedRef = useRef(false);
  const resultVenues = useMemo(
    () => (response ? [...response.decisive, ...response.more_nearby] : []),
    [response]
  );

  const venueMap = useMemo(() => {
    const entries: [string, GenieVenue][] = [...savedVenues, ...resultVenues].map(
      (venue) => [getVenueId(venue), venue]
    );
    return new Map<string, GenieVenue>(entries);
  }, [resultVenues, savedVenues]);

  const selectedVenue = useMemo<GenieVenue | null>(() => {
    if (!selectedVenueId) {
      return null;
    }

    return venueMap.get(selectedVenueId) ?? null;
  }, [selectedVenueId, venueMap]);

  const stopListeningSession = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition?.abort) {
      recognition.abort();
    } else if (recognition?.stop) {
      recognition.stop();
    }
    recognitionRef.current = null;
  }, []);

  const goHome = useCallback(() => {
    screenHistoryRef.current = [];
    stopListeningSession();
    setIsDrawerOpen(false);
    setActiveScreen("home");
  }, [stopListeningSession]);

  const navigateTo = useCallback(
    (screen: FlowAnchor, pushCurrent = true) => {
      setIsDrawerOpen(false);
      setActiveScreen((previous) => {
        if (previous === screen) {
          return previous;
        }

        if (pushCurrent) {
          screenHistoryRef.current.push(previous);
        }

        return screen;
      });
    },
    []
  );

  const goBack = useCallback(
    (fallback: FlowAnchor = "home") => {
      stopListeningSession();
      setIsDrawerOpen(false);
      const previous = screenHistoryRef.current.pop() ?? fallback;
      setActiveScreen(previous);
    },
    [stopListeningSession]
  );

  const maybeTriggerSignup = useCallback(
    (reason: SignupPromptTriggerReason) => {
      if (account || activeScreen === "account") {
        return;
      }

      if (shouldSuppressSignupPrompt(config.signupPromptSuppressAfter)) {
        return;
      }

      const previous = readSignupPromptState();
      writeSignupPromptState({
        dismissCount: previous.dismissCount,
        lastTriggerReason: reason,
        lastShownAt: Date.now(),
      });
      trackEvent(analyticsEvents.signupPromptShown, { reason });
      trackEvent(analyticsEvents.signupPromptTriggered, { reason });
      navigateTo("account");
    },
    [account, activeScreen, config.signupPromptSuppressAfter, navigateTo]
  );

  const hydrateAuthenticatedSession = useCallback(async () => {
    const token = readAuthToken();
    if (!token) {
      offersLoadedRef.current = false;
      profileLoadedRef.current = false;
      setAccount(null);
      setSavedVenueIds([]);
      setSavedVenues([]);
      setOffers([]);
      setRedemptions([]);
      setActiveRedemption(null);
      setSocialProfile(null);
      setIsAuthChecked(true);
      return;
    }

    try {
      const [{ user }, { status }, venues] = await Promise.all([
        fetchCurrentUser(),
        fetchSubscriptionStatus(),
        fetchSavedVenues(),
      ]);

      const nextAccount = toConsumerAccount(user, status);
      setAccount(nextAccount);
      setSavedVenues(venues);
      setSavedVenueIds(syncSavedVenueIds(venues));
      setIsAuthChecked(true);
    } catch (error) {
      console.error("Failed to hydrate authenticated session", error);

      // Only clear the saved session when the server explicitly rejects the
      // token (401). Other failures (500, network errors, Xano catalog
      // unreachable) should NOT nuke the auth token — the user is still
      // legitimately signed in.
      const isAuthError =
        error instanceof Error &&
        (error.message.includes("401") ||
          error.message.toLowerCase().includes("unauthorized"));

      if (isAuthError) {
        offersLoadedRef.current = false;
        profileLoadedRef.current = false;
        clearStoredSession();
        setAccount(null);
        setSavedVenueIds([]);
        setSavedVenues([]);
        setOffers([]);
        setRedemptions([]);
        setActiveRedemption(null);
        setSocialProfile(null);
      }

      setIsAuthChecked(true);
    }
  }, []);

  const initializeDeviceProfile = useCallback(async () => {
    const externalUserId = readExternalUserId() || undefined;
    const sessionId = readSessionId();
    await initDeviceProfile({
      external_user_id: externalUserId,
      session_id: sessionId ? String(sessionId) : undefined,
    }).catch(() => {});
  }, []);

  const loadOffersAndRedemptions = useCallback(async () => {
    if (offersLoadedRef.current || !account || account.membership !== "vibee") {
      return;
    }

    setOffersLoading(true);
    setRedemptionsLoading(true);
    setOffersError(null);
    try {
      const [offersResponse, redemptionsResponse] = await Promise.all([
        fetchVibeeOffers(),
        fetchUserRedemptions(),
      ]);
      setOffers(offersResponse.offers ?? []);
      setRedemptions(redemptionsResponse.redemptions ?? []);
      offersLoadedRef.current = true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load V.I.Bee offers.";
      setOffersError(message);
    } finally {
      setOffersLoading(false);
      setRedemptionsLoading(false);
    }
  }, [account]);

  const loadSocialPreferences = useCallback(async () => {
    if (profileLoadedRef.current) {
      return;
    }

    setSocialLoading(true);
    try {
      const profile = await fetchSocialProfile();
      setSocialProfile(profile);
      profileLoadedRef.current = true;
    } catch {
      setSocialProfile(null);
    } finally {
      setSocialLoading(false);
    }
  }, []);

  const handleQuery = async (
    query: string,
    source: "typed" | "chip" | "voice"
  ) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    screenHistoryRef.current = ["home"];
    setActiveScreen("thinking");
    setLastQuery(trimmed);
    setStatusMessage(null);
    setResponse(null);
    setSelectedVenueId(null);
    setHasOpenedMoreNearby(false);
    setIsThinking(true);

    if (source === "typed") {
      trackEvent(analyticsEvents.typedQuerySubmitted, { query: trimmed });
    }

    if (source === "voice") {
      trackEvent(analyticsEvents.voiceTranscriptCaptured, { query: trimmed });
    }

    trackEvent(analyticsEvents.searchSubmitted, { query: trimmed, source });
    trackEvent(analyticsEvents.genieQuerySubmitted, { query: trimmed, source });
    trackEvent(analyticsEvents.genieQueryProcessingStarted, { source });
    void trackSocialSignal({
      signal_type: "query",
      signal_value: trimmed,
      city: config.cityLabel,
    }).catch(() => {});

    try {
      const nextResponse = await callGenie(trimmed);
      setResponse(nextResponse);
      trackEvent(analyticsEvents.normalizedIntentReceived, {
        normalizedIntent: nextResponse.normalized_intent,
        responseMode: nextResponse.response_mode,
      });

      if (nextResponse.response_mode === "structured_results") {
        const firstVenue =
          nextResponse.decisive[0] ?? nextResponse.more_nearby[0] ?? null;
        if (firstVenue) {
          setSelectedVenueId(getVenueId(firstVenue));
        }

        setQueryCount((previous) => previous + 1);
        trackEvent(analyticsEvents.genieResultsReturned, {
          decisiveCount: nextResponse.decisive.length,
          moreNearbyCount: nextResponse.more_nearby.length,
        });
        setActiveScreen("decision");
      } else {
        setStatusMessage(nextResponse.reply);
        setActiveScreen("thinking");
      }
    } catch (error) {
      console.error("Failed to query Genie", error);
      setStatusMessage("Genie had a hiccup. Try that again in a moment.");
      trackEvent(analyticsEvents.processingError, { source });
      setActiveScreen("thinking");
    } finally {
      setIsThinking(false);
    }
  };

  const startListening = () => {
    trackVoiceOrbTapped();
    navigateTo("listening");
    setStatusMessage(null);

    const voiceWindow = window as Window &
      typeof globalThis & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };

    const SpeechRecognitionCtor =
      voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setStatusMessage("Voice input is not available here yet. Type your vibe below.");
      trackEvent(analyticsEvents.voicePermissionDenied, {
        reason: "browser_unsupported",
      });
      goHome();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    trackEvent(analyticsEvents.voiceListeningStarted);

    recognition.onresult = (event: SpeechRecognitionResultShape) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) {
        return;
      }

      recognitionRef.current = null;
      setInputValue(transcript);
      void handleQuery(transcript, "voice");
    };

    recognition.onerror = (event: SpeechRecognitionErrorShape) => {
      recognitionRef.current = null;
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        trackEvent(analyticsEvents.voicePermissionDenied, {
          reason: event.error,
        });
        setStatusMessage("Microphone access was blocked. You can still type your vibe.");
      } else {
        trackEvent(analyticsEvents.voiceListeningCancelled, {
          reason: event.error,
        });
        setStatusMessage("I couldn't catch that. Try speaking again or type instead.");
      }
      goHome();
    };

    recognition.start();
  };

  const selectVenue = (
    venue: GenieVenue,
    index: number,
    source: "decision" | "more" | "saved"
  ) => {
    setSelectedVenueId(getVenueId(venue));
    setDetailReturnScreen(source);
    setBrowseCount((previous) => previous + 1);
    if (source === "more") {
      setHasOpenedMoreNearby(true);
      trackEvent(analyticsEvents.moreNearbyCardTapped, {
        venueId: getVenueId(venue),
        venueName: venue.venue_name,
        position: index + 1,
        queryText: response?.normalized_intent ?? lastQuery,
      });
      void trackSocialSignal({
        signal_type: "more_nearby_tap",
        signal_value: getVenueId(venue),
        city: venue.city ?? config.cityLabel,
        neighborhood: venue.area_neighborhood ?? undefined,
      }).catch(() => {});
    }
    void trackSocialSignal({
      signal_type: "venue_tap",
      signal_value: getVenueId(venue),
      city: venue.city ?? config.cityLabel,
      neighborhood: venue.area_neighborhood ?? undefined,
      category_tags: buildVenueTags(venue),
    }).catch(() => {});
    trackEvent(analyticsEvents.venueClick, {
      venueId: getVenueId(venue),
      source,
    });
    trackEvent(analyticsEvents.vendorDetailOpened, {
      venueId: getVenueId(venue),
      source,
    });
    trackVenueClick({
      venueId: getVenueId(venue),
      venueName: venue.venue_name,
      position: index + 1,
      source,
      city: venue.city ?? "",
      queryText: response?.normalized_intent ?? lastQuery,
    });
    logVendorInteraction("profile_view", Number(venue.id));
    navigateTo("detail");
    if (!account) {
      window.setTimeout(() => maybeTriggerSignup("venue_tap"), 260);
    }
  };

  const handleSaveVenue = async (venue: GenieVenue) => {
    let token = readAuthToken();

    if (!account || !token) {
      trackEvent(analyticsEvents.saveClick, {
        venueId: getVenueId(venue),
        source: activeScreen,
      });
      maybeTriggerSignup("save_attempt");
      return;
    }

    if (!isAuthChecked) {
      await hydrateAuthenticatedSession();
      token = readAuthToken();
      if (!token) {
        trackEvent(analyticsEvents.saveClick, {
          venueId: getVenueId(venue),
          source: activeScreen,
        });
        maybeTriggerSignup("save_attempt");
        return;
      }
    }

    const venueId = Number(venue.id);
    const id = getVenueId(venue);
    const isSaved = savedVenueIds.includes(id);

    try {
      if (isSaved) {
        await unsaveVenueForUser(venueId);
        const nextVenues = savedVenues.filter(
          (savedVenue) => getVenueId(savedVenue) !== id
        );
        setSavedVenues(nextVenues);
        setSavedVenueIds(syncSavedVenueIds(nextVenues));
      } else {
        await saveVenueForUser(venueId);
        const nextVenues = [venue, ...savedVenues].filter(
          (entry, index, array) =>
            array.findIndex((candidate) => getVenueId(candidate) === getVenueId(entry)) ===
            index
        );
        setSavedVenues(nextVenues);
        setSavedVenueIds(syncSavedVenueIds(nextVenues));
        trackEvent(analyticsEvents.saveClick, {
          venueId: id,
          source: activeScreen,
        });
        void trackSocialSignal({
          signal_type: "venue_save",
          signal_value: id,
          city: venue.city ?? config.cityLabel,
          neighborhood: venue.area_neighborhood ?? undefined,
          category_tags: buildVenueTags(venue),
        }).catch(() => {});
        trackSave(id);
      }
    } catch (error) {
      console.error("Failed to update saved venue", error);
      const errorMessage =
        error instanceof Error ? error.message : "Could not update your saved spots right now.";

      // apiJson already clears the session on a genuine 401 response.
      // Only react to auth-specific failures here — don't redundantly
      // nuke the token for network errors or 500s.
      const isAuthError =
        errorMessage.includes("401") ||
        errorMessage.toLowerCase() === "unauthorized";

      if (isAuthError) {
        setAccount(null);
        setSavedVenueIds([]);
        setSavedVenues([]);
        setStatusMessage("Your session expired. Log in again to save places.");
        maybeTriggerSignup("save_attempt");
        return;
      }

      setStatusMessage("Could not update your saved spots right now.");
    }
  };

  const handleShareVenue = async (venue: GenieVenue) => {
    const text = `${venue.venue_name} - ${venue.address ?? venue.area_neighborhood ?? "Houston"}`;
    const url =
      venue.google_maps_url ||
      venue.website_url ||
      `https://genie.socialbevy.com/#venue-${getVenueId(venue)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: venue.venue_name,
          text,
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
      }
    } catch (error) {
      console.error("Share failed", error);
    }

    trackShare(getVenueId(venue));
  };

  const handleRedeemOffer = useCallback(
    async (offer: VibeeOffer) => {
      if (!account || account.membership !== "vibee") {
        setStatusMessage("Upgrade to V.I.Bee to redeem offers.");
        navigateTo("account");
        return;
      }

      setRedeemingOfferId(offer.id);
      setStatusMessage(null);

      try {
        const redemption = await redeemVibeeOffer(offer.id);
        setActiveRedemption({
          offer_id: offer.id,
          offer_title: redemption.offer_title,
          verify_url: redemption.verify_url,
          redeemed_at: redemption.redeemed_at,
          redemption_token: redemption.redemption_token,
        });

        void trackSocialSignal({
          signal_type: "offer_redeem",
          signal_value: String(offer.id),
          city: config.cityLabel,
        }).catch(() => {});

        const refreshed = await fetchUserRedemptions().catch(() => null);
        if (refreshed?.redemptions) {
          setRedemptions(refreshed.redemptions);
        }

        setStatusMessage("Offer redeemed. Show this QR code at the venue.");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not redeem this offer right now.";
        setStatusMessage(message);
      } finally {
        setRedeemingOfferId(null);
      }
    },
    [account, config.cityLabel, navigateTo]
  );

  const toggleSocialTag = useCallback(
    (field: keyof typeof socialTagOptions, value: string) => {
      setSocialProfile((previous) => {
        const currentProfile: SocialProfile = previous ?? {};
        const raw = currentProfile[field];
        const selected: string[] = Array.isArray(raw) ? raw : [];
        const next = selected.includes(value)
          ? selected.filter((entry) => entry !== value)
          : [...selected, value];

        return {
          ...currentProfile,
          [field]: next,
        };
      });
    },
    []
  );

  const selectSocialPreference = useCallback(
    (field: keyof typeof socialPreferenceOptions, value: string) => {
      setSocialProfile((previous) => ({
        ...(previous ?? {}),
        [field]: value,
      }));
    },
    []
  );

  const handleSaveSocialProfile = useCallback(async () => {
    const draft: SocialProfile = socialProfile ?? {};
    setSocialSaving(true);
    setStatusMessage(null);

    try {
      const updated = await updateSocialProfile({
        experiences_tags: draft.experiences_tags ?? [],
        atmosphere_tags: draft.atmosphere_tags ?? [],
        bevy_bites_tags: draft.bevy_bites_tags ?? [],
        community_tags: draft.community_tags ?? [],
        music_tags: draft.music_tags ?? [],
        price_range: draft.price_range ?? undefined,
        group_size: draft.group_size ?? undefined,
        typical_time: draft.typical_time ?? undefined,
      });

      setSocialProfile(updated);
      profileLoadedRef.current = true;
      setStatusMessage("Preferences saved. Genie will use these on your next ask.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save preferences right now.";
      setStatusMessage(message);
    } finally {
      setSocialSaving(false);
    }
  }, [socialProfile]);

  useEffect(() => {
    trackHomeScreenViewed();
    setAccount(readConsumerAccount());
    void (async () => {
      const url = new URL(window.location.href);
      const magicToken = url.searchParams.get("token");

      if (magicToken) {
        try {
          const previousExternalUserId = readExternalUserId();
          const {
            token: authToken,
            user,
            external_user_id,
          } = await loginWithMagicToken(magicToken);

          persistAuthSession(authToken, user);
          if (external_user_id) {
            writeExternalUserId(external_user_id);
          }

          // Preserve the latest documented behavior: remove the token from the URL
          // immediately after a successful exchange.
          url.searchParams.delete("token");
          window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

          if (
            previousExternalUserId &&
            external_user_id &&
            previousExternalUserId !== external_user_id
          ) {
            await convertGuestSession(external_user_id).catch(() => {});
          }

          if (external_user_id) {
            offersLoadedRef.current = false;
            profileLoadedRef.current = false;
            await mergeGuestProfile(external_user_id).catch(() => {});
          }
        } catch (error) {
          console.error("Failed to exchange magic token", error);
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "This sign-in link could not be verified."
          );
          url.searchParams.delete("token");
          window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        }
      }

      await hydrateAuthenticatedSession();
      await initGuestSession().catch(() => null);
      await initializeDeviceProfile();
    })();
  }, [hydrateAuthenticatedSession, initializeDeviceProfile]);

  useEffect(() => {
    if (activeScreen === "offers") {
      void loadOffersAndRedemptions();
    }
  }, [activeScreen, loadOffersAndRedemptions]);

  useEffect(() => {
    if (activeScreen === "preferences") {
      void loadSocialPreferences();
    }
  }, [activeScreen, loadSocialPreferences]);

  useEffect(() => {
    if (activeScreen !== "offers" || !account || account.membership !== "vibee") {
      return;
    }

    void trackSocialSignal({
      signal_type: "offer_view",
      signal_value: "offers_screen",
      city: config.cityLabel,
    }).catch(() => {});
  }, [activeScreen, account, config.cityLabel]);

  useEffect(() => {
    setMapPreviewFailed(false);
  }, [selectedVenueId]);

  useEffect(() => {
    if (
      activeScreen !== "detail" ||
      !selectedVenueId ||
      selectedVenue ||
      !isAuthChecked
    ) {
      return;
    }

    setStatusMessage("That venue was not found. Try searching again.");
    setActiveScreen("home");
  }, [activeScreen, isAuthChecked, selectedVenue, selectedVenueId]);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    setIsStandalone(media.matches);

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const checkoutState = url.searchParams.get("checkout");
    const sessionId = url.searchParams.get("session_id");
    if (!checkoutState && !sessionId) {
      return;
    }

    const clearCheckoutParams = () => {
      url.searchParams.delete("checkout");
      url.searchParams.delete("session_id");
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", nextUrl);
    };

    if (checkoutState === "cancel") {
      trackEvent(analyticsEvents.vibeeCheckoutCancelled, {
        sessionId: sessionId ?? undefined,
      });
      setStatusMessage("Checkout was cancelled. You can try again any time.");
      clearCheckoutParams();
      return;
    }

    if (checkoutState !== "success" && !sessionId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        if (!readAuthToken()) {
          return;
        }

        const subscription = sessionId
          ? await fetchSubscriptionStatusForSession(sessionId)
          : await fetchSubscriptionStatus();

        if (cancelled) {
          return;
        }

        if (subscription.status === "active") {
          setStatusMessage("Your V.I.Bee membership is active.");
          trackEvent(analyticsEvents.vibeeCheckoutCompleted, {
            sessionId: sessionId ?? undefined,
          });
        } else {
          setStatusMessage(
            "Checkout completed. Your membership is still syncing."
          );
        }

        await hydrateAuthenticatedSession();
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to confirm checkout status", error);
        setStatusMessage(
          "We could not confirm your checkout yet. Pull to refresh shortly."
        );
      } finally {
        if (!cancelled) {
          clearCheckoutParams();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateAuthenticatedSession]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const notificationId = url.searchParams.get("notification_id");
    if (!notificationId) {
      return;
    }

    const parsed = Number(notificationId);
    if (Number.isFinite(parsed)) {
      void markNotificationOpened(parsed).catch(() => {});
    }

    url.searchParams.delete("notification_id");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (queryCount >= 2) {
      maybeTriggerSignup("second_query");
    }
  }, [maybeTriggerSignup, queryCount]);

  useEffect(() => {
    if (browseCount >= 2) {
      maybeTriggerSignup("repeated_browse");
    }
  }, [browseCount, maybeTriggerSignup]);

  useEffect(() => {
    if (!response || response.response_mode !== "structured_results") {
      return;
    }

    if (decisionImpressionResponseRef.current === response) {
      return;
    }

    decisionImpressionResponseRef.current = response;
    response.decisive.forEach((venue, index) => {
      trackEvent(analyticsEvents.resultImpression, {
        venueId: getVenueId(venue),
        position: index + 1,
        section: "decision",
      });
      trackEvent(analyticsEvents.genieResultImpression, {
        venueId: getVenueId(venue),
        venueName: venue.venue_name,
        position: index + 1,
        section: "decision",
        queryText: response.normalized_intent,
      });
    });

    if (!hasPromptedForPushRef.current) {
      hasPromptedForPushRef.current = true;
      void (async () => {
        const playerId = await requestPushPermission();
        if (!playerId) {
          return;
        }

        await registerPushToken(playerId).catch((error) => {
          console.error("Failed to register push token", error);
        });
      })();
    }
  }, [response]);

  useEffect(() => {
    if (
      !response ||
      response.response_mode !== "structured_results" ||
      !hasOpenedMoreNearby
    ) {
      return;
    }

    if (moreNearbyImpressionResponseRef.current === response) {
      return;
    }

    moreNearbyImpressionResponseRef.current = response;
    trackEvent(analyticsEvents.moreNearbyScreenViewed, {
      count: response.more_nearby.length,
      queryText: response.normalized_intent,
    });
    response.more_nearby.forEach((venue, index) => {
      trackEvent(analyticsEvents.resultImpression, {
        venueId: getVenueId(venue),
        position: index + 1,
        section: "more_nearby",
      });
      trackEvent(analyticsEvents.moreNearbyCardImpression, {
        venueId: getVenueId(venue),
        venueName: venue.venue_name,
        position: index + 1,
        section: "more_nearby",
        queryText: response.normalized_intent,
      });
    });
  }, [hasOpenedMoreNearby, response]);

  const currentResponseMode = response?.response_mode;
  const showResultSections = currentResponseMode === "structured_results";
  const nonStructuredResponse =
    response && response.response_mode !== "structured_results"
      ? response
      : null;
  const socialProfileDraft: SocialProfile = socialProfile ?? {};
  const socialTagLabels: Record<keyof typeof socialTagOptions, string> = {
    experiences_tags: "Favorite Experiences",
    atmosphere_tags: "Atmosphere",
    bevy_bites_tags: "Food + Drink",
    community_tags: "Community",
    music_tags: "Music",
  };
  const socialPreferenceLabels: Record<
    keyof typeof socialPreferenceOptions,
    string
  > = {
    price_range: "Price Range",
    group_size: "Typical Group Size",
    typical_time: "Usual Going-Out Time",
  };
  const intakePromptCopy =
    response?.intake_prompt_copy?.trim() ||
    "Help Genie learn your vibe so recommendations get more personal.";
  const mapPreviewUrl = selectedVenue ? buildStaticMapUrl(selectedVenue) : null;
  const nativeMapsUrl = selectedVenue ? buildNativeMapsUrl(selectedVenue) : null;
  const detailActions: Array<{
    id: string;
    label: string;
    variant: "primary" | "secondary";
    onClick: () => void;
  }> = selectedVenue
    ? [
        ...(selectedVenue.phone
          ? [
              {
                id: "call",
                label: "📞 Call",
                variant: "secondary" as const,
                onClick: () => {
                  trackEvent(analyticsEvents.callClick, {
                    venueId: getVenueId(selectedVenue),
                  });
                  trackEvent(analyticsEvents.vendorCallTap, {
                    venueId: getVenueId(selectedVenue),
                  });
                  logVendorInteraction("call_click", Number(selectedVenue.id));
                  window.open(
                    `tel:${selectedVenue.phone}`,
                    "_self"
                  );
                },
              },
            ]
          : []),
        ...(selectedVenue.reservation_url
          ? [
              {
                id: "reservations",
                label: "📋 Reservations",
                variant: "secondary" as const,
                onClick: () => {
                  trackEvent(analyticsEvents.reserveClick, {
                    venueId: getVenueId(selectedVenue),
                    platform: selectedVenue.reservation_platform ?? undefined,
                  });
                  trackEvent(analyticsEvents.vendorReservationTap, {
                    venueId: getVenueId(selectedVenue),
                  });
                  logVendorInteraction("reservation_click", Number(selectedVenue.id));
                  window.open(
                    selectedVenue.reservation_url!,
                    "_blank",
                    "noopener,noreferrer"
                  );
                },
              },
            ]
          : []),
        {
          id: "share",
          label: "↗ Share",
          variant: "secondary",
          onClick: () => {
            trackEvent(analyticsEvents.vendorShareTap, {
              venueId: getVenueId(selectedVenue),
            });
            logVendorInteraction("share", Number(selectedVenue.id));
            void handleShareVenue(selectedVenue);
          },
        },
      ]
    : [];

  const dismissAccount = useCallback(() => {
    if (!account) {
      const previous = readSignupPromptState();
      writeSignupPromptState({
        dismissCount: previous.dismissCount + 1,
        lastTriggerReason: previous.lastTriggerReason,
        lastShownAt: Date.now(),
      });
      trackEvent(analyticsEvents.signupDismissed, {
        reason: previous.lastTriggerReason,
      });
    }

    goBack("home");
  }, [account, goBack]);

  const isVibeeMember = account?.membership === "vibee";

  const handleDrawerNavigate = useCallback(
    (
      target:
        | "home"
        | "account"
        | "saved"
        | "offers"
        | "membership"
        | "vendor"
        | "how-it-works"
        | "contact"
        | "terms"
    ) => {
      switch (target) {
        case "home":
          goHome();
          break;
        case "account":
          navigateTo("account");
          break;
        case "offers":
          navigateTo("offers");
          break;
        case "membership":
          if (isVibeeMember) {
            navigateTo("offers");
          } else {
            navigateTo("account");
          }
          break;
        case "saved":
          navigateTo("saved");
          break;
        case "vendor":
          navigateTo("vendor");
          break;
        case "how-it-works":
          setIsDrawerOpen(false);
          window.open(
            "https://www.socialbevy.com/how-genie-works",
            "_blank",
            "noopener,noreferrer"
          );
          break;
        case "contact":
          setIsDrawerOpen(false);
          window.open(
            "https://www.socialbevy.com/vendors",
            "_blank",
            "noopener,noreferrer"
          );
          break;
        case "terms":
          setIsDrawerOpen(false);
          window.open("https://www.socialbevy.com/", "_blank", "noopener,noreferrer");
          break;
      }
    },
    [goHome, isVibeeMember, navigateTo]
  );

  const handleTopBack = useCallback(() => {
    switch (activeScreen) {
      case "listening":
        goHome();
        break;
      case "thinking":
        goBack("home");
        break;
      case "decision":
        goBack("home");
        break;
      case "more":
        goBack("decision");
        break;
      case "detail":
        goBack(detailReturnScreen);
        break;
      case "saved":
        goBack("home");
        break;
      case "offers":
        goBack("account");
        break;
      case "preferences":
        goBack("account");
        break;
      case "account":
        if (accountScreenMode) {
          setAccountScreenMode(null);
        } else {
          dismissAccount();
        }
        break;
      default:
        goBack("home");
    }
  }, [
    accountScreenMode,
    activeScreen,
    detailReturnScreen,
    dismissAccount,
    goBack,
    goHome,
  ]);

  const shouldShowTopBar =
    activeScreen !== "home" &&
    activeScreen !== "vendor" &&
    activeScreen !== "account";

  const shouldShowFooter =
    activeScreen === "decision" ||
    activeScreen === "more" ||
    activeScreen === "detail" ||
    activeScreen === "saved";

  const footerActiveId: FlowAnchor =
    activeScreen === "saved" ? "saved" : activeScreen === "home" ? "home" : "decision";

  return (
    <main className="flex h-dvh flex-col overflow-x-hidden overflow-y-auto bg-white px-4 pb-24 pt-3 dark:bg-[#0a0000] sm:px-6 sm:pt-5">
      <DrawerMenu
        visible={isDrawerOpen}
        activeScreen={activeScreen}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={handleDrawerNavigate}
      />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3">
        {installPrompt && !isStandalone ? (
          <button
            type="button"
            onClick={async () => {
              await installPrompt.prompt();
              await installPrompt.userChoice;
              setInstallPrompt(null);
            }}
            className="self-end rounded-full border border-gray-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.26em] text-gray-600 shadow-sm dark:border-white/12 dark:bg-black/24 dark:text-white/72"
          >
            Install Genie
          </button>
        ) : null}

        {shouldShowTopBar ? (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleTopBack}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm dark:border-white/12 dark:bg-black/24 dark:text-white/82 dark:shadow-[0_20px_50px_rgba(0,0,0,0.36)]"
              aria-label="Go back"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-red-600 shadow-sm dark:border-white/12 dark:bg-black/24 dark:text-white/82 dark:shadow-[0_20px_50px_rgba(0,0,0,0.36)]"
              aria-label="Open navigation menu"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 7.5h14" />
                <path d="M5 12h14" />
                <path d="M5 16.5h14" />
              </svg>
            </button>
          </div>
        ) : null}

        {activeScreen === "home" ? (
          <section ref={homeRef} className="flex flex-1 flex-col">
          <HomeScreen
            config={config}
            inputValue={inputValue}
            isSubmitting={isThinking}
            showBottomNav={false}
            onMenuOpen={() => setIsDrawerOpen(true)}
            onInputChange={(value) => {
              if (!hasTrackedTypingRef.current && value.trim().length > 0) {
                hasTrackedTypingRef.current = true;
                trackTypedQueryStarted();
              }

              setInputValue(value);
            }}
            onChipSelect={(prompt) => {
              const chip =
                config.quickChips.find((item) => item.prompt === prompt) ?? null;
              if (chip) {
                trackQuickChipTapped(chip.label, chip.prompt);
              }

              setInputValue(prompt);
              void handleQuery(prompt, "chip");
            }}
            onOrbTap={startListening}
            onSubmit={() => void handleQuery(inputValue, "typed")}
          />
          </section>
        ) : null}

        {activeScreen === "listening" ? (
          <SectionShell
            sectionRef={listeningRef}
            title="What's your vibe today?"
            subtitle="Ask me anything, food, drinks or something to do."
            className="min-h-[34rem] text-center"
          >
            <div className="flex flex-col items-center justify-center">
              <Image
                src="/genie-pic2.png"
                alt="Genie listening"
                width={360}
                height={520}
                className="mx-auto w-full max-w-[17rem] object-contain"
              />
              <div className="mt-2">
                <GenieOrb mode="listening" size={122} />
              </div>
              <p className="mt-5 text-2xl text-gray-800 dark:text-white">I&apos;m listening...</p>
              <p className="mt-2 text-sm text-gray-400 dark:text-white/55">
                Speak naturally. Genie will take it from here.
              </p>
            </div>
          </SectionShell>
        ) : null}

        {activeScreen === "thinking" ? (
          <SectionShell
            sectionRef={thinkingRef}
            title="Got it - looking for:"
            subtitle={
              response?.normalized_intent || lastQuery || "Your next spot in Houston"
            }
            className="min-h-[28rem]"
          >
            <div className="flex flex-col items-center text-center">
              <Image
                src="/genie-pic2.png"
                alt="Genie thinking"
                width={320}
                height={440}
                className="w-full max-w-[15rem] object-contain"
              />
              <p className="mt-2 text-3xl font-medium text-red-600 dark:text-[#ff6b6b]">
                {isThinking ? "Say less... I got you!" : response?.reply || statusMessage}
              </p>
              <div className="mt-5">
                <GenieOrb mode="thinking" size={122} />
              </div>
              {nonStructuredResponse ? (
                <div className="mt-5 w-full space-y-4">
                  <div className="rounded-[22px] border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                    {nonStructuredResponse.response_mode === "supported_no_results"
                      ? "Genie did not find a clean match yet. Tighten the ask and try again."
                      : nonStructuredResponse.response_mode === "city_missing"
                        ? "Tell Genie your city and preferences so recommendations can stay local."
                      : nonStructuredResponse.response_mode === "city_unsupported"
                        ? `Genie is not live in ${nonStructuredResponse.city_context || "that city"} yet.`
                        : nonStructuredResponse.reply}
                  </div>
                  {(nonStructuredResponse.response_mode === "city_missing" ||
                    nonStructuredResponse.show_intake_prompt) && (
                    <button
                      type="button"
                      onClick={() => navigateTo("preferences")}
                      className="w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-white/12 dark:bg-black/20 dark:text-white/82"
                    >
                      Set my preferences
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={goHome}
                    className="w-full rounded-[18px] border border-red-500 bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))] dark:shadow-[0_18px_36px_rgba(0,0,0,0.28)]"
                  >
                    Ask Genie again
                  </button>
                </div>
              ) : statusMessage && currentResponseMode !== "structured_results" ? (
                <div className="mt-5 rounded-[22px] border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                  {statusMessage}
                </div>
              ) : null}
            </div>
          </SectionShell>
        ) : null}

        {activeScreen === "decision" && showResultSections ? (
          <SectionShell
            sectionRef={decisionRef}
            title="A few spots match your vibe."
            subtitle="Three strong picks first. Tap one to open the full Genie detail."
          >
            <div className="space-y-3">
              {response?.show_intake_prompt ? (
                <div className="rounded-[22px] border border-red-200 bg-red-50/60 p-4 dark:border-white/12 dark:bg-black/20">
                  <p className="text-sm leading-6 text-gray-700 dark:text-white/82">
                    {intakePromptCopy}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateTo("preferences")}
                    className="mt-3 rounded-[16px] border border-red-500 bg-red-600 px-4 py-2 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                  >
                    Tune preferences
                  </button>
                </div>
              ) : null}
              <GenieBubble copy="I found a few spots that match your vibe." compact />
              {response?.decisive.map((venue, index) => (
                <ResultCard
                  key={venue.id}
                  venue={venue}
                  index={index}
                  onOpen={() => selectVenue(venue, index, "decision")}
                  onSave={() => handleSaveVenue(venue)}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  setHasOpenedMoreNearby(true);
                  trackEvent(analyticsEvents.seeMoreNearbyTapped);
                  trackEvent(analyticsEvents.moreNearbyOpened, {
                    count: response?.more_nearby.length ?? 0,
                    queryText: response?.normalized_intent ?? lastQuery,
                  });
                  navigateTo("more");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-red-200 bg-white px-4 py-3 text-[1.05rem] font-medium text-gray-800 shadow-sm hover:bg-red-50 dark:border-white/12 dark:bg-black/20 dark:text-white"
              >
                <span>See More Nearby</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </SectionShell>
        ) : null}

        {activeScreen === "more" && showResultSections && response?.more_nearby.length ? (
          <SectionShell
            sectionRef={moreRef}
            title="A couple more spots you might like."
            subtitle="Browse the second layer from the same Genie answer set."
          >
            <div className="space-y-4">
              <GenieBubble copy="Here are a couple more spots you might like." compact />
              <div className="grid grid-cols-2 gap-3">
                {response.more_nearby.slice(0, 2).map((venue, index) => (
                  <button
                    key={venue.id}
                    type="button"
                    onClick={() => selectVenue(venue, index, "more")}
                    className="overflow-hidden rounded-[16px] border border-red-200 bg-white text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-[#8c2b2b] dark:bg-black/20 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
                  >
                    <div className="relative h-36 w-full">
                      <Image
                        src={venue.image || "/sample-venue-2.jpeg"}
                        alt={venue.venue_name || "Venue"}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-1 text-[1rem] font-semibold text-gray-900 dark:text-white">{venue.venue_name}</p>
                      <p className="mt-1 text-[0.72rem] text-gray-500 dark:text-white/55">
                        {getVenueHeadline(venue)} - {getVenueDistance(venue, index + 3)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {buildVenueTags(venue)
                          .slice(0, 2)
                          .map((tag) => (
                            <TagPill key={`${venue.id}-${tag}`}>{tag}</TagPill>
                          ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {response.more_nearby.length > 2 ? (
                <>
                  <p className="mt-5 font-[family:var(--font-display)] text-xl text-gray-800 dark:text-white">More spots you might like</p>
                  <div className="grid grid-cols-3 gap-3">
                {response.more_nearby.slice(2, 5).map((venue, index) => (
                  <button
                    key={venue.id}
                    type="button"
                    onClick={() => selectVenue(venue, index + 2, "more")}
                    className="overflow-hidden rounded-[16px] border border-red-200 bg-white text-left shadow-[0_8px_20px_rgba(0,0,0,0.05)] dark:border-[#8c2b2b] dark:bg-black/20 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
                  >
                    <div className="relative h-24 w-full">
                      <Image
                        src={venue.image || "/sample-venue-2.jpeg"}
                        alt={venue.venue_name || "Venue"}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-2 text-[0.9rem] font-medium leading-5 text-gray-900 dark:text-white">{venue.venue_name}</p>
                      <p className="mt-1 text-[0.66rem] leading-4 text-gray-500 dark:text-white/55">
                        {getVenueHeadline(venue)} - {getVenueDistance(venue, index + 5)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {buildVenueTags(venue)
                          .slice(0, 1)
                          .map((tag) => (
                            <TagPill key={`${venue.id}-${tag}`}>{tag}</TagPill>
                          ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
                </>
              ) : null}
            </div>
          </SectionShell>
        ) : null}

        {activeScreen === "detail" && selectedVenue ? (
          <SectionShell sectionRef={detailRef} className="p-0">
            <div className="overflow-hidden rounded-[32px]">
              <div className="relative h-[18rem] w-full">
                <Image
                  src={selectedVenue.image || "/sample-venue-1.jpeg"}
                  alt={selectedVenue.venue_name || "Venue"}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.7))] px-5 pb-5 pt-12">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-3xl font-bold text-white">
                        {selectedVenue.venue_name}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[selectedVenue.energy_level || "Trending", selectedVenue.price_band || "Luxury", selectedVenue.music || "DJ set"].map((tag) => (
                          <span key={tag} className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium text-white">{tag}</span>
                        ))}
                      </div>
                      <p className="mt-2 text-sm text-white/80">
                        {selectedVenue.google_rating
                          ? `${"★".repeat(Math.round(selectedVenue.google_rating))} ${selectedVenue.google_rating.toFixed(1)}${selectedVenue.google_user_ratings_total ? ` (${selectedVenue.google_user_ratings_total} reviews)` : ""}`
                          : "Loved by the Genie crowd"}{" "}
                        · {getVenueDistance(selectedVenue, 1)} · {selectedVenue.area_neighborhood || selectedVenue.city || "Downtown"}
                      </p>
                      <p className="mt-1 text-sm text-orange-300">
                        {getVenueStatus(selectedVenue, 0)}
                        {selectedVenue.is_official_vendor ? " - Official Vendor" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveVenue(selectedVenue)}
                      className="rounded-full border border-white/20 bg-black/30 p-3"
                    >
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill={savedVenueIds.includes(getVenueId(selectedVenue)) ? "#ff4f4f" : "none"} stroke={savedVenueIds.includes(getVenueId(selectedVenue)) ? "#ff4f4f" : "currentColor"} strokeWidth="1.8">
                        <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-5 pb-5 pt-4">
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(detailActions.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {detailActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.onClick}
                      className={`rounded-[18px] border px-4 py-3 text-sm font-semibold ${
                        action.variant === "primary"
                          ? "border-red-500 bg-red-600 text-white shadow-sm dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                          : "border-gray-200 bg-white text-gray-700 dark:border-white/12 dark:bg-black/20 dark:text-white/82"
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">About</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-white/72">
                    {getVenueDescription(selectedVenue)}
                  </p>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-black/20">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/10">
                    <div>
                      <p className="text-sm uppercase tracking-[0.22em] text-gray-400 dark:text-white/42">
                        Location
                      </p>
                      <p className="mt-1 text-base text-gray-900 dark:text-white">
                        {selectedVenue.address || "Houston, Texas"}
                      </p>
                    </div>
                    {nativeMapsUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          trackEvent(analyticsEvents.mapOpen, {
                            venueId: getVenueId(selectedVenue),
                          });
                          trackEvent(analyticsEvents.vendorMapTap, {
                            venueId: getVenueId(selectedVenue),
                          });
                          logVendorInteraction("map_click", Number(selectedVenue.id));
                          window.open(
                            nativeMapsUrl,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }}
                        className="rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 dark:border-white/12 dark:bg-black/20 dark:text-white/82"
                      >
                        Open Map
                      </button>
                    ) : null}
                  </div>
                  {mapPreviewUrl && !mapPreviewFailed ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (nativeMapsUrl) {
                          trackEvent(analyticsEvents.mapOpen, {
                            venueId: getVenueId(selectedVenue),
                          });
                          trackEvent(analyticsEvents.vendorMapTap, {
                            venueId: getVenueId(selectedVenue),
                          });
                          logVendorInteraction("map_click", Number(selectedVenue.id));
                          window.open(
                            nativeMapsUrl,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }
                      }}
                      className="relative block h-48 w-full overflow-hidden border-b border-gray-100 text-left dark:border-white/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mapPreviewUrl}
                        alt={`Map for ${selectedVenue.venue_name}`}
                        onError={() => setMapPreviewFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : null}
                  <div className="flex flex-wrap gap-2 px-4 py-4">
                    {buildVenueTags(selectedVenue).map((tag) => (
                      <TagPill key={`${selectedVenue.id}-${tag}`}>{tag}</TagPill>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-red-100 bg-red-50/50 p-4 dark:border-white/10 dark:bg-black/16">
                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 flex-none overflow-hidden rounded-[18px] border border-red-100 bg-white dark:border-white/10 dark:bg-[#230404]">
                      <Image
                        src="/genie-profile-pic.png"
                        alt="Genie"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-gray-400 dark:text-white/42">
                        Genie note
                      </p>
                      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-white/72">
                        Save this spot or sign up so Genie can remember your favorites, unlock your vibe history, and keep your next asks feeling smarter.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionShell>
        ) : null}

        {activeScreen === "saved" ? (
          <SectionShell
            sectionRef={savedRef}
            title="Your saved spots"
            subtitle="Anything you save lives here so you can jump back into your favorites."
          >
            {!account ? (
              <div className="rounded-[24px] border border-gray-100 bg-gray-50 px-4 py-5 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                Sign up or log in to save venues and keep them here.
              </div>
            ) : savedVenues.length ? (
              <div className="space-y-3">
                {savedVenues.map((venue, index) => (
                  <ResultCard
                    key={`saved-${venue.id}`}
                    venue={venue}
                    index={index}
                    onOpen={() => selectVenue(venue, index, "saved")}
                    onSave={() => handleSaveVenue(venue)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-gray-100 bg-gray-50 px-4 py-5 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                You have not saved any spots yet. Save one from a Genie result and it will appear here.
              </div>
            )}
          </SectionShell>
        ) : null}

        {activeScreen === "offers" ? (
          <SectionShell
            sectionRef={offersRef}
            title="V.I.Bee Offers"
            subtitle="Redeem member perks and show the QR code when you are at the venue."
          >
            {!account ? (
              <div className="rounded-[24px] border border-gray-100 bg-gray-50 px-4 py-5 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                Sign in to view and redeem V.I.Bee offers.
              </div>
            ) : account.membership !== "vibee" ? (
              <div className="rounded-[24px] border border-gray-100 bg-gray-50 px-4 py-5 text-sm leading-6 text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                <p>
                  Your account is on the free tier. Upgrade to V.I.Bee to unlock
                  offers and redemption QR codes.
                </p>
                <button
                  type="button"
                  onClick={() => navigateTo("account")}
                  className="mt-3 rounded-[16px] border border-red-500 bg-red-600 px-4 py-2 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                >
                  Open membership
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {offersLoading ? (
                  <div className="rounded-[20px] border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                    Loading your active offers...
                  </div>
                ) : null}

                {offersError ? (
                  <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-[#8c2b2b] dark:bg-[#220909] dark:text-[#ff9f9f]">
                    {offersError}
                  </div>
                ) : null}

                {activeRedemption ? (
                  <div className="rounded-[24px] border border-red-200 bg-red-50/60 p-4 dark:border-white/12 dark:bg-black/20">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-white/55">
                      Active QR
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {activeRedemption.offer_title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-white/72">
                      Redeemed at {formatTimestamp(activeRedemption.redeemed_at)}
                    </p>
                    <div className="mt-3 inline-flex overflow-hidden rounded-[18px] border border-gray-200 bg-white p-2 dark:border-white/12 dark:bg-black/24">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={buildQrImageUrl(activeRedemption.verify_url)}
                        alt={`QR code for ${activeRedemption.offer_title}`}
                        className="h-[180px] w-[180px] object-cover"
                      />
                    </div>
                    <p className="mt-3 text-xs text-gray-500 dark:text-white/55">
                      Staff can scan this code at{" "}
                      <span className="font-semibold text-gray-700 dark:text-white/82">
                        /verify/{activeRedemption.redemption_token}
                      </span>
                    </p>
                  </div>
                ) : null}

                {offers.length ? (
                  <div className="space-y-3">
                    {offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-white/45">
                              {offer.offer_type.replaceAll("_", " ")}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                              {offer.title}
                            </h3>
                          </div>
                          {offer.discount_value ? (
                            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 dark:border-[#8c2b2b] dark:bg-[#220909] dark:text-[#ff9f9f]">
                              {offer.discount_value}
                            </span>
                          ) : null}
                        </div>
                        {offer.description ? (
                          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-white/72">
                            {offer.description}
                          </p>
                        ) : null}
                        {offer.redeem_instructions ? (
                          <p className="mt-2 text-xs text-gray-500 dark:text-white/55">
                            {offer.redeem_instructions}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleRedeemOffer(offer)}
                          disabled={redeemingOfferId === offer.id}
                          className="mt-3 rounded-[16px] border border-red-500 bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                        >
                          {redeemingOfferId === offer.id ? "Redeeming..." : "Redeem offer"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : !offersLoading ? (
                  <div className="rounded-[20px] border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                    No active offers are available right now. Check back soon.
                  </div>
                ) : null}

                <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-black/20">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Redemption History
                  </h3>
                  {redemptionsLoading ? (
                    <p className="mt-2 text-sm text-gray-600 dark:text-white/72">
                      Loading redemption history...
                    </p>
                  ) : redemptions.length ? (
                    <ul className="mt-3 space-y-2">
                      {redemptions.map((redemption) => {
                        const matchedOffer = offers.find(
                          (offer) => offer.id === redemption.offer_id
                        );
                        return (
                          <li
                            key={redemption.id}
                            className="rounded-[14px] border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/12 dark:bg-black/24"
                          >
                            <p className="font-medium text-gray-800 dark:text-white/82">
                              {matchedOffer?.title || `Offer #${redemption.offer_id}`}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-white/55">
                              Redeemed {formatTimestamp(redemption.redeemed_at)}
                              {redemption.verified_at
                                ? ` • Verified ${formatTimestamp(redemption.verified_at)}`
                                : ""}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600 dark:text-white/72">
                      You have not redeemed any offers yet.
                    </p>
                  )}
                </div>
              </div>
            )}
          </SectionShell>
        ) : null}

        {activeScreen === "preferences" ? (
          <SectionShell
            sectionRef={preferencesRef}
            title="Tune my preferences"
            subtitle="Share your vibe so Genie can get sharper with each recommendation."
          >
            {socialLoading ? (
              <div className="rounded-[20px] border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                Loading your preference profile...
              </div>
            ) : (
              <div className="space-y-5">
                {(Object.keys(socialTagOptions) as Array<keyof typeof socialTagOptions>).map(
                  (field) => (
                    <div key={field}>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white/82">
                        {socialTagLabels[field]}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {socialTagOptions[field].map((option) => {
                          const fieldValue = socialProfileDraft[field];
                          const selected = Array.isArray(fieldValue)
                            ? fieldValue.includes(option)
                            : false;
                          return (
                            <button
                              key={`${field}-${option}`}
                              type="button"
                              onClick={() => toggleSocialTag(field, option)}
                              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                selected
                                  ? "border-red-500 bg-red-600 text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                                  : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600 dark:border-white/12 dark:bg-black/20 dark:text-white/70 dark:hover:border-white/30 dark:hover:text-white"
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}

                {(Object.keys(socialPreferenceOptions) as Array<
                  keyof typeof socialPreferenceOptions
                >).map((field) => (
                  <div key={field}>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/82">
                      {socialPreferenceLabels[field]}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {socialPreferenceOptions[field].map((option) => {
                        const selected = socialProfileDraft[field] === option;
                        return (
                          <button
                            key={`${field}-${option}`}
                            type="button"
                            onClick={() => selectSocialPreference(field, option)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                              selected
                                ? "border-red-500 bg-red-600 text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                                : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600 dark:border-white/12 dark:bg-black/20 dark:text-white/70 dark:hover:border-white/30 dark:hover:text-white"
                            }`}
                          >
                            {option.replaceAll("_", " ")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => void handleSaveSocialProfile()}
                  disabled={socialSaving}
                  className="w-full rounded-[18px] border border-red-500 bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                >
                  {socialSaving ? "Saving preferences..." : "Save preferences"}
                </button>
              </div>
            )}
          </SectionShell>
        ) : null}

        <AccountSection
          sectionRef={accountRef}
          visible={activeScreen === "account"}
          account={account}
          config={config}
          onDismiss={dismissAccount}
          onModeChange={setAccountScreenMode}
          onOpenVendor={() => navigateTo("vendor")}
          onOpenOffers={() => navigateTo("offers")}
          onOpenPreferences={() => navigateTo("preferences")}
          onAccountChange={(nextAccount) => {
            setAccount(nextAccount);
            void hydrateAuthenticatedSession();
            setAccountScreenMode(null);
            setActiveScreen("account");
          }}
        />

        <VendorSection
          visible={activeScreen === "vendor"}
          sectionRef={vendorRef}
          account={account}
          config={config}
          onOpenAccount={() => navigateTo("account")}
          onContinueHome={() => goBack("home")}
          onRefreshSession={() => void hydrateAuthenticatedSession()}
        />
      </div>

      {shouldShowFooter ? (
        <BottomDock
          activeId={footerActiveId}
          onHome={goHome}
          onSearch={() => navigateTo("home", false)}
          onCenter={startListening}
        />
      ) : null}
    </main>
  );
}
