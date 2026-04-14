"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AccountSection,
  type AccountScreenMode,
} from "@/app/components/single-page/AccountSection";
import { DrawerMenu, type DrawerMenuActionId } from "@/app/components/single-page/DrawerMenu";
import { ProfileSection } from "@/app/components/single-page/ProfileSection";
import { VendorSection } from "@/app/components/single-page/VendorSection";
import {
  BottomDock,
  GenieBubble,
  ResultCard,
  SectionShell,
  type FlowAnchor,
  buildVenueTags,
  getVenueDistance,
  getVenueHeadlineShort,
  getVenueStatus,
  getVenueDescription,
  getOpenUntil,
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
  const profileRef = useRef<HTMLElement | null>(null);
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
  const [activeTagCategory, setActiveTagCategory] =
    useState<keyof typeof socialTagOptions>("music_tags");
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(
    initialVenueId ? String(initialVenueId) : null
  );
  const [account, setAccount] = useState<ConsumerAccount | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [mapPreviewFailed, setMapPreviewFailed] = useState(false);
  const [accountScreenMode, setAccountScreenMode] =
    useState<AccountScreenMode>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    subject: "",
    description: "",
  });
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
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
    if (
      activeScreen === "offers" ||
      activeScreen === "dashboard" ||
      activeScreen === "membership"
    ) {
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
    experiences_tags: "Experiences",
    atmosphere_tags: "Atmosphere",
    bevy_bites_tags: "Bevy Bites",
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

  const handleLogout = useCallback(() => {
    clearStoredSession();
    setAccount(null);
    setSavedVenueIds([]);
    setSavedVenues([]);
    setIsDrawerOpen(false);
    goHome();
  }, [goHome]);

  const handleDrawerNavigate = useCallback(
    (target: DrawerMenuActionId) => {
      switch (target) {
        case "home":
          goHome();
          break;
        case "profile":
          navigateTo("profile");
          break;
        case "dashboard":
          navigateTo("dashboard");
          break;
        case "preferences":
          navigateTo("preferences");
          break;
        case "saved":
          navigateTo("saved");
          break;
        case "membership":
          navigateTo("membership");
          break;
        case "how-genie-works":
          setIsDrawerOpen(false);
          window.open(
            "https://www.socialbevy.com/how-genie-works",
            "_blank",
            "noopener,noreferrer"
          );
          break;
        case "vendor":
          navigateTo("vendor");
          break;
        case "help-faq":
          setIsDrawerOpen(false);
          window.open(
            "https://www.socialbevy.com/faq",
            "_blank",
            "noopener,noreferrer"
          );
          break;
        case "contact":
          navigateTo("contact");
          break;
        case "privacy":
          setIsDrawerOpen(false);
          window.open(
            "https://www.socialbevy.com/privacy",
            "_blank",
            "noopener,noreferrer"
          );
          break;
        case "terms":
          setIsDrawerOpen(false);
          window.open(
            "https://www.socialbevy.com/terms",
            "_blank",
            "noopener,noreferrer"
          );
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
      case "profile":
        goBack("home");
        break;
      case "dashboard":
        goBack("home");
        break;
      case "contact":
        goBack("home");
        break;
      case "membership":
        goBack("home");
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
    activeScreen !== "account" &&
    activeScreen !== "profile" &&
    activeScreen !== "dashboard" &&
    activeScreen !== "contact" &&
    activeScreen !== "membership" &&
    activeScreen !== "saved";

  const shouldShowFooter =
    activeScreen === "decision" ||
    activeScreen === "more" ||
    activeScreen === "detail" ||
    activeScreen === "saved" ||
    activeScreen === "dashboard";

  const footerActiveId: FlowAnchor =
    activeScreen === "saved" ? "saved" : activeScreen === "home" ? "home" : "decision";

  return (
    <main className={`relative flex h-dvh flex-col overflow-x-hidden ${activeScreen === "home" || activeScreen === "listening" || activeScreen === "thinking" ? "overflow-y-hidden" : "overflow-y-auto"} bg-white px-4 pb-3 pt-3 dark:bg-[url('/bg.png')] dark:bg-cover dark:bg-center sm:px-6 sm:pb-4 sm:pt-5`}>
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/50 dark:block" />
      <DrawerMenu
        visible={isDrawerOpen}
        activeScreen={activeScreen}
        isLoggedIn={!!account}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={handleDrawerNavigate}
        onLogout={handleLogout}
        onLogin={() => { setIsDrawerOpen(false); navigateTo("account"); }}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={() => setNotificationsEnabled((prev) => !prev)}
      />

      <div className={`relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-3 ${activeScreen === "home" || activeScreen === "listening" || activeScreen === "thinking" ? "min-h-0" : ""}`}>
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
          <section ref={homeRef} className="flex min-h-0 flex-1 flex-col">
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
          <section
            ref={listeningRef}
            className="relative flex min-h-0 flex-1 flex-col items-center text-center"
          >
            <h2 className="mt-2 whitespace-nowrap font-[family:var(--font-display)] text-[1.5rem] font-semibold leading-[1.1] text-gray-900 dark:text-white sm:text-[1.85rem]">
              What&apos;s your vibe today?
            </h2>
            <p className="mt-1 max-w-[28ch] text-[0.85rem] leading-[1.2rem] text-gray-500 dark:text-white/70">
              Ask me anything, food, drinks or something to do.
            </p>

            <div className="relative mt-1 min-h-0 w-full max-w-[20rem] flex-1">
              <Image
                src="/orb.png"
                alt=""
                aria-hidden="true"
                width={420}
                height={420}
                priority
                className="pointer-events-none absolute left-[48%] top-1/2 z-0 h-auto w-[88%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-95"
              />
              <Image
                src="/genie-pic2.png"
                alt="Genie listening"
                width={420}
                height={680}
                className="relative z-10 mx-auto h-full w-auto max-w-[55%] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.25)]"
              />
            </div>

            <div className="mt-1 shrink-0">
              <GenieOrb mode="listening" size={76} />
            </div>
            <p className="mt-2 shrink-0 text-[1.1rem] font-semibold text-gray-800 dark:text-white">
              I&apos;m listening...
            </p>
            <p className="mt-0.5 shrink-0 text-[0.75rem] text-gray-400 dark:text-white/55">
              Speak naturally. Genie will take it from here.
            </p>
          </section>
        ) : null}

        {activeScreen === "thinking" ? (
          <section
            ref={thinkingRef}
            className="relative flex min-h-0 flex-1 flex-col items-center text-center"
          >
            {/* Header */}
            <h2 className="mt-1 font-[family:var(--font-display)] text-[1.4rem] font-semibold leading-[1.1] text-gray-900 dark:text-white sm:text-[1.7rem]">
              Got it - looking for:
            </h2>
            <p className="mt-1 max-w-[28ch] text-[0.85rem] font-medium text-gray-600 dark:text-white/80">
              {response?.normalized_intent || lastQuery || "Your next spot in Houston"}
            </p>

            {/* Girl + Orb */}
            <div className="relative mt-1 min-h-0 w-full max-w-[20rem] flex-1">
              <Image
                src="/orb.png"
                alt=""
                aria-hidden="true"
                width={500}
                height={500}
                className="pointer-events-none absolute left-[48%] top-1/2 z-0 h-auto w-[88%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-95"
              />
              <Image
                src="/genie-pic2.png"
                alt="Genie thinking"
                width={420}
                height={680}
                className="relative z-10 mx-auto h-full w-auto max-w-[55%] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
              />
            </div>

            {/* Status text */}
            <p className="mt-1 shrink-0 text-[1.1rem] font-semibold text-gray-900 dark:text-white">
              {isThinking ? "Say less... I got you!" : response?.reply || statusMessage}
            </p>

            {/* Orb mic */}
            <div className="mt-2 shrink-0">
              <GenieOrb mode="thinking" size={64} />
            </div>

            {/* Non-structured responses */}
            {nonStructuredResponse ? (
              <div className="mt-5 w-full space-y-3">
                <div className="rounded-[22px] border border-white/15 bg-black/30 px-4 py-3 text-sm leading-6 text-white/80 backdrop-blur-sm">
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
                    className="w-full rounded-[18px] border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20"
                  >
                    Set my preferences
                  </button>
                )}
                <button
                  type="button"
                  onClick={goHome}
                  className="w-full rounded-[18px] border border-red-500 bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                >
                  Ask Genie again
                </button>
              </div>
            ) : statusMessage && currentResponseMode !== "structured_results" ? (
              <div className="mt-5 rounded-[22px] border border-white/15 bg-black/30 px-4 py-3 text-sm leading-6 text-white/80 backdrop-blur-sm">
                {statusMessage}
              </div>
            ) : null}
          </section>
        ) : null}

        {activeScreen === "decision" && showResultSections ? (
          <section ref={decisionRef} className="space-y-3 pb-24">
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
              className="mt-1 flex w-full items-center justify-center gap-2 py-3 text-[1rem] font-medium text-gray-800 dark:text-white"
            >
              <span>See More Nearby</span>
              <span aria-hidden="true">→</span>
            </button>
          </section>
        ) : null}

        {activeScreen === "more" && showResultSections && response?.more_nearby.length ? (
          <section ref={moreRef} className="space-y-4 pb-24">
            <GenieBubble copy="Here are a couple more spots you might like." compact />
            <div className="grid grid-cols-2 gap-3">
              {response.more_nearby.slice(0, 2).map((venue, index) => (
                <button
                  key={venue.id}
                  type="button"
                  onClick={() => selectVenue(venue, index, "more")}
                  className="overflow-hidden rounded-[18px] border border-red-200 bg-white text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
                >
                  <div className="relative h-36 w-full">
                    <Image
                      src={venue.image || "/sample-venue-2.jpeg"}
                      alt={venue.venue_name || "Venue"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 45vw, 200px"
                    />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="line-clamp-1 text-[1rem] font-semibold text-gray-900 dark:text-white">
                      {venue.venue_name}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-gray-500 dark:text-white/60">
                      {getVenueHeadlineShort(venue)} - {getVenueDistance(venue, index + 3)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {buildVenueTags(venue).slice(0, 2).map((tag) => (
                        <span
                          key={`${venue.id}-${tag}`}
                          className="rounded-full border border-gray-200 bg-transparent px-2.5 py-0.5 text-[0.65rem] font-medium text-gray-600 dark:border-white/25 dark:text-white/70"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {response.more_nearby.length > 2 ? (
              <>
                <p className="mt-5 text-[1.25rem] font-semibold text-gray-900 dark:text-white">
                  More spots you might like
                </p>
                <div className="-mx-4 overflow-x-auto">
                  <div className="flex gap-3 px-4 pb-2">
                    {response.more_nearby.slice(2, 8).map((venue, index) => (
                      <button
                        key={venue.id}
                        type="button"
                        onClick={() => selectVenue(venue, index + 2, "more")}
                        className="w-[9.5rem] flex-none overflow-hidden rounded-[18px] border border-red-200 bg-white text-left shadow-[0_8px_20px_rgba(0,0,0,0.05)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
                      >
                        <div className="relative h-24 w-full">
                          <Image
                            src={venue.image || "/sample-venue-2.jpeg"}
                            alt={venue.venue_name || "Venue"}
                            fill
                            className="object-cover"
                            sizes="152px"
                          />
                        </div>
                        <div className="px-2.5 py-2">
                          <p className="line-clamp-1 text-[0.88rem] font-semibold text-gray-900 dark:text-white">
                            {venue.venue_name}
                          </p>
                          <p className="mt-0.5 truncate text-[0.66rem] text-gray-500 dark:text-white/60">
                            {getVenueHeadlineShort(venue)} - {getVenueDistance(venue, index + 5)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {buildVenueTags(venue).slice(0, 2).map((tag) => (
                              <span
                                key={`${venue.id}-${tag}`}
                                className="rounded-full border border-gray-200 bg-transparent px-2 py-0.5 text-[0.6rem] font-medium text-gray-600 dark:border-white/25 dark:text-white/70"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {activeScreen === "detail" && selectedVenue ? (
          <section ref={detailRef} className="-mx-4 pb-24 sm:-mx-6">
            <div className="relative h-[22rem] w-full overflow-hidden">
              <Image
                src={selectedVenue.image || "/sample-venue-1.jpeg"}
                alt={selectedVenue.venue_name || "Venue"}
                fill
                className="object-cover"
                priority
                sizes="100vw"
              />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4">
                <button
                  type="button"
                  onClick={handleTopBack}
                  className="flex h-10 w-10 items-center justify-center text-white"
                  aria-label="Go back"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveVenue(selectedVenue)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/30 text-white backdrop-blur-sm"
                    aria-label="Save"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill={savedVenueIds.includes(getVenueId(selectedVenue)) ? "#ff4f4f" : "none"}
                      stroke={savedVenueIds.includes(getVenueId(selectedVenue)) ? "#ff4f4f" : "currentColor"}
                      strokeWidth="1.8"
                    >
                      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/30 text-white backdrop-blur-sm"
                    aria-label="Menu"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M5 7.5h14" />
                      <path d="M5 12h14" />
                      <path d="M5 16.5h14" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.85))] px-5 pb-5 pt-16">
                <h2 className="text-[2.1rem] font-bold leading-tight text-white">
                  {selectedVenue.venue_name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-[0.72rem] font-semibold text-gray-900">
                    {getVenueStatus(selectedVenue, 0)}
                  </span>
                  <span className="text-[0.8rem] text-white/85">
                    {[
                      selectedVenue.energy_level,
                      selectedVenue.price_band === "$$" ? "Mid-Range" : selectedVenue.price_band,
                      selectedVenue.music?.split(",")[0].split(" ").slice(0, 2).join(" "),
                      selectedVenue.crowd?.split(" ").slice(0, 2).join(" "),
                    ]
                      .filter(Boolean)
                      .slice(0, 4)
                      .join(" - ")}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 pb-5 pt-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-gray-700 dark:text-white/80">
                {selectedVenue.google_rating ? (
                  <span className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <svg
                        key={n}
                        viewBox="0 0 20 20"
                        className={`h-4 w-4 ${n <= Math.round(selectedVenue.google_rating ?? 0) ? "text-amber-400" : "text-gray-400 dark:text-white/25"}`}
                        fill="currentColor"
                      >
                        <path d="M10 1.5 12.6 7l6.1.6-4.6 4.2 1.3 6-5.4-3.2L4.6 18l1.3-6L1.3 7.6 7.4 7z" />
                      </svg>
                    ))}
                    <span className="ml-1 font-medium">
                      {selectedVenue.google_rating.toFixed(1)}
                    </span>
                    {selectedVenue.google_user_ratings_total ? (
                      <span className="text-gray-500 dark:text-white/55">
                        ({selectedVenue.google_user_ratings_total} Reviews)
                      </span>
                    ) : null}
                  </span>
                ) : null}
                <span className="text-gray-500 dark:text-white/55">
                  - {getVenueHeadlineShort(selectedVenue)} - {getVenueDistance(selectedVenue, 1)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[0.82rem]">
                {getOpenUntil(selectedVenue) ? (
                  <span className="text-gray-800 dark:text-white/85">
                    {getOpenUntil(selectedVenue)}
                  </span>
                ) : selectedVenue.is_open_now ? (
                  <span className="text-gray-800 dark:text-white/85">Open now</span>
                ) : null}
                {selectedVenue.is_official_vendor ? (
                  <span className="rounded-full border border-gray-300 bg-transparent px-3 py-0.5 text-[0.72rem] text-gray-700 dark:border-white/30 dark:text-white/80">
                    Official Vendor
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {detailActions.slice(0, 3).map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    className="flex items-center justify-center gap-1.5 rounded-[14px] border border-gray-200 bg-white px-2 py-2.5 text-[0.8rem] font-medium text-gray-800 dark:border-white/20 dark:bg-black/30 dark:text-white"
                  >
                    {action.id.includes("call") || action.label.toLowerCase().includes("call") ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.33 1.7.63 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.2a2 2 0 0 1 2.11-.45c.8.3 1.64.51 2.5.63A2 2 0 0 1 22 16.92z" />
                      </svg>
                    ) : action.label.toLowerCase().includes("reserv") ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49" />
                      </svg>
                    )}
                    {action.label}
                  </button>
                ))}
              </div>

              <div>
                <h3 className="text-[1.1rem] font-semibold text-gray-900 dark:text-white">About</h3>
                <p className="mt-1 text-[0.88rem] leading-6 text-gray-600 dark:text-white/75">
                  {getVenueDescription(selectedVenue)}
                </p>
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
                      window.open(nativeMapsUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className="relative block h-40 w-full overflow-hidden rounded-[18px] border border-gray-200 text-left dark:border-white/10"
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

              <p className="text-center text-[0.95rem] font-medium text-gray-900 dark:text-white">
                {selectedVenue.address || "Houston, Texas"}
              </p>

              <div className="flex flex-wrap gap-2">
                {buildVenueTags(selectedVenue).map((tag) => (
                  <span
                    key={`${selectedVenue.id}-${tag}`}
                    className="rounded-full border border-gray-300 bg-transparent px-3 py-1 text-[0.78rem] font-medium text-gray-700 dark:border-white/30 dark:text-white/85"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeScreen === "saved" ? (
          <section ref={savedRef} className="pb-28">
            {/* Header */}
            <div className="mb-5 flex items-center">
              <button
                type="button"
                onClick={() => goBack("home")}
                aria-label="Go back"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 dark:border-white/12 dark:bg-black/24 dark:text-white/82"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
                </svg>
              </button>
              <h2 className="flex-1 pr-9 text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
                Saved Spots
              </h2>
            </div>

            {!account ? (
              <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/70">
                Sign up or log in to save venues and keep them here.
              </div>
            ) : savedVenues.length ? (
              <div className="grid grid-cols-2 gap-3">
                {savedVenues.map((venue, index) => (
                  <button
                    key={`saved-${venue.id}`}
                    type="button"
                    onClick={() => selectVenue(venue, index, "saved")}
                    className="overflow-hidden rounded-[18px] border border-white/10 bg-black/30 text-left"
                  >
                    <div className="relative h-44 w-full">
                      <Image
                        src={venue.image || "/sample-venue-1.jpeg"}
                        alt={venue.venue_name || "Venue"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 44vw, 200px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                      {/* Heart */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void handleSaveVenue(venue); }}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm"
                        aria-label="Unsave"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#ff4f4f" stroke="#ff4f4f" strokeWidth="1.5">
                          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
                        </svg>
                      </button>
                      {/* Name + location overlay */}
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
                        <p className="line-clamp-1 text-[0.88rem] font-bold text-white">
                          {venue.venue_name}
                        </p>
                        <p className="mt-0.5 truncate text-[0.68rem] text-white/65">
                          {getVenueHeadlineShort(venue)} · {getVenueDistance(venue, index)}
                        </p>
                      </div>
                    </div>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 px-2.5 py-2.5">
                      {buildVenueTags(venue).slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/15 bg-white/8 px-2.5 py-0.5 text-[0.62rem] font-medium text-white/75"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/70">
                You have not saved any spots yet. Save one from a Genie result and it will appear here.
              </div>
            )}
          </section>
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
          <section ref={preferencesRef} className="relative flex flex-1 flex-col pb-4">
            {!account ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 pt-20 text-center">
                <p className="text-[1.1rem] font-semibold text-gray-900 dark:text-white">
                  Sign in to set preferences
                </p>
                <p className="max-w-[22rem] text-sm text-gray-500 dark:text-white/60">
                  Log in or create an account so Genie can personalise results just for you.
                </p>
                <button
                  type="button"
                  onClick={() => navigateTo("account")}
                  className="rounded-[18px] border border-red-500 bg-red-600 px-6 py-3 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                >
                  Login / Sign Up
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo("home")}
                    className="text-gray-800 dark:text-white"
                    aria-label="Go back"
                  >
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
                    </svg>
                  </button>
                  <h2 className="flex-1 pr-6 text-center text-[1.35rem] font-semibold text-gray-900 dark:text-white">
                    Social Preferences
                  </h2>
                </div>

                {socialLoading ? (
                  <div className="rounded-[20px] border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-white/10 dark:bg-black/20 dark:text-white/72">
                    Loading your preference profile...
                  </div>
                ) : (
                  <>
                    {(() => {
                      const categories = Object.keys(socialTagOptions) as Array<keyof typeof socialTagOptions>;
                      const categoryImage: Record<keyof typeof socialTagOptions, string> = {
                        experiences_tags: "/sample-venue-1.jpeg",
                        atmosphere_tags: "/sample-venue-2.jpeg",
                        bevy_bites_tags: "/sample-venue-1.jpeg",
                        community_tags: "/sample-venue-2.jpeg",
                        music_tags: "",
                      };
                      const totalSelected = categories.reduce((sum, key) => {
                        const value = socialProfileDraft[key];
                        return sum + (Array.isArray(value) ? value.length : 0);
                      }, 0);
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            {categories.map((field) => {
                              const isActive = activeTagCategory === field;
                              const isMusic = field === "music_tags";
                              return (
                                <button
                                  key={field}
                                  type="button"
                                  onClick={() => setActiveTagCategory(field)}
                                  className={`relative overflow-hidden rounded-[18px] border bg-white text-left shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition dark:bg-black/30 ${
                                    isActive
                                      ? "border-red-500 ring-2 ring-red-500/40 dark:border-[#ff7b7b]"
                                      : "border-gray-100 dark:border-white/10"
                                  }`}
                                >
                                  <div className="relative h-28 w-full overflow-hidden">
                                    {isMusic ? (
                                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,#1a1033,#3a1a5a)]">
                                        <svg viewBox="0 0 24 24" className="h-12 w-12">
                                          <defs>
                                            <linearGradient id="musicGrad" x1="0" y1="0" x2="1" y2="1">
                                              <stop offset="0%" stopColor="#f472b6" />
                                              <stop offset="100%" stopColor="#8b5cf6" />
                                            </linearGradient>
                                          </defs>
                                          <path d="M9 18V5l12-2v13" fill="none" stroke="url(#musicGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                          <circle cx="6" cy="18" r="3" fill="url(#musicGrad)" />
                                          <circle cx="18" cy="16" r="3" fill="url(#musicGrad)" />
                                        </svg>
                                      </div>
                                    ) : (
                                      <Image
                                        src={categoryImage[field]}
                                        alt={socialTagLabels[field]}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 45vw, 200px"
                                      />
                                    )}
                                  </div>
                                  <p className="px-3 py-2 text-center text-[14px] font-medium text-gray-900 dark:text-white">
                                    {socialTagLabels[field]}
                                  </p>
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                            {socialTagOptions[activeTagCategory].map((option) => {
                              const fieldValue = socialProfileDraft[activeTagCategory];
                              const selected = Array.isArray(fieldValue) ? fieldValue.includes(option) : false;
                              return (
                                <button
                                  key={`${activeTagCategory}-${option}`}
                                  type="button"
                                  onClick={() => toggleSocialTag(activeTagCategory, option)}
                                  className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition ${
                                    selected
                                      ? "border-red-500 bg-red-600 text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                                      : "border-gray-300 bg-transparent text-gray-700 hover:border-red-300 hover:text-red-600 dark:border-white/25 dark:text-white/85 dark:hover:border-white/55"
                                  }`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>

                          <p className="mt-4 text-center text-[13px] text-gray-500 dark:text-white/65">
                            {totalSelected} {totalSelected === 1 ? "tag" : "tags"} selected
                          </p>

                          <button
                            type="button"
                            onClick={() => void handleSaveSocialProfile()}
                            disabled={socialSaving}
                            className="mt-3 w-full rounded-[20px] border border-red-500 bg-red-600 px-4 py-3.5 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                          >
                            {socialSaving ? "Saving..." : "Next"}
                          </button>
                        </>
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </section>
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

        {activeScreen === "dashboard" ? (
          <section className="space-y-5 pb-28">
            {!account ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 pt-20 text-center">
                <p className="text-[1.1rem] font-semibold text-gray-900 dark:text-white">Sign in to access your dashboard</p>
                <p className="max-w-[22rem] text-sm text-gray-500 dark:text-white/60">Log in or create an account to view your offers, redemptions, and saved spots.</p>
                <button
                  type="button"
                  onClick={() => navigateTo("account")}
                  className="rounded-[18px] border border-red-500 bg-red-600 px-6 py-3 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                >
                  Login / Sign Up
                </button>
              </div>
            ) : (
              <>
            {/* Header */}
            <div className="flex items-center justify-between pt-1">
              <h1 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
                Hi, {account?.firstName || "there"}!
              </h1>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-red-600 shadow-sm dark:border-white/12 dark:bg-black/24 dark:text-white/82"
                aria-label="Open menu"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M5 7.5h14" /><path d="M5 12h14" /><path d="M5 16.5h14" />
                </svg>
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-red-200/60 bg-[rgba(120,10,10,0.55)] px-4 py-4 dark:border-white/10 dark:bg-black/30">
                <p className="text-[2rem] font-bold leading-none text-white">
                  {offers.length}
                </p>
                <p className="mt-1 text-[0.75rem] font-medium text-white/70">
                  Offers Available
                </p>
              </div>
              <div className="rounded-[18px] border border-red-200/60 bg-[rgba(120,10,10,0.55)] px-4 py-4 dark:border-white/10 dark:bg-black/30">
                <p className="text-[2rem] font-bold leading-none text-white">
                  {redemptions.length}
                </p>
                <p className="mt-1 text-[0.75rem] font-medium text-white/70">
                  Redemption Used
                </p>
              </div>
            </div>

            {/* V.I.Bee Offers */}
            <div>
              <h2 className="mb-3 text-[1.05rem] font-semibold text-gray-900 dark:text-white">
                Your V.I.Bee Offers
              </h2>
              {offersLoading ? (
                <p className="text-sm text-white/60">Loading offers...</p>
              ) : offers.length ? (
                <>
                  <div className="-mx-4 overflow-x-auto">
                    <div className="flex gap-3 px-4 pb-1">
                      {offers.slice(0, 6).map((offer) => (
                        <div
                          key={offer.id}
                          className="w-[9rem] flex-none rounded-[18px] border border-red-200/40 bg-[rgba(80,5,5,0.70)] p-3 dark:border-white/10 dark:bg-black/35"
                        >
                          <p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/55">
                            {offer.offer_type?.replaceAll("_", " ") || "Offer"}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[0.88rem] font-bold leading-snug text-white">
                            {offer.title}
                          </p>
                          {offer.description ? (
                            <p className="mt-0.5 truncate text-[0.65rem] text-white/50">
                              {offer.description}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => navigateTo("offers")}
                            className="mt-2.5 w-full rounded-[10px] bg-[#e8900a] px-2 py-1.5 text-[0.65rem] font-bold text-white"
                          >
                            V.I.Bee Only
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo("offers")}
                    className="mt-3 w-full rounded-[16px] border border-red-500/60 bg-[rgba(150,15,15,0.55)] py-3 text-sm font-semibold text-white dark:border-white/15"
                  >
                    See All Offers
                  </button>
                </>
              ) : (
                <div className="rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                  {account?.membership === "vibee"
                    ? "No active offers right now. Check back soon."
                    : "Upgrade to V.I.Bee to unlock exclusive offers."}
                </div>
              )}
            </div>

            {/* Recent Redemptions */}
            {redemptions.length > 0 ? (
              <div>
                <h2 className="mb-3 text-[1.05rem] font-semibold text-gray-900 dark:text-white">
                  Recent Redemptions
                </h2>
                <div className="space-y-2">
                  {redemptions.slice(0, 3).map((redemption) => {
                    const matchedOffer = offers.find((o) => o.id === redemption.offer_id);
                    const isVerified = !!redemption.verified_at;
                    const date = redemption.redeemed_at
                      ? new Date(
                          redemption.redeemed_at < 1_000_000_000_000
                            ? redemption.redeemed_at * 1000
                            : redemption.redeemed_at
                        ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : null;
                    return (
                      <div
                        key={redemption.id}
                        className="flex items-center justify-between rounded-[16px] border border-white/10 bg-[rgba(60,5,5,0.55)] px-4 py-3 dark:bg-black/25"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {matchedOffer?.title || `Offer #${redemption.offer_id}`}
                          </p>
                          {date ? (
                            <p className="mt-0.5 text-[0.72rem] text-white/50">
                              {date}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`ml-3 flex-none rounded-full px-2.5 py-1 text-[0.65rem] font-bold ${
                            isVerified
                              ? "bg-green-500/20 text-green-400"
                              : "bg-white/10 text-white/55"
                          }`}
                        >
                          {isVerified ? "Verified" : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo("offers")}
                  className="mt-3 w-full rounded-[16px] border border-red-500/60 bg-[rgba(150,15,15,0.55)] py-3 text-sm font-semibold text-white dark:border-white/15"
                >
                  See All
                </button>
              </div>
            ) : null}

            {/* Saved Venues */}
            {savedVenues.length > 0 ? (
              <div>
                <h2 className="mb-3 text-[1.05rem] font-semibold text-gray-900 dark:text-white">
                  Saved Venues
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {savedVenues.slice(0, 4).map((venue, index) => (
                    <button
                      key={venue.id}
                      type="button"
                      onClick={() => {
                        setSelectedVenueId(getVenueId(venue));
                        setDetailReturnScreen("saved");
                        navigateTo("detail");
                      }}
                      className="overflow-hidden rounded-[18px] border border-white/10 bg-black/30 text-left"
                    >
                      <div className="relative h-28 w-full">
                        <Image
                          src={venue.image || "/sample-venue-1.jpeg"}
                          alt={venue.venue_name || "Venue"}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 44vw, 200px"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#ff4f4f" stroke="#ff4f4f" strokeWidth="1.5">
                            <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
                          </svg>
                        </div>
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="line-clamp-1 text-[0.85rem] font-semibold text-white">
                          {venue.venue_name}
                        </p>
                        <p className="mt-0.5 truncate text-[0.68rem] text-white/55">
                          {getVenueHeadlineShort(venue)} · {getVenueDistance(venue, index)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {buildVenueTags(venue).slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem] font-medium text-white/70"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
              </>
            )}
          </section>
        ) : null}

        {activeScreen === "profile" ? (
          <section ref={profileRef} className="flex flex-1 flex-col">
            {!account ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-10 text-center">
                <p className="text-[1rem] font-semibold text-gray-900 dark:text-white">Sign in to view your profile</p>
                <p className="max-w-[22rem] text-sm text-gray-500 dark:text-white/60">Create an account or log in to manage your profile details.</p>
                <button
                  type="button"
                  onClick={() => navigateTo("account")}
                  className="rounded-[18px] border border-red-500 bg-red-600 px-6 py-3 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                >
                  Login / Sign Up
                </button>
              </div>
            ) : (
              <ProfileSection
                visible
                account={account}
                onBack={() => goBack("home")}
                onSave={async (data) => {
                  if (!account) return;
                  const updated = {
                    ...account,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    phone: data.phone,
                  };
                  setAccount(updated);
                  const { writeConsumerAccount } = await import("@/app/lib/localState");
                  writeConsumerAccount(updated);
                }}
              />
            )}
          </section>
        ) : null}

        {/* ── CONTACT ── */}
        {activeScreen === "contact" ? (
          <section className="pb-8">
            <div className="mb-5 flex items-center">
              <button
                type="button"
                onClick={() => goBack("home")}
                aria-label="Go back"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 dark:border-white/12 dark:bg-black/24 dark:text-white/82"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
                </svg>
              </button>
              <h2 className="flex-1 pr-9 text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
                Contact
              </h2>
            </div>

            {/* Offer preview cards */}
            {offers.length > 0 ? (
              <div className="mb-5">
                <div className="-mx-4 overflow-x-auto">
                  <div className="flex gap-3 px-4 pb-1">
                    {offers.slice(0, 6).map((offer) => (
                      <div
                        key={offer.id}
                        className="w-[8rem] flex-none rounded-[16px] border border-red-200/30 bg-[rgba(80,5,5,0.65)] p-3 dark:border-white/10 dark:bg-black/35"
                      >
                        <p className="truncate text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-white/50">
                          {offer.offer_type?.replaceAll("_", " ") || "Offer"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[0.82rem] font-bold leading-snug text-white">
                          {offer.title}
                        </p>
                        {offer.description ? (
                          <p className="mt-0.5 truncate text-[0.62rem] text-white/45">
                            {offer.description}
                          </p>
                        ) : null}
                        <div className="mt-2 rounded-[8px] bg-[#e8900a] py-1 text-center text-[0.6rem] font-bold text-white">
                          V.I.Bee Only
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Form */}
            {contactSent ? (
              <div className="rounded-[20px] border border-green-500/30 bg-green-500/10 px-4 py-6 text-center">
                <p className="text-base font-semibold text-white">Message sent!</p>
                <p className="mt-1 text-sm text-white/65">We&apos;ll get back to you shortly.</p>
                <button
                  type="button"
                  onClick={() => { setContactSent(false); setContactForm({ firstName: "", lastName: "", email: "", subject: "", description: "" }); }}
                  className="mt-4 rounded-[14px] border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white"
                >
                  Send another
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setContactSending(true);
                  await new Promise((r) => setTimeout(r, 800));
                  setContactSending(false);
                  setContactSent(true);
                }}
                className="space-y-3"
              >
                {(
                  [
                    { key: "firstName", label: "First Name", placeholder: "First Name", type: "text" },
                    { key: "lastName", label: "Last Name", placeholder: "Last Name", type: "text" },
                    { key: "email", label: "Email", placeholder: "Email", type: "email" },
                    { key: "subject", label: "Subject", placeholder: "Subject", type: "text" },
                  ] as Array<{ key: keyof typeof contactForm; label: string; placeholder: string; type: string }>
                ).map(({ key, placeholder, type }) => (
                  <input
                    key={key}
                    type={type}
                    value={contactForm[key]}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-[14px] border border-white/15 bg-white/8 px-4 py-3.5 text-sm text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none dark:bg-black/25"
                  />
                ))}
                <textarea
                  value={contactForm.description}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Short Description"
                  rows={4}
                  className="w-full resize-none rounded-[14px] border border-white/15 bg-white/8 px-4 py-3.5 text-sm text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none dark:bg-black/25"
                />
                <button
                  type="submit"
                  disabled={contactSending}
                  className="mt-1 w-full rounded-[18px] border border-red-500 bg-red-600 py-3.5 text-sm font-semibold text-white disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                >
                  {contactSending ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </section>
        ) : null}

        {/* ── MEMBERSHIP ── */}
        {activeScreen === "membership" ? (() => {
          const isVibee = account?.membership === "vibee";
          const isActive = account?.subscriptionStatus === "active";
          const wasVibee = !isVibee && (account?.subscriptionStatus === "cancelled" || account?.subscriptionStatus === "inactive" || account?.subscriptionStatus === "past_due");
          return (
            <section className="pb-8">
              <div className="mb-5 flex items-center">
                <button
                  type="button"
                  onClick={() => goBack("home")}
                  aria-label="Go back"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 dark:border-white/12 dark:bg-black/24 dark:text-white/82"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
                  </svg>
                </button>
                <h2 className="flex-1 pr-9 text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
                  Membership
                </h2>
              </div>

              <div className="space-y-3">
                {/* Free member card — always shown when not active vibee */}
                {!isVibee || !isActive ? (
                  <div className="flex items-center gap-4 rounded-[20px] border border-white/15 bg-[rgba(60,5,5,0.55)] px-4 py-4 dark:bg-black/25">
                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 border-white/20 bg-white/10 text-[0.65rem] font-bold uppercase tracking-wide text-white">
                      FREE
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">Free Member</p>
                      <p className="mt-0.5 text-[0.78rem] text-white/55">Currently Active</p>
                    </div>
                  </div>
                ) : null}

                {/* V.I.Bee active */}
                {isVibee && isActive ? (
                  <div className="flex items-center gap-4 rounded-[20px] border border-red-500/40 bg-[rgba(120,10,10,0.55)] px-4 py-4">
                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 border-red-400/60 bg-red-500/20">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 text-red-300" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">V.I.Bee Member</p>
                      <p className="mt-0.5 text-[0.78rem] text-white/55">Next Payment: —</p>
                    </div>
                  </div>
                ) : null}

                {/* Expired V.I.Bee */}
                {wasVibee ? (
                  <>
                    <div className="flex items-center gap-4 rounded-[20px] border border-white/15 bg-[rgba(60,5,5,0.55)] px-4 py-4 opacity-70 dark:bg-black/25">
                      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 border-white/20 bg-white/10">
                        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/50" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white">V.I.Bee Member</p>
                        <p className="mt-0.5 text-[0.78rem] text-white/55">Expired</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo("account")}
                      className="w-full rounded-[18px] border border-red-500 bg-red-600 py-4 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                    >
                      Renew V.I.Bee Now
                    </button>
                  </>
                ) : null}

                {/* Upgrade prompt — free with no prior vibee */}
                {!isVibee && !wasVibee ? (
                  <>
                    <div className="rounded-[20px] border border-red-500/30 bg-[rgba(80,5,5,0.60)] px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 border-red-400/50 bg-red-500/15">
                          <svg viewBox="0 0 24 24" className="h-6 w-6 text-red-300" fill="none" stroke="currentColor" strokeWidth="1.6">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-white">Become a V.I.Bee</p>
                          <p className="mt-0.5 text-[0.82rem] font-medium text-red-300">{config.vibeeMonthlyPrice ?? "$2.99"} / month</p>
                        </div>
                      </div>
                      <ul className="mt-4 space-y-2">
                        {(config.vibeeBenefits ?? ["Exclusive event access", "Early invites & giveaways", "Hidden gems & VIP deals"]).map((benefit) => (
                          <li key={benefit} className="flex items-center gap-2 text-[0.85rem] text-white/80">
                            <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo("account")}
                      className="w-full rounded-[18px] border border-red-500 bg-red-600 py-4 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                    >
                      Upgrade to V.I.Bee Now
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          );
        })() : null}
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
