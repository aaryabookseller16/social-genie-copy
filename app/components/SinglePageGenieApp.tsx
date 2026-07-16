"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AccountSection,
  type AccountScreenMode,
} from "@/app/components/single-page/AccountSection";
import { DrawerMenu, type DrawerMenuActionId } from "@/app/components/single-page/DrawerMenu";
import { RoleSwitcherDialog } from "@/app/components/single-page/RoleSwitcherDialog";
import { LoginSuccessDialog } from "@/app/components/single-page/LoginSuccessDialog";
import { ProfileSection } from "@/app/components/single-page/ProfileSection";
import { NotificationSettingsSection } from "@/app/components/single-page/NotificationSettingsSection";
import { VendorSection } from "@/app/components/single-page/VendorSection";
import { ProducerSection } from "@/app/components/single-page/ProducerSection";
import { RoleIdentifierSection } from "@/app/components/single-page/RoleIdentifierSection";
import { RoleSetupSection } from "@/app/components/single-page/RoleSetupSection";
import { OnboardingCompleteSection } from "@/app/components/single-page/OnboardingCompleteSection";
import { VerifyEmailGate } from "@/app/components/single-page/VerifyEmailGate";
import { InfluencerSection } from "@/app/components/single-page/InfluencerSection";
import { NotificationsScreen } from "@/app/components/single-page/NotificationsScreen";
import { MessagesScreen } from "@/app/components/single-page/MessagesScreen";
import { ConversationScreen } from "@/app/components/single-page/ConversationScreen";
import { HomescreenSection } from "@/app/components/homescreen/HomescreenSection";
import { EventDetailSection } from "@/app/components/event-detail/EventDetailSection";
import EventsPage from "@/app/components/events/EventsPage";
import { type ManagedEvent } from "@/app/lib/publicApiClient";
import {
  BottomDock,
  GenieBubble,
  BackIcon,
  ResultCard,
  EventResultCard,
  SectionShell,
  type FlowAnchor,
  buildVenueTags,
  getVenueDistance,
  getVenueHeadlineShort,
  getVenueStatus,
  getVenueDescription,
  getGenieTake,
  getOpenUntil,
} from "@/app/components/single-page/ui";
import { HomeScreen } from "@/app/components/discovery/HomeScreen";
import { GenieOrb } from "@/app/components/shared/GenieOrb";
import {
  requestPushPermission,
  isPushPermissionGranted,
  getPushSubscriptionId,
} from "@/app/components/shared/NotificationsBoot";
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
  readOnboardingPending,
  writeOnboardingPending,
  readSelectedRoles,
  type ConsumerAccount,
  type OnboardingRole,
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
  fetchVenueById,
  fetchSubscriptionStatus,
  fetchSubscriptionStatusForSession,
  initGuestSession,
  initDeviceProfile,
  loginWithMagicToken,
  logVendorInteraction,
  logVenueInteraction,
  logEventInteraction,
  markNotificationOpened,
  mergeGuestProfile,
  persistAuthSession,
  registerPushToken,
  redeemVibeeOffer,
  saveVenueForUser,
  checkInToVenue,
  checkOutOfVenue,
  fetchVenueCheckins,
  submitContactForm,
  syncSavedVenueIds,
  trackSocialSignal,
  toConsumerAccount,
  updateSocialProfile,
  unsaveVenueForUser,
  createSubscriptionCheckout,
  setUserRoles,
  saveProducerDetails,
  saveInfluencerDetails,
  fetchUnreadNotifCount,
  fetchUnreadMessageCount,
  fetchMessageThreads,
  mergeThreadsToConversations,
  type MessageThreadType,
} from "@/app/lib/publicApiClient";
import { getRuntimeConfig } from "@/app/lib/runtimeConfig";
import { extractCityFromMessage, mentionsNearMe } from "@/app/lib/cityExtractor";
import {
  readSignupPromptState,
  shouldSuppressSignupPrompt,
  writeSignupPromptState,
  type SignupPromptTriggerReason,
} from "@/app/lib/signupPrompt";
import {
  readExternalUserId,
  readSessionId,
  readSessionToken,
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

function getAppOrigin() {
  return typeof window !== "undefined"
    ? window.location.origin
    : "https://genie.socialbevy.com";
}

async function shareLink(payload: { title: string; text: string; url: string }) {
  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share(payload);
    return;
  }

  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
  }
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
// ─── Navigate to event detail ────────────────────────────────────────────────
// Called whenever a user taps an event card anywhere in the app.
// Sets the slug so the event-detail screen knows which page to load.
function openEventDetail(
  slug: string,
  eventId: number | null,
  setSlug: (s: string) => void,
  setId: (id: number | null) => void,
  nav: (screen: FlowAnchor) => void
) {
  setSlug(slug);
  setId(eventId);
  nav("event-detail");
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

function isAlreadyRedeemedMessage(message: string) {
  const normalized = message.toLowerCase().replace(/[_-]+/g, " ");
  return (
    normalized.includes("already redeemed") ||
    normalized.includes("already been redeemed") ||
    normalized.includes("offer redeemed already")
  );
}

const socialTagOptions = {
  music_tags: [
    "R&B / Soul",
    "Hip-Hop / Rap",
    "AfroBeats",
    "Latin Music",
    "Jazz",
    "House / Electronic",
    "Reggae",
    "Country",
    "Rock",
    "Pop",
  ],
  bevy_bites_tags: [
    "Soul Food",
    "Seafood",
    "Vegan",
    "Barbecue",
    "Cajun",
    "Comfort Food",
    "Tapas / Small Plates",
    "Bottomless Mimosas",
    "Signature Cocktails",
    "Whiskey / Bourbon Bars",
    "Wine Focused",
    "Beer Gardens",
    "Mexican",
    "Tex-Mex",
    "Cuban",
    "Colombian",
    "Peruvian",
    "Salvadoran",
    "Chinese",
    "Korean",
    "Japanese",
    "Vietnamese",
    "Thai",
    "Indian",
    "Pakistani",
    "Nepalese",
    "Italian",
    "French",
    "Mediterranean",
    "Greek",
    "Spanish",
    "British Pub Food",
    "American Diner",
    "Nigerian",
    "Ethiopian",
    "Ghanaian",
    "Moroccan",
    "Filipino",
    "Indonesian",
    "Malaysian",
    "Persian",
    "Lebanese",
    "Turkish",
    "Brazilian BBQ",
    "Feijoada",
    "Jamaican",
    "Trinidadian",
    "Haitian",
    "Kosher",
    "Halal",
    "Gluten-Free",
    "Vegetarian",
    "Fusion Cuisine",
    "Haute Cuisine",
    "Street Food",
  ],
  experiences_tags: [
    "Brunch",
    "Happy Hour",
    "Day Party",
    "Late Night",
    "Live Band",
    "Lounges",
    "Hookah Nights",
    "Karaoke",
    "Game Night",
    "Trivia Night",
    "BOGO Specials",
    "Theme Nights",
  ],
  atmosphere_tags: [
    "Rooftop",
    "Patio",
    "Indoor Cozy",
    "Speakeasy Vibe",
    "Club Vibe",
    "Chill & Intimate",
    "Loud & Lit",
    "Live DJ",
    "No DJ",
    "Dancing Allowed",
    "Dress Code: Casual",
    "Dress Code: Trendy",
    "Dress Code: Upscale",
    "Cigar Lounge",
    "Hookah Available",
    "Smoke-Free",
  ],
  community_tags: [
    "Black-Owned",
    "Woman-Owned",
    "LGBTQ+ Friendly",
    "21+ Only",
    "No Kids",
    "Pet Friendly",
    "Free Parking",
    "Valet Parking",
    "Street Parking",
    "Open Late",
    "Free Events",
  ],
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

function formatDate(value?: number | null) {
  if (!value || !Number.isFinite(value)) {
    return "";
  }
  const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Parses an AI fallback reply into a short intro paragraph plus a list of
// items. Handles two backend formats:
//  1. Paragraph-separated: "Intro\n\n1. Item one\n\n2. Item two"
//  2. Inline: "Intro: 1. Item one. 2. Item two. 3. Item three."
// Used for reply_mode = city_unsupported | ai_fallback so the single `reply`
// string can render as two Figma containers (speech bubble + bulleted list).
function parseAiFallbackReply(text: string): {
  intro: string;
  items: string[];
} {
  const stripMd = (s: string) =>
    s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\s+/g, " ").trim();

  const normalized = text.replace(/\r\n/g, "\n").trim();
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  // Case 1: reply has blank-line separated numbered/dashed chunks.
  const paragraphItems = paragraphs.filter((chunk) =>
    /^(?:\d+\.|[-•*])\s+/.test(chunk)
  );
  if (paragraphItems.length >= 2) {
    const items: string[] = [];
    const introParts: string[] = [];
    for (const chunk of paragraphs) {
      const m = chunk.match(/^(?:\d+\.|[-•*])\s+([\s\S]+)$/);
      if (m) {
        const value = stripMd(m[1]);
        if (value) items.push(value);
      } else if (items.length === 0) {
        introParts.push(chunk);
      }
    }
    return { intro: stripMd(introParts.join(" ")), items };
  }

  // Case 2: inline numbered items in a single run of text (e.g. "… options:
  // 1. Foo. 2. Bar. 3. Baz.").
  const firstItem = normalized.match(/(?:^|[\s:;,—-])\s*1\.\s+/);
  if (firstItem && firstItem.index !== undefined && /\s2\.\s/.test(normalized)) {
    const splitAt = firstItem.index + firstItem[0].indexOf("1.");
    const introRaw = normalized.slice(0, splitAt).trim().replace(/[:\-—]\s*$/, "");
    const listPart = normalized.slice(splitAt);
    const rawItems = listPart
      .split(/\s+(?=\d+\.\s+)/)
      .map((p) => p.trim())
      .filter(Boolean);
    const items = rawItems
      .map((p) => {
        const m = p.match(/^\d+\.\s+([\s\S]+)$/);
        return m ? stripMd(m[1]) : "";
      })
      .filter(Boolean);
    return { intro: stripMd(introRaw), items };
  }

  return { intro: stripMd(normalized), items: [] };
}

type SinglePageGenieAppProps = {
  initialScreen?: FlowAnchor;
  initialVenueId?: string | null;
};

export function SinglePageGenieApp({
  initialScreen = "homescreen",
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
  const pendingReturnRef = useRef<{ screen: FlowAnchor; eventId: number | null; event: Record<string, unknown> } | null>(null);
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
  const roleIdentifierRef = useRef<HTMLElement | null>(null);
  const roleSetupRef = useRef<HTMLElement | null>(null);
  const onboardingCompleteRef = useRef<HTMLElement | null>(null);
  const roleUnlockRef = useRef<HTMLElement | null>(null);
  const [activeScreen, setActiveScreen] = useState<FlowAnchor>(initialScreen);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [activeConversation, setActiveConversation] = useState<{
    threadId: number | null;
    threadType: MessageThreadType;
    counterpartId: number;
    counterpartName?: string;
    counterpartAvatarUrl?: string;
    viewerRole?: "consumer" | "producer";
  } | null>(null);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [loginSuccessSheetOpen, setLoginSuccessSheetOpen] = useState(false);
  const [detailReturnScreen, setDetailReturnScreen] = useState<
    "decision" | "more" | "saved"
  >("decision");
  const [inputValue, setInputValue] = useState("");
  const [pendingTranscript, setPendingTranscript] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<GenieResponseEnvelope | null>(null);
  const [queryMode, setQueryMode] = useState<"venue" | "event" | "both">("venue");
  const [savedVenueIds, setSavedVenueIds] = useState<string[]>([]);
  const [savedVenues, setSavedVenues] = useState<GenieVenue[]>([]);
  // ── Venue check-in state ────────────────────────────────────────────────
  const [checkedInVenueIds, setCheckedInVenueIds] = useState<number[]>([]);
  const [venueActiveCheckins, setVenueActiveCheckins] = useState<number | null>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [offers, setOffers] = useState<VibeeOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<VibeeRedemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [activeRedemption, setActiveRedemption] = useState<{
    offer_id: number;
    offer_title: string;
    offer_type?: string;
    offer_description?: string;
    offer_terms?: string;
    discount_value?: string;
    vendor_id: number;
    venue_name?: string;
    venue_image?: string;
    venue_rating?: number;
    venue_review_count?: number;
    venue_neighborhood?: string;
    verify_url: string;
    redeemed_at: number;
    redemption_token: string;
  } | null>(null);
  const [redeemingOfferId, setRedeemingOfferId] = useState<number | null>(null);
  const [redemptionOutcome, setRedemptionOutcome] = useState<"success" | "expired" | "already_redeemed" | null>(null);
  const [offersFilter, setOffersFilter] = useState<
    "all" | "happy_hour" | "perk" | "brunch" | "late_night"
  >("all");
  const [redemptionsFilter, setRedemptionsFilter] = useState<
    "all" | "verified" | "pending" | "expired"
  >("all");
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialSaving, setSocialSaving] = useState(false);
  const [activeTagCategory, setActiveTagCategory] =
    useState<keyof typeof socialTagOptions>("music_tags");
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(
    initialVenueId ? String(initialVenueId) : null
  );
  // ── Event detail state ──────────────────────────────────────────────────────
// selectedEventSlug: the public_slug of the event currently being viewed
// selectedEventId: the numeric id for survey submission
const [selectedEventSlug, setSelectedEventSlug] = useState<string | null>(null);
const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
const [selectedEvent, setSelectedEvent] = useState<Record<string, unknown> | null>(null);

// ── Post-event survey state ──────────────────────────────────────────────────
const [surveyEventId, setSurveyEventId] = useState<number | null>(null);
const [surveyDidAttend, setSurveyDidAttend] = useState<boolean | null>(null);
const [surveyVibeRating, setSurveyVibeRating] = useState<number>(0);
const [surveyVenueRating, setSurveyVenueRating] = useState<number>(0);
const [surveyMetExpectations, setSurveyMetExpectations] = useState<"yes" | "somewhat" | "no" | null>(null);
const [surveyWouldReturn, setSurveyWouldReturn] = useState<"yes" | "maybe" | "no" | null>(null);
const [surveyOneWord, setSurveyOneWord] = useState("");
const [surveyDiscoveredViaGenie, setSurveyDiscoveredViaGenie] = useState<boolean | null>(null);
const [surveySubmitting, setSurveySubmitting] = useState(false);
const [surveySubmitted, setSurveySubmitted] = useState(false);

// ── V.I.Bee trial state ──────────────────────────────────────────────────────
const [trialLoading, setTrialLoading] = useState(false);
const [trialError, setTrialError] = useState<string | null>(null);
const [trialSuccess, setTrialSuccess] = useState(false);

  const [sharedVenue, setSharedVenue] = useState<GenieVenue | null>(null);
  const [sharedVenueLoading, setSharedVenueLoading] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const router = useRouter();
  const [account, setAccount] = useState<ConsumerAccount | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  // Onboarding wizard: under magic-link there is no auth session until the link
  // is clicked, so the wizard runs on the guest session. `isOnboarding` routes
  // the preferences "Next" button into the role steps; `onboardingEmail` feeds
  // the completion + verification gate.
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingEmail, setOnboardingEmail] = useState("");
  const [onboardingRoles, setOnboardingRoles] = useState<OnboardingRole[]>([]);
  const [verifyGateOpen, setVerifyGateOpen] = useState(false);
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
  const [contactError, setContactError] = useState<string | null>(null);
  const [queryCount, setQueryCount] = useState(0);
  const [browseCount, setBrowseCount] = useState(0);
  const [hasOpenedMoreNearby, setHasOpenedMoreNearby] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  // "unknown" while the permission check is still resolving (or unsupported
  // browser); once resolved, drives whether/which location-prompt banner to
  // show. See the geolocation-permission effect below.
  const [geoPermissionState, setGeoPermissionState] = useState<
    "unknown" | "granted" | "denied" | "prompt"
  >("unknown");
  // Which flavor of the location-ask banner to show: guest copy (asked once,
  // permanently dismissible), registered-user copy (re-asked each new
  // browser session until granted), or "blocked" (we know for certain the
  // browser will never show its native prompt again, so we stop offering a
  // dead "Allow" button and just point them at browser settings, once).
  // Null = hidden.
  const [locationPromptVariant, setLocationPromptVariant] = useState<
    "guest" | "registered" | "blocked" | null
  >(null);
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Remembers the active city for the session so follow-up queries without
  // an explicit city ("any rooftops?") stay anchored to the previously chosen
  // city instead of silently reverting to device location.
  const [sessionCity, setSessionCity] = useState<string | null>(null);

  // { lat, lng } shape expected by distance helpers. Falls back to null when
  // the user hasn't granted location permission so distance labels hide
  // instead of computing against a stale Houston default.
  const userCoordsLL = useMemo<{ lat: number; lng: number } | null>(
    () =>
      userCoords
        ? { lat: userCoords.latitude, lng: userCoords.longitude }
        : null,
    [userCoords]
  );
  const hasPromptedForPushRef = useRef(false);
  // The external_user_id this device's push token was last registered under.
  // Lets us re-register on login (guest → real user) so the recipient's token
  // is tied to the right account, without re-prompting every render.
  const lastRegisteredPushExtIdRef = useRef<string | null>(null);

  // Register this device's OneSignal token under the current user so DM pushes
  // can reach them. Silent when permission is already granted; prompts at most
  // once per session otherwise (never on cold start — callers gate on login /
  // a meaningful screen). No-op if already registered under this external id.
  const syncPushRegistration = useCallback(async () => {
    const externalUserId = readExternalUserId();
    if (!externalUserId) return;
    if (lastRegisteredPushExtIdRef.current === externalUserId) return;

    let playerId = isPushPermissionGranted() ? getPushSubscriptionId() : null;
    if (!playerId && !hasPromptedForPushRef.current) {
      hasPromptedForPushRef.current = true;
      playerId = await requestPushPermission();
    }
    if (!playerId) return;

    lastRegisteredPushExtIdRef.current = externalUserId;
    await registerPushToken(playerId).catch((error) => {
      console.error("Failed to register push token", error);
    });
  }, []);

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

    const mappedVenue = venueMap.get(selectedVenueId);
    if (mappedVenue) {
      return mappedVenue;
    }

    if (sharedVenue && getVenueId(sharedVenue) === selectedVenueId) {
      return sharedVenue;
    }

    return null;
  }, [selectedVenueId, sharedVenue, venueMap]);

  type ResultItem =
    | { type: "venue"; venue: GenieVenue }
    | { type: "event"; event: NonNullable<GenieResponseEnvelope["events"]>[number] };

  const allVenues = useMemo<GenieVenue[]>(() => {
    if (!response) {
      return [];
    }

    return [...response.decisive, ...response.more_nearby];
  }, [response]);

  const decisionItems = useMemo<ResultItem[]>(() => {
    if (!response) {
      return [];
    }

    const events = response.events ?? [];
    const venues = allVenues;

    const mapVenueItems = (venueList: GenieVenue[]) =>
      venueList.map((venue) => ({ type: "venue", venue } as const));

    const mapEventItems = (
      eventList: NonNullable<GenieResponseEnvelope["events"]>[number][]
    ) => eventList.map((event) => ({ type: "event", event } as const));

    if (queryMode === "venue") {
      return mapVenueItems(venues.slice(0, 3));
    }

    if (queryMode === "event") {
      return mapEventItems(events.slice(0, 3));
    }

    const useEventsFirst = events.length >= venues.length;
    if (useEventsFirst) {
      return [
        ...mapEventItems(events.slice(0, 2)),
        ...mapVenueItems(venues.slice(0, 1)),
      ];
    }

    return [
      ...mapVenueItems(venues.slice(0, 2)),
      ...mapEventItems(events.slice(0, 1)),
    ];
  }, [allVenues, queryMode, response]);

  const interleave = useCallback(
    (
      venues: GenieVenue[],
      events: NonNullable<GenieResponseEnvelope["events"]>[number][]
    ) => {
      const result: ResultItem[] = [];
      const max = Math.max(venues.length, events.length);
      for (let i = 0; i < max; i += 1) {
        if (venues[i]) {
          result.push({ type: "venue", venue: venues[i] });
        }
        if (events[i]) {
          result.push({ type: "event", event: events[i] });
        }
      }
      return result;
    },
    []
  );

  const moreNearbyItems = useMemo<ResultItem[]>(() => {
    if (!response) {
      return [];
    }

    const events = response.events ?? [];
    const venues = allVenues;

    if (queryMode === "venue") {
      return venues.slice(3, 15).map((venue) => ({ type: "venue", venue }));
    }

    if (queryMode === "event") {
      return events.slice(3, 10).map((event) => ({ type: "event", event }));
    }

    const useEventsFirst = events.length >= venues.length;
    if (useEventsFirst) {
      return interleave(venues.slice(1), events.slice(2));
    }

    return interleave(venues.slice(2), events.slice(1));
  }, [allVenues, queryMode, response]);

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
    setActiveScreen("homescreen");
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

  // Magic-link verification gate: a user who finished the onboarding wizard but
  // hasn't clicked their link has no auth token. Block gated actions and show
  // the resend prompt. Returns true when the gate was shown (caller aborts).
  const maybeBlockForVerification = useCallback((): boolean => {
    if (account) {
      if (isAuthChecked && account.verified === false) {
        setOnboardingEmail(account.email);
        setVerifyGateOpen(true);
        return true;
      }
      return false;
    }
    if (readAuthToken()) {
      return false;
    }
    const pending = readOnboardingPending();
    if (!pending || pending.verified) {
      return false;
    }
    setOnboardingEmail(pending.email);
    setVerifyGateOpen(true);
    return true;
  }, [account, isAuthChecked]);

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

  const loadOffersAndRedemptions = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force === true;
    // Previously guarded on offersLoadedRef so the offers list only ever
    // loaded once per session — which meant the daily 24h refresh never
    // surfaced and users saw "already redeemed" forever. Always fetch on
    // screen entry; skip only when we recently finished loading AND the
    // caller didn't explicitly request a force refresh.
    if (!account) {
      return;
    }
    void force;

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

  useEffect(() => {
    if (!account) return;
    fetchUnreadNotifCount()
      .then((r) => setUnreadNotifCount(r.unread_count ?? 0))
      .catch(() => {});
  }, [account]);

  // Keep the homescreen message badge live: fetch on load, poll while the app
  // is open, and refetch on every screen change (so a recipient sees a new
  // message's badge, and it clears right after reading a thread + navigating
  // back). The unread count has no dedicated endpoint — it's derived from the
  // thread list — so this is intentionally lightweight, not per-second.
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    const refresh = () => {
      fetchUnreadMessageCount(account.id)
        .then((count) => {
          if (!cancelled) setUnreadMessageCount(count);
        })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [account, activeScreen]);

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
    source: "typed" | "chip" | "voice",
    overrideCoords?: { latitude: number; longitude: number } | null
  ) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    if (maybeBlockForVerification()) {
      return;
    }

    screenHistoryRef.current = ["homescreen"];
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

    // Location priority (see bug: previously device location always won):
    //   1. Explicit city in the message ("happy hour in Houston") — ignore coords
    //   2. Session city carried over from the last query
    //   3. "near me" + device coords
    //   4. Device coords as last-resort signal so the backend can infer a city
    const explicitCity = extractCityFromMessage(trimmed);
    const isNearMe = mentionsNearMe(trimmed);
    const cityForQuery = explicitCity ?? (isNearMe ? null : sessionCity);
    const shouldUseCoords = !cityForQuery; // city always beats coords
    const shouldFetchCoords = shouldUseCoords;

    // Try to attach fresh coords on every query. If we already have them, reuse;
    // otherwise ask the browser (resolves to null quickly if denied/unavailable
    // so we never block the query). Skip entirely when an explicit/session city
    // already determined where to search.
    const resolvedCoords = await (async () => {
      if (overrideCoords) return overrideCoords;
      if (!shouldFetchCoords) return null;
      if (userCoords) return userCoords;
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        return null;
      }
      return await new Promise<{ latitude: number; longitude: number } | null>(
        (resolve) => {
          let settled = false;
          const finish = (value: { latitude: number; longitude: number } | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const next = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              };
              setUserCoords(next);
              setLocationGranted(true);
              finish(next);
            },
            () => finish(null),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 }
          );
          // Hard cap so a hung permission prompt never stalls the query.
          setTimeout(() => finish(null), 5500);
        }
      );
    })();

    try {
      console.log("NEAR ME DEBUG:", {
        hasCoords: Boolean(resolvedCoords),
        lat: resolvedCoords?.latitude,
        lng: resolvedCoords?.longitude,
        cityContext: cityForQuery,
        isNearMe,
      });
      const nextResponse = await callGenie(trimmed, {
        coords: resolvedCoords
          ? { lat: resolvedCoords.latitude, lng: resolvedCoords.longitude }
          : null,
        radiusMeters: 2500,
        cityContext: cityForQuery ?? undefined,
        includeCoords: shouldUseCoords,
      });
      setResponse(nextResponse);
      setQueryMode(
        nextResponse.query_mode === "event" || nextResponse.query_mode === "both"
          ? nextResponse.query_mode
          : "venue"
      );
      // Remember the resolved city so the next query without an explicit city
      // stays anchored to it.
      const resolvedSessionCity =
        explicitCity ??
        (!isNearMe &&
        typeof nextResponse.city_context === "string" &&
        nextResponse.city_context.trim().length > 0
          ? nextResponse.city_context
          : null);
      if (resolvedSessionCity) {
        setSessionCity(resolvedSessionCity);
      }
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

  // Auto-fire query from ?q= URL param (used by World Cup page CTAs)
  useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("q");
    if (!q || !q.trim()) return;
    url.searchParams.delete("q");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    const timer = setTimeout(() => {
      void handleQuery(q.trim(), "chip");
    }, 600);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      setPendingTranscript(true);
      // Return to home so the user can confirm/cancel the heard transcript
      // before Genie actually submits it.
      setActiveScreen("home");
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
    // Verification gate takes precedence: an unverified onboarded user must
    // click their magic link before opening a detail screen.
    if (maybeBlockForVerification()) {
      return;
    }
    // Account Intro gate: on the Decision screen, after the user has completed
    // at least two queries, the first venue tap by an unauthenticated user
    // takes them to the Account Intro instead of the detail view.
    if (source === "decision" && !account && queryCount >= 2) {
      maybeTriggerSignup("second_query");
      return;
    }
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
  };

  const gateDetailTap = useCallback(
    (handler: () => void) => () => {
      if (!account) {
        maybeTriggerSignup("venue_tap");
        return;
      }
      handler();
    },
    [account, maybeTriggerSignup]
  );

  const handleSaveVenue = async (venue: GenieVenue) => {
    if (maybeBlockForVerification()) {
      return;
    }

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
        logVenueInteraction("unsave", venueId, activeScreen);
        const nextVenues = savedVenues.filter(
          (savedVenue) => getVenueId(savedVenue) !== id
        );
        setSavedVenues(nextVenues);
        setSavedVenueIds(syncSavedVenueIds(nextVenues));
      } else {
        await saveVenueForUser(venueId);
        logVenueInteraction("save", venueId, activeScreen);
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

  const handleToggleCheckin = async (venue: GenieVenue) => {
    if (checkinBusy) return;
    if (!account || !readAuthToken()) {
      maybeTriggerSignup("checkin_attempt");
      return;
    }

    const venueId = Number(venue.id);
    const isCheckedIn = checkedInVenueIds.includes(venueId);

    setCheckinBusy(true);
    try {
      if (isCheckedIn) {
        await checkOutOfVenue(venueId);
        logVenueInteraction("checkout", venueId, activeScreen);
        setCheckedInVenueIds((prev) => prev.filter((id) => id !== venueId));
        setVenueActiveCheckins((prev) => (prev != null ? Math.max(0, prev - 1) : prev));
      } else {
        const result = await checkInToVenue(venueId);
        logVenueInteraction("checkin", venueId, activeScreen);
        setCheckedInVenueIds((prev) => (prev.includes(venueId) ? prev : [...prev, venueId]));
        // Xano returns already_checked_in when a stale local state missed an
        // existing session — don't double-count in that case.
        if (!result.already_checked_in) {
          setVenueActiveCheckins((prev) => (prev != null ? prev + 1 : prev));
        }
      }
    } catch (error) {
      console.error("Failed to update check-in", error);
      setStatusMessage("Could not update check-in right now.");
    } finally {
      setCheckinBusy(false);
    }
  };

  const handleShareVenue = async (venue: GenieVenue) => {
    const venueId = getVenueId(venue);
    const text = `Check out ${venue.venue_name} on Genie by Social Bevy`;
    const url = `${getAppOrigin()}/venue/${venueId}`;

    try {
      await shareLink({
        title: `${venue.venue_name} - Genie by Social Bevy`,
        text,
        url,
      });
    } catch (error) {
      console.error("Share failed", error);
    }

    trackShare(venueId);
  };

  const handleShareApp = async () => {
    try {
      await shareLink({
        title: "Genie by Social Bevy",
        text: "Discover food, drinks, offers, and things to do with Genie by Social Bevy.",
        url: getAppOrigin(),
      });
    } catch (error) {
      console.error("App share failed", error);
    }
  };

  const handleRedeemOffer = useCallback(
    async (offer: VibeeOffer) => {
      if (maybeBlockForVerification()) {
        return;
      }
      if (!account || account.membership !== "vibee") {
        setStatusMessage("Upgrade to V.I.Bee to redeem offers.");
        navigateTo("account");
        return;
      }

      setRedeemingOfferId(offer.id);
      setStatusMessage(null);

      try {
        const redemption = await redeemVibeeOffer(offer.id);
        const venueMatch = selectedVenue && Number(selectedVenue.id) === offer.vendor_id
          ? selectedVenue
          : null;
        setActiveRedemption({
          offer_id: offer.id,
          offer_title: redemption.offer_title,
          offer_type: offer.offer_type,
          offer_description: offer.description,
          offer_terms: offer.redeem_instructions,
          discount_value: offer.discount_value,
          vendor_id: offer.vendor_id,
          venue_name: venueMatch?.venue_name,
          venue_image: venueMatch?.image ?? undefined,
          venue_rating: venueMatch?.google_rating ?? undefined,
          venue_review_count: venueMatch?.google_user_ratings_total ?? undefined,
          venue_neighborhood:
            venueMatch?.area_neighborhood || venueMatch?.city || undefined,
          verify_url: redemption.verify_url,
          redeemed_at: redemption.redeemed_at,
          redemption_token: redemption.redemption_token,
        });
        setRedemptionOutcome(null);

        void trackSocialSignal({
          signal_type: "offer_redeem",
          signal_value: String(offer.id),
          city: config.cityLabel,
        }).catch(() => {});

        const refreshed = await fetchUserRedemptions().catch(() => null);
        if (refreshed?.redemptions) {
          setRedemptions(refreshed.redemptions);
        }

        setStatusMessage(null);
        navigateTo("offer-activated");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not redeem this offer right now.";

        if (isAlreadyRedeemedMessage(message)) {
          const existing = redemptions.find((r) => r.offer_id === offer.id) ?? null;
          const redemptionMs =
            existing && existing.redeemed_at
              ? existing.redeemed_at < 1_000_000_000_000
                ? existing.redeemed_at * 1000
                : existing.redeemed_at
              : Date.now();
          const venueMatch =
            selectedVenue && Number(selectedVenue.id) === offer.vendor_id ? selectedVenue : null;

          setActiveRedemption({
            offer_id: offer.id,
            offer_title: offer.title,
            offer_type: offer.offer_type,
            offer_description: offer.description,
            offer_terms: offer.redeem_instructions,
            discount_value: offer.discount_value,
            vendor_id: offer.vendor_id,
            venue_name: venueMatch?.venue_name ?? offer.venue_name,
            venue_image: venueMatch?.image ?? offer.venue_image ?? undefined,
            venue_rating: venueMatch?.google_rating ?? offer.venue_rating ?? undefined,
            venue_review_count:
              venueMatch?.google_user_ratings_total ?? offer.venue_review_count ?? undefined,
            venue_neighborhood:
              venueMatch?.area_neighborhood ??
              venueMatch?.city ??
              offer.venue_neighborhood ??
              undefined,
            verify_url: (existing as { verify_url?: string } | null)?.verify_url ?? "",
            redeemed_at: redemptionMs,
            redemption_token: existing?.redemption_token ?? "",
          });
          setRedemptionOutcome("already_redeemed");
          setStatusMessage(null);
          navigateTo("offer-activated");

          void fetchUserRedemptions()
            .then((refreshed) => setRedemptions(refreshed.redemptions ?? []))
            .catch(() => null);
          return;
        }

        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes("expired")) {
          setRedemptionOutcome("expired");
          navigateTo("offer-activated");
        } else {
          setStatusMessage(message);
        }
      } finally {
        setRedeemingOfferId(null);
      }
    },
    [account, config.cityLabel, navigateTo, redemptions, selectedVenue]
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
      // During the onboarding wizard, "Next" advances to the role identifier
      // (Step 3) instead of bouncing home. Outside onboarding (e.g. "Tune my
      // preferences") it returns home so the button still progresses the flow.
      if (isOnboarding) {
        navigateTo("role-identifier");
      } else {
        navigateTo("home", false);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save preferences right now.";
      setStatusMessage(message);
    } finally {
      setSocialSaving(false);
    }
  }, [socialProfile, navigateTo, isOnboarding]);

  useEffect(() => {
    trackHomeScreenViewed();
    setAccount(readConsumerAccount());
    void (async () => {
      const url = new URL(window.location.href);
      // Handle both ?token= and ?/token= (Xano sometimes prepends a slash)
      const magicToken = url.searchParams.get("token") ?? url.searchParams.get("/token");

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

          // Magic link clicked → the account is verified. Clear the pending
          // state and dismiss the wizard/gate so they never show again.
          writeOnboardingPending(null);
          setIsOnboarding(false);
          setVerifyGateOpen(false);

          // Preserve the latest documented behavior: remove the token from the URL
          // immediately after a successful exchange.
          url.searchParams.delete("token");
          window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
          setLoginSuccessSheetOpen(true);

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

          // Sync onboarding role selections to genie_user now that the
          // account row exists (magic link click creates it).
          const savedRoles = readSelectedRoles();
          if (savedRoles.length > 0) {
            setUserRoles(savedRoles).catch(() => {});
          }
          try {
            const rawDetails = window.localStorage.getItem(
              "genie_onboarding_role_details_v1"
            );
            if (rawDetails) {
              const details = JSON.parse(rawDetails) as {
                brandName?: string;
                producerHandle?: string;
                influencerHandle?: string;
              };
              if (
                (details.brandName || details.producerHandle) &&
                savedRoles.includes("producer")
              ) {
                saveProducerDetails({
                  brand_name: details.brandName,
                  producer_handle: details.producerHandle,
                }).catch(() => {});
              }
              if (
                details.influencerHandle &&
                savedRoles.includes("influencer")
              ) {
                saveInfluencerDetails({
                  influencer_handle: details.influencerHandle,
                }).catch(() => {});
              }
              window.localStorage.removeItem("genie_onboarding_role_details_v1");
            }
          } catch {
            // best-effort
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
      activeScreen === "redemptions" ||
      activeScreen === "offer-activated" ||
      activeScreen === "dashboard" ||
      activeScreen === "membership"
    ) {
      void loadOffersAndRedemptions();
    }
  }, [activeScreen, loadOffersAndRedemptions]);

  useEffect(() => {
    if (activeScreen === "preferences" || activeScreen === "profile") {
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
    setSharedVenue((previous) => {
      if (!previous || !selectedVenueId) {
        return previous;
      }

      return getVenueId(previous) === selectedVenueId ? previous : null;
    });
  }, [selectedVenueId]);

  useEffect(() => {
    if (
      activeScreen !== "detail" ||
      !selectedVenueId ||
      venueMap.has(selectedVenueId)
    ) {
      return;
    }

    let cancelled = false;
    setSharedVenueLoading(true);

    void fetchVenueById(selectedVenueId)
      .then((venue) => {
        if (cancelled) {
          return;
        }
        setSharedVenue(venue);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load shared venue", error);
        setSharedVenue(null);
      })
      .finally(() => {
        if (!cancelled) {
          setSharedVenueLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeScreen, selectedVenueId, venueMap]);

  // Load this venue's check-in state whenever the detail screen opens for it.
  useEffect(() => {
    if (activeScreen !== "detail" || !selectedVenue || !account || !readAuthToken()) {
      return;
    }

    let cancelled = false;
    const venueId = Number(selectedVenue.id);

    void fetchVenueCheckins(venueId)
      .then((result) => {
        if (cancelled) return;
        setVenueActiveCheckins(result.active_checkins ?? 0);
        setCheckedInVenueIds((prev) => {
          const withoutThis = prev.filter((id) => id !== venueId);
          return result.user_is_checked_in ? [...withoutThis, venueId] : withoutThis;
        });
      })
      .catch((error) => {
        console.error("Failed to load check-in state", error);
      });

    return () => {
      cancelled = true;
    };
  }, [activeScreen, selectedVenue, account]);

  useEffect(() => {
    if (
      activeScreen !== "detail" ||
      !selectedVenueId ||
      selectedVenue ||
      sharedVenueLoading ||
      !isAuthChecked
    ) {
      return;
    }

    setStatusMessage("That venue was not found. Try searching again.");
    setActiveScreen("home");
  }, [activeScreen, isAuthChecked, selectedVenue, selectedVenueId, sharedVenueLoading]);

  // Keep the address bar in sync with the active screen so leaving the venue
  // detail (e.g. tapping Home) drops the /venue/<id> path. Only the detail
  // screen owns a deep URL — every other screen renders at "/".
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const { pathname, search, hash } = window.location;
    const onVenuePath = pathname.startsWith("/venue/");
    const desiredVenuePath =
      activeScreen === "detail" && selectedVenueId
        ? `/venue/${selectedVenueId}`
        : null;

    if (desiredVenuePath) {
      if (pathname !== desiredVenuePath) {
        window.history.replaceState({}, "", `${desiredVenuePath}${search}${hash}`);
      }
      return;
    }

    if (onVenuePath) {
      window.history.replaceState({}, "", `/${search}${hash}`);
    }
  }, [activeScreen, selectedVenueId]);

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

  // ── Geolocation permission ──
  // On mount, find out whether the browser already has a real answer
  // ("granted"/"denied") via the Permissions API. Safari doesn't support
  // that API, so there we can only tell "prompt" (never asked) apart from
  // "granted" once we've actually fetched a position — a real prior denial
  // looks the same as never-asked on Safari, which is an accepted gap.
  // A separate effect (below, keyed on geoPermissionState + account) decides
  // whether/which location-prompt banner to show from this result.
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGeoPermissionState("denied");
      return;
    }

    const dismissedKey = "genie_location_prompt_dismissed_v1";

    type PermissionStatusLike = {
      state: "granted" | "denied" | "prompt";
      addEventListener?: (type: "change", listener: () => void) => void;
    };
    type PermissionsLike = {
      query: (descriptor: { name: "geolocation" }) => Promise<PermissionStatusLike>;
    };
    const permissionsApi = (navigator as Navigator & { permissions?: PermissionsLike })
      .permissions;

    const onGranted = (latitude: number, longitude: number) => {
      setLocationGranted(true);
      setUserCoords({ latitude, longitude });
      setGeoPermissionState("granted");
      window.localStorage.setItem(dismissedKey, "1");
    };

    const askNow = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => onGranted(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          // User denied or error - mark dismissed so we don't keep asking.
          // A real PERMISSION_DENIED means the browser won't show its native
          // prompt again on this device/browser until the user changes site
          // settings themselves — remember that so we stop offering a dead
          // "Allow" button on every future visit (works the same on Safari,
          // since this is our own request, not the Permissions API).
          if (err.code === err.PERMISSION_DENIED) {
            window.localStorage.setItem("genie_geo_hard_denied_v1", "1");
          }
          setGeoPermissionState("denied");
          window.localStorage.setItem(dismissedKey, "1");
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
      );
    };

    if (permissionsApi?.query) {
      permissionsApi
        .query({ name: "geolocation" })
        .then((status) => {
          if (status.state === "granted") {
            navigator.geolocation.getCurrentPosition(
              (pos) => onGranted(pos.coords.latitude, pos.coords.longitude),
              () => {
                setLocationGranted(true);
                setGeoPermissionState("granted");
              }
            );
          } else {
            if (status.state === "denied") {
              window.localStorage.setItem("genie_geo_hard_denied_v1", "1");
            }
            setGeoPermissionState(status.state);
          }
        })
        .catch(() => setGeoPermissionState("prompt"));
    } else {
      // No Permissions API (Safari) — treat as "prompt" so the banner logic
      // below still offers to ask; requesting will resolve the real state.
      setGeoPermissionState("prompt");
    }

    // Expose askNow on the ref so the banner can call it
    (window as Window & { __genieAskLocation?: () => void }).__genieAskLocation =
      askNow;

    return () => {
      delete (window as Window & { __genieAskLocation?: () => void })
        .__genieAskLocation;
    };
  }, []);

  // ── Location-prompt banner variant ──
  // Decides whether to show the location-ask banner, and which copy, once
  // both the permission check and the account load have settled.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (geoPermissionState === "unknown" || geoPermissionState === "granted") {
      setLocationPromptVariant(null);
      return;
    }

    const hardDenied =
      window.localStorage.getItem("genie_geo_hard_denied_v1") === "1";
    if (hardDenied) {
      // We know for certain the browser will never show its native prompt
      // again — showing "Allow" every session (guest or registered) would
      // just be a dead button. Surface a one-time notice pointing at browser
      // settings instead, then leave it alone for good.
      const noticeDismissed =
        window.localStorage.getItem(
          "genie_geo_hard_denied_notice_dismissed_v1"
        ) === "1";
      setLocationPromptVariant(noticeDismissed ? null : "blocked");
      return;
    }

    if (account) {
      // Registered users: re-ask each new browser session until granted —
      // dismissing only silences it for the current tab session.
      const sessionDismissed =
        window.sessionStorage.getItem(
          "genie_location_prompt_session_dismissed_v1"
        ) === "1";
      setLocationPromptVariant(sessionDismissed ? null : "registered");
    } else {
      // Guests: ask once ever. If they've already dismissed/denied, don't
      // nag again — they'll be asked for a city by name instead.
      const dismissed =
        window.localStorage.getItem("genie_location_prompt_dismissed_v1") ===
        "1";
      setLocationPromptVariant(dismissed ? null : "guest");
    }
  }, [geoPermissionState, account]);

  const requestLocationPermission = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }
    // Call getCurrentPosition directly so the click always triggers the
    // browser permission prompt (when permission is in "prompt" state) and
    // we don't depend on the banner-effect ref being initialized.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocationGranted(true);
        setGeoPermissionState("granted");
        setLocationPromptVariant(null);
        window.localStorage.setItem("genie_location_prompt_dismissed_v1", "1");
      },
      (err) => {
        // Permission denied or unavailable. A real PERMISSION_DENIED means
        // the browser won't show its native prompt again — remember that
        // permanently so we stop offering a dead "Allow" button on future
        // visits, instead of just silencing this one session/device pair.
        if (err.code === err.PERMISSION_DENIED) {
          window.localStorage.setItem("genie_geo_hard_denied_v1", "1");
          alert(
            "Location is blocked for this site. Enable it in your browser settings, then try again."
          );
        }
        setGeoPermissionState("denied");
        // Guests are asked once ever (localStorage); registered users are
        // only silenced for this tab session so they get re-asked later.
        if (account) {
          window.sessionStorage.setItem(
            "genie_location_prompt_session_dismissed_v1",
            "1"
          );
        } else {
          window.localStorage.setItem("genie_location_prompt_dismissed_v1", "1");
        }
        setLocationPromptVariant(null);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  }, [account]);

  const dismissLocationPrompt = useCallback(() => {
    if (typeof window !== "undefined") {
      if (locationPromptVariant === "blocked") {
        // One-time notice — once acknowledged, never show it again for
        // either guest or registered users on this device/browser.
        window.localStorage.setItem(
          "genie_geo_hard_denied_notice_dismissed_v1",
          "1"
        );
      } else if (account) {
        window.sessionStorage.setItem(
          "genie_location_prompt_session_dismissed_v1",
          "1"
        );
      } else {
        window.localStorage.setItem("genie_location_prompt_dismissed_v1", "1");
      }
    }
    setLocationPromptVariant(null);
  }, [account, locationPromptVariant]);

  // Surface the location ask when a query has a near-me intent (chip tap or
  // the phrase "near me" in typed/voice input). No-op if already granted.
  // Guests who already dismissed permanently aren't re-asked (they'll be
  // asked for a city by name instead); registered users are re-surfaced even
  // if silenced for the session, since an explicit "near me" ask warrants it.
  // If we already know the browser hard-denied, don't offer a dead "Allow"
  // button here either — respect the one-time "blocked" notice dismissal.
  const maybeAskLocationForIntent = useCallback(
    (text: string, source: "chip" | "typed" | "voice") => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) return;
      if (locationGranted) return;
      const isNearMeIntent =
        source === "chip" || /\bnear me\b/i.test(text ?? "");
      if (!isNearMeIntent) return;
      const hardDenied =
        window.localStorage.getItem("genie_geo_hard_denied_v1") === "1";
      if (hardDenied) {
        const noticeDismissed =
          window.localStorage.getItem(
            "genie_geo_hard_denied_notice_dismissed_v1"
          ) === "1";
        if (noticeDismissed) return;
        setLocationPromptVariant("blocked");
        return;
      }
      if (account) {
        setLocationPromptVariant("registered");
      } else {
        const dismissed =
          window.localStorage.getItem("genie_location_prompt_dismissed_v1") ===
          "1";
        if (dismissed) return;
        setLocationPromptVariant("guest");
      }
    },
    [locationGranted, account]
  );

  // Deep-link: `?screen=offers|redemptions|dashboard|saved|vendor|profile|membership`
  useEffect(() => {
    const url = new URL(window.location.href);
    const screen = url.searchParams.get("screen");
    if (!screen) return;
    const allowed: ReadonlyArray<FlowAnchor> = [
      "offers",
      "redemptions",
      "dashboard",
      "saved",
      "vendor",
      "profile",
      "membership",
      "preferences",
      "event-survey",
      "role-identifier",
      "role-setup",
      "onboarding-complete",
      "messages",
    ];
    if (screen === "conversation") {
      const threadType = url.searchParams.get("thread_type");
      const producerId = url.searchParams.get("producer_id");
      const threadIdParam = url.searchParams.get("thread_id");
      const counterpartName = url.searchParams.get("counterpart_name");
      if (threadType === "producer" && producerId && !isNaN(Number(producerId))) {
        setActiveConversation({
          threadId: null,
          threadType: "producer",
          counterpartId: Number(producerId),
          counterpartName: counterpartName ?? undefined,
        });
        navigateTo("conversation");
      } else if (
        threadType === "user" &&
        threadIdParam &&
        !isNaN(Number(threadIdParam))
      ) {
        // Notification tap into a 1:1 DM: we only have thread_id. Open the chat
        // immediately (history loads by thread_id + clears unread), then resolve
        // the counterpart (name/avatar/id, needed for the header and replies)
        // from the thread list. Use the stored account id so this is correct
        // even before React state hydrates on a cold notification open.
        const tid = Number(threadIdParam);
        setActiveConversation({
          threadId: tid,
          threadType: "user",
          counterpartId: 0,
          counterpartName: counterpartName ?? undefined,
        });
        navigateTo("conversation");
        const selfId = readConsumerAccount()?.id;
        void fetchMessageThreads("user", 1, 100)
          .then((raw) => {
            const conv = mergeThreadsToConversations(raw, selfId).find(
              (c) => c.threadType === "user" && c.threadId === tid
            );
            if (!conv) return;
            setActiveConversation((prev) =>
              prev && prev.threadId === tid
                ? {
                    ...prev,
                    counterpartId: conv.counterpartId,
                    counterpartName: conv.counterpartName ?? prev.counterpartName,
                    counterpartAvatarUrl: conv.counterpartAvatarUrl,
                    viewerRole: conv.viewerRole,
                  }
                : prev
            );
          })
          .catch(() => {});
      }
    } else if (screen === "login") {
      // Public pages outside the SPA (event/venue/producer/post microsites)
      // send logged-out visitors here as `/?screen=login&redirect=<path>`
      // when they tap a gated action. `redirect` previously went nowhere —
      // "login" isn't a FlowAnchor, so it silently no-opped below, and even
      // when it did resolve nothing ever read `redirect` back. Stash the
      // target (same-origin relative paths only, to avoid an open redirect)
      // and open the login screen; the post-login effect below forwards them.
      const redirectTarget = url.searchParams.get("redirect");
      if (
        redirectTarget &&
        redirectTarget.startsWith("/") &&
        !redirectTarget.startsWith("//") &&
        !redirectTarget.includes("://")
      ) {
        window.sessionStorage.setItem("genie_post_login_redirect", redirectTarget);
      }
      navigateTo("account");
    } else if (screen === "event") {
      // Standalone pages outside the SPA (producer profile, notifications, etc.)
      // link here as `/?screen=event&event_id=<id>` since there's no public
      // per-id event route. Seed minimal initialData — EventDetailSection
      // fetches the full record itself via its own eventId effect.
      const eventIdParam = url.searchParams.get("event_id");
      const eventId = eventIdParam ? Number(eventIdParam) : NaN;
      if (Number.isFinite(eventId) && eventId > 0) {
        setSelectedEventId(eventId);
        setSelectedEvent({ id: eventId });
        navigateTo("event-detail");
      }
    } else if (allowed.includes(screen as FlowAnchor)) {
      navigateTo(screen as FlowAnchor);
    }
    url.searchParams.delete("screen");
    url.searchParams.delete("redirect");
    url.searchParams.delete("thread_type");
    url.searchParams.delete("producer_id");
    url.searchParams.delete("thread_id");
    url.searchParams.delete("counterpart_name");
    url.searchParams.delete("event_id");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }, [navigateTo]);

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

  // Account Intro is NOT triggered on query count or browse count alone.
  // It's gated to the moment the user taps a venue on the Decision screen
  // after completing their second (or later) query — see selectVenue below.
  void browseCount;

  // Post-login redirect for the Vendor Dashboard entry point: when a logged-
  // out user taps "Vendor Dashboard" we stash an intent flag and send them
  // through the magic-link login. Once the session is hydrated, forward
  // them to the vendor flow — VendorSection itself decides dashboard vs.
  // claim based on whether the account has a vendor_id.
  useEffect(() => {
    if (!account || typeof window === "undefined") return;
    const target = window.sessionStorage.getItem("genie_post_login_target");
    if (target !== "vendor") return;
    window.sessionStorage.removeItem("genie_post_login_target");
    navigateTo("vendor");
  }, [account, navigateTo]);

  // Post-login redirect for public microsites (event/venue/producer/post
  // detail pages): those pages send a logged-out visitor to
  // `/?screen=login&redirect=<path>` (stashed into sessionStorage by the
  // `screen === "login"` branch above) when a gated action is tapped. Once
  // the session hydrates, forward them back to that exact page.
  useEffect(() => {
    if (!account || typeof window === "undefined") return;
    const target = window.sessionStorage.getItem("genie_post_login_redirect");
    if (!target) return;
    window.sessionStorage.removeItem("genie_post_login_redirect");
    router.push(target);
  }, [account, router]);

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

    void syncPushRegistration();
  }, [response, syncPushRegistration]);

  // Register (or re-register) this device for push as soon as we have a
  // logged-in account, so message pushes reach users who go straight to
  // messaging — not just those who run a Genie search. Re-runs on login when
  // account.id becomes available (or changes from guest to real user).
  useEffect(() => {
    if (!account?.id) return;
    void syncPushRegistration();
  }, [account?.id, syncPushRegistration]);

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
    music_tags: "Music",
    bevy_bites_tags: "Bevy Bites",
    experiences_tags: "Experiences",
    atmosphere_tags: "Atmosphere",
    community_tags: "Community",
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
  // Uber deeplink — same construction as the standalone venue page (VenueDetailClient.tsx).
  const uberUrl =
    selectedVenue && selectedVenue.latitude != null && selectedVenue.longitude != null
      ? `uber://?dropoff[lat]=${selectedVenue.latitude}&dropoff[lng]=${selectedVenue.longitude}&dropoff[nickname]=${encodeURIComponent(selectedVenue.venue_name)}`
      : null;
  const detailActions: Array<{
    id: string;
    label: string;
    variant: "primary" | "secondary";
    onClick: () => void;
  }> = selectedVenue
    ? [
        ...(uberUrl
          ? [
              {
                id: "ride",
                label: "Get a Ride",
                variant: "secondary" as const,
                onClick: () => {
                  logVendorInteraction("ride_click", Number(selectedVenue.id));
                  logVenueInteraction("ride", Number(selectedVenue.id), "detail");
                  window.open(uberUrl, "_blank", "noopener,noreferrer");
                },
              },
            ]
          : []),
        ...(nativeMapsUrl
          ? [
              {
                id: "directions",
                label: "Directions",
                variant: "secondary" as const,
                onClick: () => {
                  trackEvent(analyticsEvents.mapOpen, {
                    venueId: getVenueId(selectedVenue),
                  });
                  trackEvent(analyticsEvents.vendorMapTap, {
                    venueId: getVenueId(selectedVenue),
                  });
                  logVendorInteraction("map_click", Number(selectedVenue.id));
                  logVenueInteraction("map", Number(selectedVenue.id), "detail");
                  window.open(nativeMapsUrl, "_blank", "noopener,noreferrer");
                },
              },
            ]
          : []),
        ...(selectedVenue.phone
          ? [
              {
                id: "call",
                label: "Call",
                variant: "secondary" as const,
                onClick: () => {
                  trackEvent(analyticsEvents.callClick, {
                    venueId: getVenueId(selectedVenue),
                  });
                  trackEvent(analyticsEvents.vendorCallTap, {
                    venueId: getVenueId(selectedVenue),
                  });
                  logVendorInteraction("call_click", Number(selectedVenue.id));
                  logVenueInteraction("call", Number(selectedVenue.id), "detail");
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
                label: "Reservations",
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
                  logVenueInteraction("reservation", Number(selectedVenue.id), "detail");
                  window.open(
                    selectedVenue.reservation_url!,
                    "_blank",
                    "noopener,noreferrer"
                  );
                },
              },
            ]
          : selectedVenue.website_url
            ? [
                {
                  id: "website",
                  label: "Website",
                  variant: "secondary" as const,
                  onClick: () => {
                    trackEvent(analyticsEvents.vendorWebsiteTap, {
                      venueId: getVenueId(selectedVenue),
                    });
                    logVendorInteraction("website_click", Number(selectedVenue.id));
                    window.open(
                      selectedVenue.website_url!,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  },
                },
              ]
            : []),
        {
          id: "share",
          label: "Share",
          variant: "secondary",
          onClick: () => {
            trackEvent(analyticsEvents.vendorShareTap, {
              venueId: getVenueId(selectedVenue),
            });
            logVendorInteraction("share", Number(selectedVenue.id));
            logVenueInteraction("share", Number(selectedVenue.id), "detail");
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
        case "messages":
          navigateTo("messages");
          break;
        case "membership":
          navigateTo("membership");
          break;
        case "offers":
          navigateTo("offers");
          break;
        case "redemptions":
          navigateTo("redemptions");
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
          // Role-aware routing:
          //  • logged in + vendorId  → VendorSection routes straight to dashboard
          //  • logged in, no vendorId → VendorSection shows "Claim your business"
          //  • logged out             → send to login (magic link); after auth
          //    hydration completes we'll forward them to Vendor Dashboard.
          if (!account) {
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem("genie_post_login_target", "vendor");
            }
            setIsDrawerOpen(false);
            navigateTo("account");
          } else {
            navigateTo("vendor");
          }
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
        case "switch-role":
          setIsDrawerOpen(false);
          setIsRoleSwitcherOpen(true);
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
        goBack("home");
        break;
      case "offer-detail":
        goBack("offers");
        break;
      case "offer-activated":
        setRedemptionOutcome(null);
        goBack("offer-detail");
        break;
      case "redemptions":
        goBack("home");
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
        case "event-detail":
  setSelectedEventSlug(null);
  setSelectedEventId(null);
  goBack("home");
  break;
case "event-survey":
  setSurveySubmitted(false);
  goBack("event-detail");
  break;
case "vibbee-trial":
  setTrialError(null);
  setTrialSuccess(false);
  goBack("account");
  break;
      case "producer-dashboard":
        goBack("home");
        break;
      case "influencer-dashboard":
        goBack("home");
        break;
      case "role-unlock":
        goBack("home");
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
    activeScreen !== "homescreen" &&
    activeScreen !== "vendor" &&
    activeScreen !== "account" &&
    activeScreen !== "profile" &&
    activeScreen !== "dashboard" &&
    activeScreen !== "contact" &&
    activeScreen !== "membership" &&
    activeScreen !== "offers" &&
    activeScreen !== "events-tab" &&
    activeScreen !== "offer-activated" &&
    activeScreen !== "offer-detail" &&
    activeScreen !== "redemptions" &&
    activeScreen !== "saved" &&
    activeScreen !== "event-detail" &&
activeScreen !== "event-survey" &&
activeScreen !== "vibbee-trial" &&
    activeScreen !== "role-identifier" &&
    activeScreen !== "role-setup" &&
    activeScreen !== "onboarding-complete" &&
    activeScreen !== "role-unlock" &&
    activeScreen !== "producer-dashboard" &&
    activeScreen !== "notifications" &&
    activeScreen !== "messages" &&
    activeScreen !== "conversation" &&
    activeScreen !== "detail";

  const isAiFallbackLayout =
    !isThinking &&
    !!nonStructuredResponse &&
    (nonStructuredResponse.response_mode === "city_unsupported" ||
      nonStructuredResponse.response_mode === "ai_fallback" ||
      nonStructuredResponse.response_mode === "supported_no_results");

  // Keep the dock available on every major destination screen, including the
  // landing screen, so users always have a consistent way to get back home or
  // jump into profile/account.
  const shouldShowFooter =
    activeScreen === "homescreen" ||
    activeScreen === "decision" ||
    activeScreen === "more" ||
    activeScreen === "detail" ||
    activeScreen === "saved" ||
    activeScreen === "dashboard" ||
    activeScreen === "offers" ||
    activeScreen === "events-tab" ||
    activeScreen === "offer-detail" ||
    activeScreen === "offer-activated" ||
    activeScreen === "redemptions" ||
    activeScreen === "profile" ||
    activeScreen === "notification-settings" ||
    activeScreen === "account" ||
    activeScreen === "membership" ||
    activeScreen === "contact" ||
    activeScreen === "preferences" ||
    activeScreen === "vendor" ||
    activeScreen === "producer-dashboard" ||
    activeScreen === "influencer-dashboard" ||
    activeScreen === "event-detail" ||
activeScreen === "event-survey" ||
activeScreen === "vibbee-trial" ||
    (activeScreen === "thinking" && isAiFallbackLayout);

  return (
    <main className={`relative flex h-dvh flex-col overflow-x-hidden ${activeScreen === "home" || activeScreen === "homescreen" || activeScreen === "listening" || activeScreen === "thinking" ? "overflow-y-hidden" : "overflow-y-auto"} bg-[url('/bg-white.png')] bg-cover bg-center bg-no-repeat px-4 pb-3 pt-3 dark:bg-[url('/bg.png')] dark:bg-cover dark:bg-center sm:px-6 sm:pb-4 sm:pt-5`}>
      <div className="pointer-events-none fixed inset-0 z-0 hidden bg-black/50 dark:block" />
      <DrawerMenu
        visible={isDrawerOpen}
        activeScreen={activeScreen}
        isLoggedIn={!!account}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={handleDrawerNavigate}
        onLogout={handleLogout}
        onLogin={() => { setIsDrawerOpen(false); navigateTo("account"); }}
        isVendor={!!account?.vendorId}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={() => setNotificationsEnabled((prev) => !prev)}
      />

      <LoginSuccessDialog
        visible={loginSuccessSheetOpen}
        onClose={() => setLoginSuccessSheetOpen(false)}
      />

      <RoleSwitcherDialog
        visible={isRoleSwitcherOpen}
        onClose={() => setIsRoleSwitcherOpen(false)}
        onNavigateToRole={(role) => {
          setIsRoleSwitcherOpen(false);
          const targets: Record<OnboardingRole, FlowAnchor> = {
            consumer: "dashboard",
            vendor: "vendor",
            producer: "producer-dashboard",
            influencer: "influencer-dashboard",
          };
          navigateTo(targets[role]);
        }}
        onUnlockNew={() => {
          setIsRoleSwitcherOpen(false);
          navigateTo("role-unlock");
        }}
      />

      <div className={`relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-3 ${activeScreen === "home" || activeScreen === "homescreen" || activeScreen === "listening" || activeScreen === "thinking" ? "min-h-0" : ""}`}>
        {locationPromptVariant && activeScreen === "home" ? (
          <div className="flex items-start gap-3 rounded-[18px] border border-[#E7070380] bg-transparent px-3 py-2.5 shadow-sm dark:border-white/15 dark:bg-black/30">
            <span className="mt-0.5 text-red-500 dark:text-[#ff9d7d]" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.82rem] font-semibold text-gray-900 dark:text-white">
                {locationPromptVariant === "blocked"
                  ? "Location is off for Genie"
                  : locationPromptVariant === "registered"
                  ? "Let Genie see what you see ✨"
                  : "Use your location?"}
              </p>
              <p className="mt-0.5 text-[0.72rem] leading-4 text-gray-500 dark:text-white/65">
                {locationPromptVariant === "blocked"
                  ? "Location is blocked for this site in your browser settings, so I can't ask again — flip it back on there for spot-on nearby picks."
                  : locationPromptVariant === "registered"
                  ? "You're already in the club — turn on location and I'll actually know what's near you, not just guess."
                  : "Genie can pick spots that are actually near you."}
              </p>
              <div className="mt-2 flex gap-2">
                {locationPromptVariant === "blocked" ? (
                  <button
                    type="button"
                    onClick={dismissLocationPrompt}
                    className="rounded-full border border-gray-300 px-3 py-1 text-[0.72rem] font-semibold text-gray-700 dark:border-white/25 dark:text-white/85"
                  >
                    Got it
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={requestLocationPermission}
                      className="rounded-full border border-red-500 bg-red-600 px-3 py-1 text-[0.72rem] font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                    >
                      Allow
                    </button>
                    <button
                      type="button"
                      onClick={dismissLocationPrompt}
                      className="rounded-full border border-gray-300 px-3 py-1 text-[0.72rem] font-semibold text-gray-700 dark:border-white/25 dark:text-white/85"
                    >
                      Not now
                    </button>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={dismissLocationPrompt}
              aria-label="Dismiss location prompt"
              className="-mr-1 -mt-1 flex h-6 w-6 items-center justify-center text-gray-400 dark:text-white/55"
            >
              <Image
                src="/icons/close.png"
                alt=""
                aria-hidden="true"
                width={14}
                height={14}
                className="h-3.5 w-3.5 object-contain opacity-70"
              />
            </button>
          </div>
        ) : null}

        {installPrompt && !isStandalone && activeScreen !== "detail" ? (
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
            {/* Listening and the AI-fallback/non-supported results variant of
                the thinking screen previously hid the back button, leaving the
                user stranded. Always render a back affordance when the top bar
                shows so every screen has consistent top-left navigation. */}
            <button
              type="button"
              onClick={
                activeScreen === "listening"
                  ? () => {
                      stopListeningSession();
                      goBack("home");
                    }
                  : handleTopBack
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82 dark:shadow-[0_20px_50px_rgba(0,0,0,0.36)]"
              aria-label="Go back"
            >
              <BackIcon size={20} />
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
            showBottomNav={shouldShowFooter}
            pendingTranscript={pendingTranscript}
            onMenuOpen={() => setIsDrawerOpen(true)}
            onShareApp={handleShareApp}
            onInputChange={(value) => {
              if (!hasTrackedTypingRef.current && value.trim().length > 0) {
                hasTrackedTypingRef.current = true;
                trackTypedQueryStarted();
              }

              // Once the user starts editing again, treat it as typed.
              if (pendingTranscript) {
                setPendingTranscript(false);
              }
              setInputValue(value);
            }}
            onChipSelect={(prompt) => {
              const chip =
                config.quickChips.find((item) => item.prompt === prompt) ?? null;
              if (chip) {
                trackQuickChipTapped(chip.label, chip.prompt);
              }

              setPendingTranscript(false);
              setInputValue(prompt);
              const isNearMeChip = /near me/i.test(prompt);
              if (isNearMeChip && "geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const coords = {
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                    };
                    setUserCoords(coords);
                    setLocationGranted(true);
                    void handleQuery(prompt, "chip", coords);
                  },
                  () => {
                    void handleQuery(prompt, "chip");
                  },
                  { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
                );
              } else {
                void handleQuery(prompt, "chip");
              }
            }}
            onOrbTap={startListening}
            onSubmit={() => {
              setPendingTranscript(false);
              maybeAskLocationForIntent(inputValue, "typed");
              void handleQuery(inputValue, "typed");
            }}
            onConfirmTranscript={() => {
              const value = inputValue.trim();
              setPendingTranscript(false);
              if (value) {
                maybeAskLocationForIntent(value, "voice");
                void handleQuery(value, "voice");
              }
            }}
            onCancelTranscript={() => {
              setPendingTranscript(false);
              setInputValue("");
            }}
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
                src="/icons/Social-Genie-Home-Screen.png"
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
            {/* For city_unsupported / ai_fallback, Figma calls for bubble +
                bulleted list only — no orb, no "Got it" header, no status text.
                We still show those while thinking is in-flight so the user has
                feedback during the request. */}
            {isAiFallbackLayout ? null : (
              <>
                {/* Header */}
                <h2 className="mt-1 font-[family:var(--font-display)] text-[1.4rem] font-semibold leading-[1.1] text-gray-900 dark:text-white sm:text-[1.7rem]">
                  Got it - looking for:
                </h2>
                <p className="mt-1 max-w-[28ch] text-[0.85rem] font-medium text-gray-600 dark:text-white/80">
                  {response?.normalized_intent || lastQuery || "Your next spot in Houston"}
                </p>

                {/* Girl + Orb — same size as HomeScreen */}
                <div className="relative mt-1 min-h-0 w-full flex-1 max-h-[48vh]">
                  <Image
                    src="/orb.png"
                    alt=""
                    aria-hidden="true"
                    width={520}
                    height={520}
                    className="pointer-events-none absolute left-[47%] top-1/2 z-0 h-auto w-full max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-95 animate-orbPulse"
                  />
                  <Image
                    src="/icons/Social-Genie-Home-Screen.png"
                    alt="Genie thinking"
                    width={520}
                    height={820}
                    className="relative z-10 mx-auto h-full w-auto max-w-[60%] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                  />
                </div>

                {/* Status text */}
                <p className="mt-1 shrink-0 text-[1.1rem] font-semibold text-gray-900 dark:text-white">
                  {isThinking ? "Say less... I got you!" : response?.reply || statusMessage}
                </p>
              </>
            )}

            {/* Non-structured responses — always text, no cards/images */}
            {nonStructuredResponse ? (
              <div className="mt-5 w-full space-y-3">
                {/* Reference: when `needs_location: true`, the user asked
                    "near me" but we never sent coords. Prompt them to enable. */}
                {nonStructuredResponse.needs_location ? (
                  <div className="rounded-[22px] border border-red-300 bg-red-50 px-4 py-3 text-left dark:border-white/10 dark:bg-black/24">
                    <p className="text-sm leading-6 text-gray-800 dark:text-white/82">
                      Genie needs your location for near-me searches.
                    </p>
                    <button
                      type="button"
                      onClick={requestLocationPermission}
                      className="mt-3 w-full rounded-[16px] border border-red-500 bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Enable location
                    </button>
                  </div>
                ) : null}
                {nonStructuredResponse.response_mode === "city_unsupported" ||
                nonStructuredResponse.response_mode === "ai_fallback" ||
                nonStructuredResponse.response_mode === "supported_no_results" ? (
                  (() => {
                    const fallbackIntroByMode =
                      nonStructuredResponse.response_mode === "supported_no_results"
                        ? `I'm not fully built out in that area yet, but here are a few spots I found in ${nonStructuredResponse.city_context || "your city"}.`
                        : `Genie is not live in ${nonStructuredResponse.city_context || "that city"} yet.`;
                    const parsed = parseAiFallbackReply(
                      nonStructuredResponse.reply?.trim() || fallbackIntroByMode
                    );
                    const introCopy =
                      parsed.intro ||
                      `Here's what I've got for ${nonStructuredResponse.city_context || "that city"}.`;
                    const cityForMaps =
                      (typeof nonStructuredResponse.debug?.city === "string"
                        ? (nonStructuredResponse.debug.city as string)
                        : nonStructuredResponse.city_context) || "";
                    const mapsQuery = [
                      nonStructuredResponse.normalized_intent,
                      cityForMaps,
                    ]
                      .filter(Boolean)
                      .join(" in ");
                    const mapsUrl = mapsQuery
                      ? `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`
                      : null;
                    return (
                      <div className="space-y-3 text-left">
                        <GenieBubble copy={introCopy} compact />
                        {parsed.items.length > 0 ? (
                          <div className="rounded-[22px] border border-red-200 bg-[rgba(255,250,250,0.92)] px-5 py-4 dark:border-white/10 dark:bg-black/16">
                            <ol className="space-y-3 text-[0.95rem] leading-6 text-gray-800 dark:text-white/82">
                              {parsed.items.map((item, index) => (
                                <li key={index} className="flex gap-3">
                                  <span
                                    aria-hidden="true"
                                    className="mt-[0.1em] min-w-[1.5em] font-semibold"
                                  >
                                    {index + 1}.
                                  </span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                        {nonStructuredResponse.response_mode ===
                          "city_unsupported" && mapsUrl ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full rounded-[18px] border border-white/30 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20"
                          >
                            Search on Google Maps
                          </a>
                        ) : null}
                      </div>
                    );
                  })()
                ) : (
                  <div className="rounded-[22px] border border-white/15 bg-black/30 px-4 py-3 text-sm leading-6 text-white/80 backdrop-blur-sm">
                    {nonStructuredResponse.response_mode === "city_missing"
                      ? "Tell Genie your city and preferences so recommendations can stay local."
                      : nonStructuredResponse.reply}
                  </div>
                )}
                {isAiFallbackLayout ? null : (
                  <>
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
                  </>
                )}
              </div>
            ) : statusMessage && currentResponseMode !== "structured_results" ? (
              <div className="mt-5 rounded-[22px] border border-white/15 bg-black/30 px-4 py-3 text-sm leading-6 text-white/80 backdrop-blur-sm">
                {statusMessage}
              </div>
            ) : null}
          </section>
        ) : null}

        {activeScreen === "decision" && showResultSections ? (
          <section ref={decisionRef} className="space-y-2 pb-24">
            <GenieBubble
              copy={response?.reply?.trim() || "I found a few spots that match your vibe."}
              compact
            />
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

            <div className="flex flex-col gap-2">
              {decisionItems.map((item, index) =>
                item.type === "venue" ? (
                  <ResultCard
                    key={`venue-${item.venue.id}`}
                    venue={item.venue}
                    index={index}
                    userCoords={userCoordsLL}
                    onOpen={() => {
                      selectVenue(item.venue, index, "decision");
                      logVenueInteraction("tap", Number(item.venue.id), "decision");
                    }}
                    onSave={() => handleSaveVenue(item.venue)}
                  />
                ) : (
                  <EventResultCard
                    key={`event-${item.event.id}`}
                    evt={item.event}
                    onOpen={() => {
                      setSelectedEventSlug(item.event.public_slug ?? null);
                      setSelectedEventId(item.event.id);
                      setSelectedEvent(item.event as Record<string, unknown>);
                      navigateTo("event-detail");
                      logEventInteraction("tap", item.event.id, "decision");
                    }}
                  />
                )
              )}
            </div>

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
              className="mt-2 flex w-full items-center justify-center gap-2 py-3 text-[1rem] font-medium text-gray-800 dark:text-white"
            >
              <span>See More Nearby</span>
              <span aria-hidden="true">→</span>
            </button>
          </section>
        ) : null}

        {activeScreen === "more" && showResultSections && moreNearbyItems.length ? (
          <section ref={moreRef} className="space-y-4 pb-24">
            <GenieBubble
              copy={
                response?.reply?.trim() ||
                (queryMode === "event"
                  ? "Here are more events you might like."
                  : "Here are some more spots you might like.")
              }
              compact
            />

            {queryMode === "venue" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {allVenues.slice(3, 5).map((venue, index) => (
                    <button
                      key={venue.id}
                      type="button"
                      onClick={() => {
                        selectVenue(venue, index + 3, "more");
                        logVenueInteraction("tap", Number(venue.id), "more");
                      }}
                      className="overflow-hidden rounded-[18px] border border-[#E7070380] bg-transparent text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
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
                          {getVenueHeadlineShort(venue)}
                          {(() => {
                            const d = getVenueDistance(venue, index + 3, userCoordsLL);
                            return d ? ` - ${d}` : "";
                          })()}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {buildVenueTags(venue).slice(0, 2).map((tag) => (
                            <span
                              key={`${venue.id}-${tag}`}
                              className="rounded-full border border-[#E70703] bg-transparent px-2.5 py-0.5 text-[0.65rem] font-medium text-[#E70703] dark:border-[#E70703] dark:bg-transparent dark:text-white"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {allVenues.slice(5, 15).length > 0 ? (
                  <>
                    <p className="mt-5 text-[1.25rem] font-semibold text-gray-900 dark:text-white">
                      More Nearby
                    </p>
                    <div className="-mx-4 overflow-x-auto">
                      <div className="flex gap-3 px-4 pb-2">
                        {allVenues.slice(5, 15).map((venue, index) => (
                          <button
                            key={venue.id}
                            type="button"
                            onClick={() => selectVenue(venue, index + 5, "more")}
                            className="w-[9.5rem] flex-none overflow-hidden rounded-[18px] border border-[#E7070380] bg-transparent text-left shadow-[0_8px_20px_rgba(0,0,0,0.05)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
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
                                {getVenueHeadlineShort(venue)}
                                {(() => {
                                  const d = getVenueDistance(venue, index + 5, userCoordsLL);
                                  return d ? ` - ${d}` : "";
                                })()}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {buildVenueTags(venue).slice(0, 2).map((tag) => (
                                  <span
                                    key={`${venue.id}-${tag}`}
                                    className="rounded-full border border-[#E70703] bg-transparent px-2 py-0.5 text-[0.6rem] font-medium text-[#E70703] dark:border-[#E70703] dark:bg-transparent dark:text-white"
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
              </>
            ) : queryMode === "event" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(response?.events ?? []).slice(3, 5).map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => {
                        setSelectedEventSlug(evt.public_slug ?? null);
                        setSelectedEventId(evt.id);
                        setSelectedEvent(evt as Record<string, unknown>);
                        navigateTo("event-detail");
                      }}
                      className="overflow-hidden rounded-[18px] border border-[#E7070380] bg-transparent text-left shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
                    >
                      <div className="relative h-36 w-full">
                        <Image
                          src={evt.cover_image_url || "/sample-venue-2.jpeg"}
                          alt={evt.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 45vw, 200px"
                        />
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="line-clamp-1 text-[1rem] font-semibold text-gray-900 dark:text-white">
                          {evt.title}
                        </p>
                        <p className="mt-0.5 text-[0.75rem] text-gray-500 dark:text-white/60">
                          {evt.event_date ? new Date(evt.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          {evt.start_time ? ` · ${evt.start_time.slice(0, 5)}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {evt.category ? (
                            <span className="rounded-full border border-[#E70703] bg-transparent px-2.5 py-0.5 text-[0.65rem] font-medium text-[#E70703] dark:border-[#E70703] dark:bg-transparent dark:text-white">
                              {evt.category}
                            </span>
                          ) : null}
                          {evt.is_free ? (
                            <span className="rounded-full border border-[#E70703] bg-transparent px-2.5 py-0.5 text-[0.65rem] font-medium text-[#E70703] dark:border-[#E70703] dark:bg-transparent dark:text-white">
                              Free
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {(response?.events ?? []).slice(5, 10).length > 0 ? (
                  <>
                    <p className="mt-5 text-[1.25rem] font-semibold text-gray-900 dark:text-white">
                      More events you might like
                    </p>
                    <div className="-mx-4 overflow-x-auto">
                      <div className="flex gap-3 px-4 pb-2">
                        {(response?.events ?? []).slice(5, 10).map((evt) => (
                          <button
                            key={evt.id}
                            type="button"
                            onClick={() => {
                              setSelectedEventSlug(evt.public_slug ?? null);
                              setSelectedEventId(evt.id);
                              setSelectedEvent(evt as Record<string, unknown>);
                              navigateTo("event-detail");
                            }}
                            className="w-[9.5rem] flex-none overflow-hidden rounded-[18px] border border-[#E7070380] bg-transparent text-left shadow-[0_8px_20px_rgba(0,0,0,0.05)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
                          >
                            <div className="relative h-24 w-full">
                              <Image
                                src={evt.cover_image_url || "/sample-venue-2.jpeg"}
                                alt={evt.title}
                                fill
                                className="object-cover"
                                sizes="152px"
                              />
                            </div>
                            <div className="px-2.5 py-2">
                              <p className="line-clamp-1 text-[0.88rem] font-semibold text-gray-900 dark:text-white">
                                {evt.title}
                              </p>
                              <p className="mt-0.5 truncate text-[0.66rem] text-gray-500 dark:text-white/60">
                                {evt.event_date ? new Date(evt.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {evt.category ? (
                                  <span className="rounded-full border border-[#E70703] bg-transparent px-2 py-0.5 text-[0.6rem] font-medium text-[#E70703] dark:border-[#E70703] dark:bg-transparent dark:text-white">
                                    {evt.category}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <p className="mt-5 text-[1.25rem] font-semibold text-gray-900 dark:text-white">
                  More Nearby
                </p>
                <div className="-mx-4 overflow-x-auto">
                  <div className="flex gap-3 px-4 pb-2">
                    {moreNearbyItems.map((item, index) =>
                      item.type === "venue" ? (
                        <button
                          key={`venue-${item.venue.id}`}
                          type="button"
                          onClick={() => {
                            selectVenue(item.venue, index, "more");
                            logVenueInteraction("tap", Number(item.venue.id), "more");
                          }}
                          className="w-[9.5rem] flex-none overflow-hidden rounded-[18px] border border-[#E7070380] bg-transparent text-left shadow-[0_8px_20px_rgba(0,0,0,0.05)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
                        >
                          <div className="relative h-24 w-full">
                            <Image
                              src={item.venue.image || "/sample-venue-2.jpeg"}
                              alt={item.venue.venue_name || "Venue"}
                              fill
                              className="object-cover"
                              sizes="152px"
                            />
                          </div>
                          <div className="px-2.5 py-2">
                            <p className="line-clamp-1 text-[0.88rem] font-semibold text-gray-900 dark:text-white">
                              {item.venue.venue_name}
                            </p>
                            <p className="mt-0.5 truncate text-[0.66rem] text-gray-500 dark:text-white/60">
                              {getVenueHeadlineShort(item.venue)}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {buildVenueTags(item.venue).slice(0, 2).map((tag) => (
                                <span
                                  key={`${item.venue.id}-${tag}`}
                                  className="rounded-full border border-[#E70703] bg-transparent px-2 py-0.5 text-[0.6rem] font-medium text-[#E70703] dark:border-[#E70703] dark:bg-transparent dark:text-white"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </button>
                      ) : (
                        <button
                          key={`event-${item.event.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedEventSlug(item.event.public_slug ?? null);
                            setSelectedEventId(item.event.id);
                            setSelectedEvent(item.event as Record<string, unknown>);
                            navigateTo("event-detail");
                          }}
                          className="w-[9.5rem] flex-none overflow-hidden rounded-[18px] border border-[#E7070380] bg-transparent text-left shadow-[0_8px_20px_rgba(0,0,0,0.05)] dark:border-[#6a1d1d] dark:bg-black/30 dark:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
                        >
                          <div className="relative h-24 w-full">
                            <Image
                              src={item.event.cover_image_url || "/sample-venue-2.jpeg"}
                              alt={item.event.title}
                              fill
                              className="object-cover"
                              sizes="152px"
                            />
                          </div>
                          <div className="px-2.5 py-2">
                            <p className="line-clamp-1 text-[0.88rem] font-semibold text-gray-900 dark:text-white">
                              {item.event.title}
                            </p>
                            <p className="mt-0.5 truncate text-[0.66rem] text-gray-500 dark:text-white/60">
                              {item.event.event_date ? new Date(item.event.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {item.event.category ? (
                                <span className="rounded-full border border-[#E70703] bg-transparent px-2 py-0.5 text-[0.6rem] font-medium text-[#E70703] dark:border-[#E70703] dark:bg-transparent dark:text-white">
                                  {item.event.category}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}

        {activeScreen === "detail" && selectedVenue ? (
          <section
            ref={detailRef}
            className="-mx-4 -mt-3 pb-[calc(env(safe-area-inset-bottom,0px)+11rem)] sm:-mx-6 sm:-mt-5"
            // Shared-link signup gate: when a not-yet-registered visitor
            // arrives via a shared venue URL, the first tap anywhere on the
            // screen routes them to the Account Intro. The Back button opts
            // out via data-allow-guest so they can still leave if they
            // change their mind.
            onClickCapture={
              !account
                ? (event) => {
                    const target = event.target as HTMLElement | null;
                    if (target?.closest('[data-allow-guest="true"]')) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    maybeTriggerSignup("shared_venue_tap");
                  }
                : undefined
            }
          >
            <div className="relative h-[14rem] w-full overflow-hidden">
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
                  data-allow-guest="true"
                  className="flex h-8 w-8 items-center justify-center text-red-600 dark:text-white"
                  aria-label="Go back"
                >
                  <BackIcon size={24} className="h-6 w-6 object-contain" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveVenue(selectedVenue)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-red-600 shadow-sm dark:border dark:border-white/40 dark:bg-black/30 dark:text-white dark:backdrop-blur-sm"
                    aria-label="Save"
                  >
                    {savedVenueIds.includes(getVenueId(selectedVenue)) ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-red-600 shadow-sm dark:border dark:border-white/40 dark:bg-black/30 dark:text-white dark:backdrop-blur-sm"
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
              </div>
            </div>

            <div className="space-y-4 px-5 pb-5 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-red-600 px-3 py-1 text-[0.72rem] font-semibold text-white dark:bg-white dark:text-gray-900">
                  {getVenueStatus(selectedVenue, 0)}
                </span>
                <span className="rounded-full border border-red-300 bg-transparent px-3 py-1 text-[0.72rem] font-medium text-red-500 dark:border-[#E7070380] dark:text-white/85">
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

              <button
                type="button"
                disabled={checkinBusy}
                onClick={() => void handleToggleCheckin(selectedVenue)}
                className={`flex items-center gap-1.5 self-start rounded-full px-3.5 py-2 text-[0.78rem] font-semibold transition disabled:pointer-events-none disabled:opacity-60 ${
                  checkedInVenueIds.includes(Number(selectedVenue.id))
                    ? "bg-red-600 text-white dark:bg-white dark:text-gray-900"
                    : "border border-red-300 text-red-600 dark:border-[#E7070380] dark:text-white/85"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                {checkedInVenueIds.includes(Number(selectedVenue.id)) ? "Checked In" : "Check In"}
                {venueActiveCheckins != null && venueActiveCheckins > 0 ? (
                  <span className="opacity-70">· {venueActiveCheckins} here</span>
                ) : null}
              </button>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-gray-700 dark:text-white/80">
                <span className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={`text-[1.1rem] ${n <= Math.round(selectedVenue.google_rating ?? 0) ? "text-yellow-400" : "text-gray-300 dark:text-white/25"}`}
                    >
                      ★
                    </span>
                  ))}
                  {selectedVenue.google_rating ? (
                    <span className="ml-1 font-medium">
                      {selectedVenue.google_rating.toFixed(1)}
                    </span>
                  ) : null}
                  {selectedVenue.google_user_ratings_total ? (
                    <span className="text-gray-500 dark:text-white/55">
                      ({selectedVenue.google_user_ratings_total} Reviews)
                    </span>
                  ) : null}
                </span>
                <span className="text-gray-500 dark:text-white/55">
                  - {getVenueHeadlineShort(selectedVenue)}
                  {(() => {
                    const d = getVenueDistance(selectedVenue, 1, userCoordsLL);
                    return d ? ` - ${d}` : "";
                  })()}
                </span>
              </div>

              {/* Genie's Review Intelligence — rendered for every venue. */}
              <div className="flex items-start gap-3 rounded-[18px] border border-[#E7070380] bg-transparent px-4 py-3 dark:border-[#E7070380] dark:bg-black/25">
                <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full">
                  <Image
                    src="/icons/Social-Genie-Home-Screen.png"
                    alt="Genie"
                    width={32}
                    height={32}
                    className="h-8 w-8 object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-red-500 dark:text-[#ff9d7d]">
                    Genie&apos;s Take
                  </p>
                  <p className="mt-1 text-[0.85rem] leading-5 text-gray-700 dark:text-white/80">
                    {getGenieTake(selectedVenue)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[0.82rem]">
                {getOpenUntil(selectedVenue) ? (
                  <span className="rounded-full border border-[#E7070380] bg-transparent px-3 py-1 text-[0.72rem] font-semibold text-red-600 dark:border-[#E7070380] dark:bg-white/10 dark:text-white/85">
                    {getOpenUntil(selectedVenue)}
                  </span>
                ) : selectedVenue.is_open_now ? (
                  <span className="rounded-full border border-[#E7070380] bg-transparent px-3 py-1 text-[0.72rem] font-semibold text-red-600 dark:border-[#E7070380] dark:bg-white/10 dark:text-white/85">Open now</span>
                ) : null}
                {selectedVenue.is_official_vendor ? (
                  <span className="rounded-full border border-[#E7070380] bg-transparent px-3 py-0.5 text-[0.72rem] text-red-600 dark:border-[#E7070380] dark:text-white/80">
                    Official Vendor
                  </span>
                ) : null}
                {/* Vendor status — surfaces when not operating normally */}
{(selectedVenue as unknown as { vendor_status?: string; vendor_status_message?: string }).vendor_status &&
(selectedVenue as unknown as { vendor_status?: string }).vendor_status !== "operating_normally" ? (
  <span className="rounded-full border border-amber-400/60 bg-amber-400/15 px-3 py-0.5 text-[0.72rem] font-medium text-amber-600 dark:border-amber-400/40 dark:text-amber-300">
    {(selectedVenue as unknown as { vendor_status_message?: string; vendor_status?: string }).vendor_status_message ||
      ((selectedVenue as unknown as { vendor_status?: string }).vendor_status ?? "").replace(/_/g, " ")}
  </span>
) : null}
              </div>

              <div className="grid grid-cols-[1fr_1.45fr_1fr] gap-1">
                {detailActions.slice(0, 3).map((action, index) => {
                  // Middle button keeps the filled-red emphasis; sides stay outlined.
                  const isPrimary = index === 1;
                  const iconSize = isPrimary ? "h-[15px] w-[15px]" : "h-[14px] w-[14px]";
                  // Icon is chosen by the action's identity — not its position —
                  // so reordering the actions can never mislabel a button.
                  let icon: React.ReactNode;
                  if (action.id === "ride") {
                    icon = (
                      <svg viewBox="0 0 24 24" className={`${iconSize} flex-none`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="3" width="15" height="13" rx="2" />
                        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                        <circle cx="5.5" cy="18.5" r="2.5" />
                        <circle cx="18.5" cy="18.5" r="2.5" />
                      </svg>
                    );
                  } else if (action.id === "directions") {
                    icon = (
                      <svg viewBox="0 0 24 24" className={`${iconSize} flex-none`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                      </svg>
                    );
                  } else {
                    const lightIconSrc =
                      action.id === "call"
                        ? "/icons/phone-red.png"
                        : action.id === "share"
                          ? "/icons/share-red.png"
                          : "/icons/calendarIcon.png";
                    const darkIconSrc =
                      action.id === "call"
                        ? "/icons/phoneIcon.png"
                        : action.id === "share"
                          ? "/icons/shareIcon.png"
                          : "/icons/calendarIcon.png";
                    icon = (
                      <>
                        <Image
                          src={lightIconSrc}
                          alt=""
                          aria-hidden="true"
                          width={16}
                          height={16}
                          className={`${iconSize} object-contain dark:hidden`}
                        />
                        <Image
                          src={darkIconSrc}
                          alt=""
                          aria-hidden="true"
                          width={16}
                          height={16}
                          className={`hidden ${iconSize} object-contain dark:block`}
                        />
                      </>
                    );
                  }
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={gateDetailTap(action.onClick)}
                      className={`flex items-center justify-center gap-1 rounded-full border font-medium transition ${
                        isPrimary
                          ? "border-red-500 bg-red-600 px-1.5 py-2 text-[0.76rem] text-white hover:bg-red-700 dark:border-[#E7070380] dark:bg-black/30 dark:text-white"
                          : "border-[#E7070380] bg-transparent px-1.5 py-1.5 text-[0.72rem] text-red-600 hover:bg-red-50 dark:border-[#E7070380] dark:bg-black/30 dark:text-white"
                      }`}
                    >
                      {icon}
                      {action.label}
                    </button>
                  );
                })}
              </div>

              {/* V.I.Bee offer preview for this venue */}
              {(() => {
                const venueOffer = offers.find(
                  (o) => o.vendor_id === Number(selectedVenue.id)
                );
                if (!venueOffer) return null;
                const offerTypeLabels: Record<string, string> = {
                  happy_hour: "Happy Hour",
                  perk: "Perk",
                  brunch: "Brunch",
                  late_night: "Late Night",
                };
                const label =
                  offerTypeLabels[venueOffer.offer_type] ||
                  venueOffer.offer_type.replaceAll("_", " ");
                return (
                  <div className="rounded-[18px] border border-[#E7070380] bg-transparent p-4 dark:border-[#E7070380] dark:bg-black/35">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-white/55">
                          Offer
                        </p>
                        <p className="mt-1 text-[1.05rem] font-bold text-red-500 dark:text-[#ff9d7d]">
                          {venueOffer.discount_value || venueOffer.title}
                        </p>
                      </div>
                      <span className="flex-none rounded-full bg-[#e8900a] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-white">
                        {label}
                      </span>
                    </div>
                    {venueOffer.description ? (
                      <p className="mt-2 text-[0.85rem] leading-5 text-gray-600 dark:text-white/72">
                        {venueOffer.description}
                      </p>
                    ) : null}
                  </div>
                );
              })()}

              <div>
                <h3 className="text-[1.1rem] font-semibold text-gray-900 dark:text-white">About</h3>
                <p className="mt-1 text-[0.88rem] leading-6 text-gray-600 dark:text-white/75">
                  {getVenueDescription(selectedVenue)}
                </p>
              </div>

              {mapPreviewUrl && !mapPreviewFailed ? (
                <button
                  type="button"
                  onClick={gateDetailTap(() => {
                    if (nativeMapsUrl) {
                      trackEvent(analyticsEvents.mapOpen, {
                        venueId: getVenueId(selectedVenue),
                      });
                      trackEvent(analyticsEvents.vendorMapTap, {
                        venueId: getVenueId(selectedVenue),
                      });
                      logVendorInteraction("map_click", Number(selectedVenue.id));
                      logVenueInteraction("map", Number(selectedVenue.id), "detail");
                      window.open(nativeMapsUrl, "_blank", "noopener,noreferrer");
                    }
                  })}
                  className="relative block h-44 w-full overflow-hidden rounded-[18px] border border-[#E7070380] text-left dark:border-[#E7070380]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mapPreviewUrl}
                    alt={`Map for ${selectedVenue.venue_name}`}
                    onError={() => setMapPreviewFailed(true)}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (() => {
                // Fallback: keyless Google Maps embed so a map always shows.
                const query =
                  selectedVenue.address?.trim() ||
                  [selectedVenue.venue_name, selectedVenue.city]
                    .filter(Boolean)
                    .join(", ") ||
                  selectedVenue.city ||
                  "Houston, TX";
                const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
                return (
                  <div className="relative h-44 w-full overflow-hidden rounded-[18px] border border-[#E7070380] dark:border-[#E7070380]">
                    <iframe
                      title={`Map for ${selectedVenue.venue_name}`}
                      src={embedSrc}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="absolute inset-0 h-full w-full border-0"
                      allowFullScreen
                    />
                    {nativeMapsUrl ? (
                      <button
                        type="button"
                        onClick={gateDetailTap(() => {
                          trackEvent(analyticsEvents.mapOpen, {
                            venueId: getVenueId(selectedVenue),
                          });
                          trackEvent(analyticsEvents.vendorMapTap, {
                            venueId: getVenueId(selectedVenue),
                          });
                          logVendorInteraction("map_click", Number(selectedVenue.id));
                          window.open(nativeMapsUrl, "_blank", "noopener,noreferrer");
                        })}
                        className="absolute bottom-2 right-2 rounded-full bg-white/95 px-3 py-1 text-[0.72rem] font-semibold text-gray-800 shadow-sm hover:bg-white dark:bg-black/70 dark:text-white"
                      >
                        Open in Maps
                      </button>
                    ) : null}
                  </div>
                );
              })()}

              <p className="text-center text-[0.95rem] font-medium text-gray-900 dark:text-white">
                {selectedVenue.address || "Houston, Texas"}
              </p>

              <div className="flex flex-wrap gap-2">
                {buildVenueTags(selectedVenue).map((tag) => (
                  <span
                    key={`${selectedVenue.id}-${tag}`}
                    className="rounded-full border border-[#E7070380] bg-transparent px-3 py-1 text-[0.78rem] font-medium text-red-600 dark:border-[#E7070380] dark:text-white/85"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Redeem Offer CTA — only for V.I.Bee members with a venue offer */}
              {(() => {
                const venueOffer = offers.find(
                  (o) => o.vendor_id === Number(selectedVenue.id)
                );
                if (!venueOffer) return null;
                const isMember = account?.membership === "vibee";
                const redeeming = redeemingOfferId === venueOffer.id;
                return (
                  <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] left-1/2 z-[90] w-[min(100vw,28rem)] -translate-x-1/2 px-4 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!account) {
                          navigateTo("account");
                          return;
                        }
                        if (!isMember) {
                          navigateTo("account");
                          return;
                        }
                        void handleRedeemOffer(venueOffer);
                      }}
                      disabled={redeeming}
                      className="w-full rounded-[18px] border border-red-500 bg-red-600 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(231,7,7,0.35)] disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                    >
                      {redeeming
                        ? "Redeeming..."
                        : isMember
                          ? "Redeem Offer"
                          : "Upgrade to Redeem"}
                    </button>
                  </div>
                );
              })()}
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
              >
                <BackIcon size={20} />
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
                    onClick={() => { selectVenue(venue, index, "saved"); logVenueInteraction("tap", Number(venue.id), "saved"); }}
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
                        <Image
                          src="/icons/saved_filled.png"
                          alt=""
                          aria-hidden="true"
                          width={14}
                          height={14}
                          className="h-3.5 w-3.5 object-contain"
                        />
                      </button>
                      {/* Name + location overlay */}
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
                        <p className="line-clamp-1 text-[0.88rem] font-bold text-white">
                          {venue.venue_name}
                        </p>
                        <p className="mt-0.5 truncate text-[0.68rem] text-white/65">
                          {getVenueHeadlineShort(venue)}
                          {(() => {
                            const d = getVenueDistance(venue, index, userCoordsLL);
                            return d ? ` · ${d}` : "";
                          })()}
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

        {/* ── EVENTS ── */}
        {activeScreen === "events-tab" ? (
          <EventsPage
            account={account}
            userCoords={userCoordsLL}
            onBack={() => goBack("homescreen")}
            onSignIn={() => navigateTo("account")}
            onSelectEvent={(evt: ManagedEvent) => {
              setSelectedEventSlug(evt.public_slug ?? null);
              setSelectedEventId(evt.id);
              setSelectedEvent(evt as unknown as Record<string, unknown>);
              navigateTo("event-detail");
            }}
          />
        ) : null}

        {/* ── V.I.BEE OFFERS ── */}
        {activeScreen === "offers" ? (() => {
          const offerTypeLabels: Record<string, string> = {
            happy_hour: "Happy Hour",
            perk: "Perk",
            brunch: "Brunch",
            late_night: "Late Night",
          };
          const filterOptions: Array<{
            id: typeof offersFilter;
            label: string;
          }> = [
            { id: "all", label: "All" },
            { id: "happy_hour", label: "Happy Hour" },
            { id: "perk", label: "Perk" },
            { id: "brunch", label: "Brunch" },
            { id: "late_night", label: "Late Night" },
          ];
          const filtered =
            offersFilter === "all"
              ? offers
              : offers.filter((o) => o.offer_type === offersFilter);
          const canRedeem = account?.membership === "vibee";
          return (
            <section ref={offersRef} className="pb-24">
              {/* Header */}
              <div className="mb-4 flex items-center">
                <button
                  type="button"
                  onClick={() => goBack("home")}
                  aria-label="Go back"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
                >
                  <BackIcon size={20} />
                </button>
                <h2 className="flex-1 text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
                  V.I.Bee Offers
                </h2>
                {/* Manual refresh — offers reset every 24h on the backend
                    but we previously cached the list for the entire session,
                    so daily availability never surfaced. */}
                <button
                  type="button"
                  onClick={() => {
                    offersLoadedRef.current = false;
                    void loadOffersAndRedemptions({ force: true });
                  }}
                  disabled={offersLoading}
                  aria-label="Refresh offers"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 disabled:opacity-50 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 ${offersLoading ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M23 4v6h-6" />
                    <path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                  </svg>
                </button>
              </div>
              <p className="mb-4 text-center text-sm text-gray-500 dark:text-white/60">
                Exclusive deals for members only
              </p>

              {/* Filter chips */}
              <div className="-mx-4 mb-4 overflow-x-auto">
                <div className="flex gap-2 px-4">
                  {filterOptions.map((opt) => {
                    const active = offersFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOffersFilter(opt.id)}
                        className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[0.82rem] font-semibold transition ${
                          active
                            ? "border border-red-500 bg-red-600 text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                            : "border border-transparent bg-transparent text-gray-500 hover:text-gray-700 dark:text-white/55 dark:hover:text-white/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* States */}
              {!account ? (
                <div className="rounded-[20px] border border-[#E7070380] bg-black/20 px-4 py-5 text-sm text-white/72">
                  Sign in to view V.I.Bee offers.
                </div>
              ) : offersLoading ? (
                <div className="rounded-[20px] border border-[#E7070380] bg-black/20 px-4 py-5 text-sm text-white/72">
                  Loading offers...
                </div>
              ) : offersError ? (
                <div className="rounded-[20px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {offersError}
                </div>
              ) : filtered.length ? (
                <div className="space-y-3">
                  {filtered.map((offer) => {
                    const label = offerTypeLabels[offer.offer_type] ||
                      offer.offer_type.replaceAll("_", " ");
                    const knownVenues: GenieVenue[] = [
                      ...(response?.decisive ?? []),
                      ...(response?.more_nearby ?? []),
                      ...savedVenues,
                    ];
                    const matchedVenue = knownVenues.find(
                      (v) => Number(v.id) === offer.vendor_id
                    );
                    const venueName =
                      offer.venue_name ||
                      matchedVenue?.venue_name ||
                      `Venue #${offer.vendor_id}`;
                    const venueImage =
                      offer.venue_image ||
                      matchedVenue?.image ||
                      "/sample-venue-1.jpeg";
                    return (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => {
                          if (!canRedeem) {
                            navigateTo("account");
                            return;
                          }
                          setSelectedOfferId(offer.id);
                          navigateTo("offer-detail");
                        }}
                        className="flex w-full items-center gap-3 rounded-[20px] border border-[#E7070380] bg-transparent p-3 text-left shadow-sm transition hover:border-red-300 dark:border-[#E7070380] dark:bg-black/30 dark:hover:border-[#ff7b7b]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={venueImage}
                          alt={venueName}
                          className="h-[4.5rem] w-[4.5rem] flex-none rounded-[14px] object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[1rem] font-semibold text-gray-900 dark:text-white">
                            {venueName}
                          </p>
                          <span className="mt-1 inline-flex rounded-full bg-red-600 px-2.5 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide text-white">
                            {label}
                          </span>
                          {offer.discount_value ? (
                            <p className="mt-1 truncate text-[0.82rem] font-semibold text-[#e8900a]">
                              {offer.discount_value}
                            </p>
                          ) : null}
                          {offer.description ? (
                            <p className="mt-0.5 line-clamp-2 text-[0.78rem] leading-5 text-gray-600 dark:text-white/65">
                              {offer.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-none self-start items-start justify-center pt-1">
                          <Image
                            src="/icon-dropdown-white.png"
                            alt=""
                            aria-hidden="true"
                            width={16}
                            height={16}
                            className="h-4 w-4 object-contain dark:hidden"
                          />
                          <Image
                            src="/icon-dropdown-dark.png"
                            alt=""
                            aria-hidden="true"
                            width={16}
                            height={16}
                            className="hidden h-4 w-4 object-contain dark:block"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[20px] border border-[#E7070380] bg-black/20 px-4 py-5 text-sm text-white/72">
                  No offers in this category right now. Check back soon.
                </div>
              )}

              {/* Upgrade CTA for non-members */}
              {account && !canRedeem ? (
                <div className="fixed bottom-0 left-1/2 z-40 w-[min(100vw,28rem)] -translate-x-1/2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3">
                  <button
                    type="button"
                    onClick={() => navigateTo("account")}
                    className="w-full rounded-[18px] border border-red-500 bg-red-600 py-3.5 text-sm font-semibold text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                  >
                    Upgrade to Redeem - $2.99/mo
                  </button>
                </div>
              ) : null}
            </section>
          );
        })() : null}

        {/* ── OFFER DETAIL (pre-redemption) ── */}
        {activeScreen === "offer-detail" ? (() => {
          const offer = offers.find((o) => o.id === selectedOfferId) ?? null;
          if (!offer) {
            return (
              <section className="pb-8">
                <div className="mb-4 flex items-center">
                  <button
                    type="button"
                    onClick={() => goBack("offers")}
                    aria-label="Go back"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
                  >
                    <BackIcon size={20} />
                  </button>
                  <h2 className="flex-1 pr-9 text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
                    Offer Detail
                  </h2>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/72">
                  Offer not available. Pick another from V.I.Bee Offers.
                </div>
              </section>
            );
          }
          const offerTypeLabels: Record<string, string> = {
            happy_hour: "Happy Hour",
            perk: "Perk",
            brunch: "Brunch",
            late_night: "Late Night",
          };
          const label =
            offerTypeLabels[offer.offer_type] ||
            offer.offer_type.replaceAll("_", " ");
          const knownVenues: GenieVenue[] = [
            ...(response?.decisive ?? []),
            ...(response?.more_nearby ?? []),
            ...savedVenues,
          ];
          const matchedVenue = knownVenues.find(
            (v) => Number(v.id) === offer.vendor_id
          );
          const venueName =
            offer.venue_name || matchedVenue?.venue_name || `Venue #${offer.vendor_id}`;
          const venueImage =
            offer.venue_image || matchedVenue?.image || "/sample-venue-1.jpeg";
          const isMember = account?.membership === "vibee";
          const redeeming = redeemingOfferId === offer.id;

          const rating = offer.venue_rating ?? matchedVenue?.google_rating ?? null;
          const reviewCount = offer.venue_review_count ?? matchedVenue?.google_user_ratings_total ?? null;
          const neighborhood = offer.venue_neighborhood ?? matchedVenue?.neighborhood_text ?? matchedVenue?.city ?? null;
          const address = matchedVenue?.address ?? null;
          const phone = matchedVenue?.phone ?? null;
          const reservationUrl = matchedVenue?.reservation_url ?? null;
          const isOpenNow = matchedVenue?.is_open_now ?? null;
          const isOfficial = matchedVenue?.is_official_vendor ?? false;
          const venueTags = matchedVenue ? buildVenueTags(matchedVenue).slice(0, 4) : [];
          const staticMapUrl = matchedVenue ? buildStaticMapUrl(matchedVenue) : null;
          const mapsUrl = matchedVenue ? buildNativeMapsUrl(matchedVenue) : null;

          return (
            <section className="pb-32">
              {/* Full-bleed hero */}
              <div className="relative -mx-4 -mt-3 h-[42vh] min-h-[260px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={venueImage} alt={venueName} className="h-full w-full object-cover" />
                {/* gradient overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.28)_0%,transparent_40%,rgba(0,0,0,0.72)_100%)]" />
                {/* back button */}
                <button
                  type="button"
                  onClick={() => goBack("offers")}
                  aria-label="Go back"
                  className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
                >
                  <BackIcon size={20} />
                </button>
              </div>

              {/* Venue name + meta */}
              <div className="mt-4">
                <h2 className="text-[1.6rem] font-bold leading-tight text-gray-900 dark:text-white">
                  {venueName}
                </h2>

                {/* Vibe tags */}
                {venueTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {venueTags.map((tag, i) => (
                      <span
                        key={i}
                        className={`rounded-full border px-3 py-0.5 text-[0.75rem] font-semibold ${i === 0 ? "border-white/30 bg-white/90 text-gray-900 dark:border-white/20 dark:bg-white/15 dark:text-white" : "border-white/20 bg-black/30 text-white backdrop-blur-sm dark:bg-white/10"}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Rating + neighborhood */}
                {(rating || neighborhood) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.82rem] text-gray-700 dark:text-white/75">
                    {rating ? (
                      <>
                        {[1,2,3,4,5].map((n) => (
                          <span key={n} className={`text-[0.9rem] ${n <= Math.round(rating) ? "text-yellow-400" : "text-gray-300 dark:text-white/25"}`}>★</span>
                        ))}
                        <span className="font-semibold text-gray-900 dark:text-white">{rating.toFixed(1)}</span>
                        {reviewCount ? <span>({reviewCount.toLocaleString()} Reviews)</span> : null}
                      </>
                    ) : null}
                    {neighborhood ? <><span className="text-gray-400 dark:text-white/30">·</span><span>{neighborhood}</span></> : null}
                  </div>
                )}

                {/* Open status + Official badge */}
                {(isOpenNow !== null || isOfficial) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isOpenNow !== null && (
                      <span className="text-[0.82rem] font-medium text-gray-700 dark:text-white/70">
                        {isOpenNow ? "Open now" : "Closed now"}
                      </span>
                    )}
                    {isOfficial && (
                      <span className="rounded-full border border-white/20 bg-black/30 px-3 py-0.5 text-[0.72rem] font-semibold text-white backdrop-blur-sm dark:bg-white/10">
                        Official Vendor
                      </span>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-3 flex gap-2">
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#E7070380] bg-transparent py-2 text-[0.82rem] font-semibold text-gray-900 dark:border-white/20 dark:text-white"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>
                      Call
                    </a>
                  )}
                  {reservationUrl && (
                    <a
                      href={reservationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#E7070380] bg-transparent py-2 text-[0.82rem] font-semibold text-gray-900 dark:border-white/20 dark:text-white"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                      Reservations
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const url = matchedVenue
                        ? `${getAppOrigin()}/venue/${getVenueId(matchedVenue)}`
                        : getAppOrigin();
                      void shareLink({
                        title: `${venueName} - Genie by Social Bevy`,
                        text: offer.title,
                        url,
                      });
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#E7070380] bg-transparent py-2 text-[0.82rem] font-semibold text-gray-900 dark:border-white/20 dark:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
                    Share
                  </button>
                </div>
              </div>

              {/* Offer section */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[1rem] font-semibold text-gray-900 dark:text-white">Offer</p>
                  <span className="rounded-full bg-red-600 px-3 py-1 text-[0.72rem] font-bold text-white">{label}</span>
                </div>
                {offer.discount_value && (
                  <p className="text-[1.15rem] font-bold text-[#e8900a]">{offer.discount_value}</p>
                )}
                {offer.title && (
                  <p className="mt-1 text-[0.9rem] leading-6 text-gray-700 dark:text-white/80">{offer.title}</p>
                )}
                {offer.description && (
                  <p className="mt-1 text-[0.9rem] leading-6 text-gray-600 dark:text-white/65">{offer.description}</p>
                )}
                {offer.redeem_instructions && (
                  <p className="mt-2 text-[0.82rem] font-medium text-gray-500 dark:text-white/50">
                    <span className="font-semibold text-gray-700 dark:text-white/70">How to redeem: </span>
                    {offer.redeem_instructions}
                  </p>
                )}
              </div>

              {/* Map */}
              {(staticMapUrl || venueImage) && (
                <div className="mt-5 overflow-hidden rounded-[20px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={staticMapUrl ?? venueImage}
                    alt="Venue map"
                    className="h-48 w-full object-cover"
                  />
                </div>
              )}

              {/* Address */}
              {address && (
                <p className="mt-3 text-center text-[0.88rem] font-medium text-gray-700 dark:text-white/70">
                  {address}
                </p>
              )}

              {/* Fixed Redeem CTA */}
              <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] left-1/2 z-[90] w-[min(100vw,28rem)] -translate-x-1/2 px-4 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!isMember) { navigateTo("account"); return; }
                    void handleRedeemOffer(offer);
                  }}
                  disabled={redeeming}
                  className="w-full rounded-[18px] border border-red-500 bg-red-600 py-4 text-[1rem] font-bold text-white shadow-[0_8px_24px_rgba(231,7,7,0.4)] disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                >
                  {redeeming ? "Redeeming…" : isMember ? "Redeem Offer" : "Upgrade to Redeem"}
                </button>
              </div>
            </section>
          );
        })() : null}

        {/* ── OFFER ACTIVATED (QR + states) ── */}
        {activeScreen === "offer-activated" ? (() => {
          const ar = activeRedemption;

          // Shared venue info card
          const VenueInfoCard = ar ? (
            <div className="mb-5 rounded-[20px] border border-[#E7070380] bg-transparent p-4 dark:border-[#E7070380] dark:bg-black/30">
              <p className="text-[1.05rem] font-bold text-gray-900 dark:text-white">
                {ar.venue_name || `Venue #${ar.vendor_id}`}
              </p>
              {ar.venue_rating ? (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[0.78rem] text-gray-500 dark:text-white/60">
                  {[1,2,3,4,5].map((n) => (
                    <span key={n} className={`text-[0.85rem] ${n <= Math.round(ar.venue_rating!) ? "text-yellow-400" : "text-gray-300 dark:text-white/20"}`}>★</span>
                  ))}
                  <span className="font-semibold text-gray-800 dark:text-white/80">{ar.venue_rating.toFixed(1)}</span>
                  {ar.venue_review_count ? <span>({ar.venue_review_count} Reviews)</span> : null}
                  {ar.venue_neighborhood ? <><span className="text-gray-300">·</span><span>{ar.venue_neighborhood}</span></> : null}
                </div>
              ) : null}
              {ar.discount_value ? (
                <p className="mt-1 text-[0.88rem] font-semibold text-red-500 dark:text-[#ff9d7d]">{ar.discount_value}</p>
              ) : null}
              <p className="mt-1 text-[0.75rem] text-gray-400 dark:text-white/45">
                Redeemed at {formatTimestamp(ar.redeemed_at)}
              </p>
            </div>
          ) : null;

          // Header
          const Header = (
            <div className="relative mb-5 w-full">
              <button
                type="button"
                onClick={() => { setRedemptionOutcome(null); goBack("offer-detail"); }}
                aria-label="Go back"
                className="absolute left-0 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
              >
                <BackIcon size={20} />
              </button>
              <h2 className="w-full text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
                Redeem Offer
              </h2>
            </div>
          );

          // ── State: Redeemed Successfully ──
          if (redemptionOutcome === "success") {
            return (
              <section className="flex flex-col items-center pb-8">
                {Header}
                <div className="mt-10 flex h-24 w-24 items-center justify-center rounded-full bg-green-500 shadow-[0_8px_32px_rgba(34,197,94,0.4)]">
                  <svg viewBox="0 0 24 24" className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="mt-6 text-[1.2rem] font-bold text-gray-900 dark:text-white">Offer Redeemed Successfully!</p>
                <p className="mt-2 text-[0.85rem] text-gray-500 dark:text-white/55">{ar ? formatTimestamp(ar.redeemed_at) : ""}</p>
              </section>
            );
          }

          // ── State: Offer Expired ──
          if (redemptionOutcome === "expired") {
            return (
              <section className="pb-8">
                {Header}
                {VenueInfoCard}
                <div className="mt-4 text-center">
                  <p className="text-[1.1rem] font-bold text-red-500">Offer is Expired!</p>
                  <p className="mt-2 text-[0.88rem] text-gray-500 dark:text-white/55">Oh No! You&apos;ve missed the offer.<br />Offer was valid for 24 hours only</p>
                </div>
              </section>
            );
          }

          // ── State: Already Redeemed ──
          if (redemptionOutcome === "already_redeemed") {
            return (
              <section className="flex flex-col items-center pb-8">
                {Header}
                <div className="mt-10 flex h-24 w-24 items-center justify-center rounded-full bg-red-600 shadow-[0_8px_32px_rgba(220,38,38,0.4)]">
                  <span className="text-[2.5rem] font-black text-white">!</span>
                </div>
                <p className="mt-6 text-[1.2rem] font-bold text-gray-900 dark:text-white">Offer redeemed already!</p>
                <p className="mt-2 text-[0.85rem] text-gray-500 dark:text-white/55">{ar ? formatTimestamp(ar.redeemed_at) : ""}</p>
              </section>
            );
          }

          // ── State: No active redemption fallback ──
          if (!ar) {
            return (
              <section className="pb-8">
                {Header}
                <div className="rounded-[20px] border border-[#E7070380] bg-transparent px-4 py-5 text-sm text-gray-600 dark:text-white/72">
                  No active redemption. Open an offer from V.I.Bee Offers to generate a QR code.
                </div>
              </section>
            );
          }

          // ── State: QR code (default) ──
          const isExpired = ar.redeemed_at && Date.now() > ar.redeemed_at + 24 * 60 * 60 * 1000;
          return (
            <section className="pb-8">
              {Header}
              {VenueInfoCard}

              {isExpired ? (
                <div className="mb-5 rounded-[16px] border border-[#E7070380] bg-transparent px-4 py-3 text-center">
                  <p className="text-[0.88rem] font-semibold text-red-500">This offer has expired</p>
                </div>
              ) : (
                <>
                  {/* QR code */}
                  <div className="mx-auto mb-3 w-full max-w-[16rem] rounded-[24px] bg-white p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={buildQrImageUrl(ar.verify_url, 320)}
                      alt={`QR code for ${ar.offer_title}`}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                  <p className="mb-5 text-center text-[0.95rem] font-medium text-gray-700 dark:text-white/80">
                    Show this to your server.
                  </p>
                  {/* Confirm Redemption */}
                  <button
                    type="button"
                    onClick={() => setRedemptionOutcome("success")}
                    className="mb-5 w-full rounded-[18px] border border-red-500 bg-red-600 py-4 text-[1rem] font-bold text-white shadow-[0_8px_24px_rgba(231,7,7,0.35)] dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                  >
                    Confirm Redemption
                  </button>
                </>
              )}

              {/* Terms */}
              <div className="rounded-[20px] border border-[#E7070380] bg-transparent p-4 dark:border-[#E7070380] dark:bg-black/20">
                <p className="mb-2 text-[0.88rem] font-semibold text-gray-700 dark:text-white/70">Terms of offer</p>
                <ul className="space-y-1.5 text-[0.83rem] leading-5 text-gray-500 dark:text-white/60">
                  {ar.offer_terms ? (
                    ar.offer_terms.split(/\n|•/).map((line) => line.trim()).filter(Boolean).map((line, i) => (
                      <li key={i} className="flex gap-2"><span className="flex-none">•</span><span>{line}</span></li>
                    ))
                  ) : (
                    <>
                      <li className="flex gap-2"><span className="flex-none">•</span><span>Offer valid until {new Date((ar.redeemed_at + 24 * 60 * 60 * 1000)).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} tomorrow</span></li>
                      <li className="flex gap-2"><span className="flex-none">•</span><span>No two offers can be clubbed together</span></li>
                    </>
                  )}
                </ul>
              </div>
            </section>
          );
        })() : null}

        {/* ── RECENT REDEMPTIONS ── */}
        {activeScreen === "redemptions" ? (() => {
          const now = Date.now();
          const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days default
          const classify = (
            r: VibeeRedemption
          ): "verified" | "pending" | "expired" => {
            if (r.verified_at) return "verified";
            const expiresAt = r.expires_at ?? r.redeemed_at + EXPIRY_WINDOW_MS;
            if (now > expiresAt) return "expired";
            return "pending";
          };
          const filterOptions: Array<{
            id: typeof redemptionsFilter;
            label: string;
          }> = [
            { id: "all", label: "All" },
            { id: "verified", label: "Verified" },
            { id: "pending", label: "Pending" },
            { id: "expired", label: "Expired" },
          ];
          const sorted = [...redemptions].sort(
            (a, b) => b.redeemed_at - a.redeemed_at
          );
          const filtered =
            redemptionsFilter === "all"
              ? sorted
              : sorted.filter((r) => classify(r) === redemptionsFilter);
          return (
            <section className="pb-8">
              {/* Header */}
              <div className="mb-4 flex items-center">
                <button
                  type="button"
                  onClick={() => goBack("home")}
                  aria-label="Go back"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
                >
                  <BackIcon size={20} />
                </button>
                <h2 className="flex-1 pr-9 text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
                  Recent Redemptions
                </h2>
              </div>

              {/* Status tabs */}
              <div className="-mx-4 mb-4 overflow-x-auto">
                <div className="flex gap-2 px-4">
                  {filterOptions.map((opt) => {
                    const active = redemptionsFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRedemptionsFilter(opt.id)}
                        className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-[0.82rem] font-semibold transition ${
                          active
                            ? "border-red-500 bg-red-600 text-white dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:bg-black/24 dark:text-white/72 dark:hover:bg-white/8"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!account ? (
                <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/72">
                  Sign in to view your redemption history.
                </div>
              ) : redemptionsLoading ? (
                <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/72">
                  Loading redemption history...
                </div>
              ) : filtered.length ? (
                <div className="space-y-2.5">
                  {filtered.map((redemption) => {
                    const matchedOffer = offers.find(
                      (o) => o.id === redemption.offer_id
                    );
                    const status = classify(redemption);
                    const title =
                      redemption.offer_title ||
                      matchedOffer?.title ||
                      `Offer #${redemption.offer_id}`;
                    const venueName =
                      redemption.venue_name ||
                      matchedOffer?.venue_name ||
                      "";
                    const badgeClasses =
                      status === "verified"
                        ? "border-green-500/40 bg-green-500/20 text-green-300"
                        : status === "expired"
                          ? "border-red-500/40 bg-transparent text-red-300"
                          : "border-amber-400/40 bg-amber-400/15 text-amber-200";
                    const badgeLabel =
                      status === "verified"
                        ? "Verified"
                        : status === "expired"
                          ? "Expired"
                          : "Pending";
                    return (
                      <div
                        key={redemption.id}
                        className={`rounded-[18px] border p-3.5 ${
                          status === "expired"
                            ? "border-[#E7070380] bg-transparent opacity-70 dark:border-white/8 dark:bg-black/25"
                            : "border-[#E7070380] bg-transparent dark:border-white/10 dark:bg-black/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.98rem] font-semibold text-gray-900 dark:text-white">
                              {title}
                              {venueName ? (
                                <span className="ml-1.5 text-[0.82rem] font-normal text-gray-500 dark:text-white/60">
                                  {venueName}
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-1 text-[0.78rem] text-gray-500 dark:text-white/55">
                              {formatDate(redemption.redeemed_at)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex flex-none items-center gap-1 rounded-[10px] border px-2.5 py-1 text-[0.72rem] font-semibold ${badgeClasses}`}
                          >
                            {status === "verified" ? (
                              <Image
                                src="/icons/checked_green.png"
                                alt=""
                                aria-hidden="true"
                                width={12}
                                height={12}
                                className="h-3 w-3 object-contain"
                              />
                            ) : status === "expired" ? (
                              <Image
                                src="/icons/exclamationMark.png"
                                alt=""
                                aria-hidden="true"
                                width={12}
                                height={12}
                                className="h-3 w-3 object-contain"
                              />
                            ) : null}
                            {badgeLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/72">
                  {redemptionsFilter === "all"
                    ? "You have not redeemed any offers yet."
                    : `No ${redemptionsFilter} redemptions.`}
                </div>
              )}
            </section>
          );
        })() : null}

        {activeScreen === "preferences" ? (
          <section ref={preferencesRef} className="relative flex flex-1 flex-col pb-4">
            {!account && !isOnboarding ? (
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
                <div className="mb-2">
                  <h2 className="text-center text-[1.2rem] font-semibold text-gray-900 dark:text-white">
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
                        music_tags: "/prefrences/music.png",
                        bevy_bites_tags: "/prefrences/bevybites.png",
                        experiences_tags: "/prefrences/experiences.png",
                        atmosphere_tags: "/prefrences/atmosphere.png",
                        community_tags: "/prefrences/community.png",
                      };
                      const totalSelected = categories.reduce((sum, key) => {
                        const value = socialProfileDraft[key];
                        return sum + (Array.isArray(value) ? value.length : 0);
                      }, 0);

                      // Group categories into rows of 2 so we can inject the
                      // active category's horizontally-scrolling tag strip
                      // immediately below its row.
                      const rows: Array<typeof categories> = [];
                      for (let i = 0; i < categories.length; i += 2) {
                        rows.push(categories.slice(i, i + 2));
                      }

                      const renderCard = (field: keyof typeof socialTagOptions) => {
                        const isActive = activeTagCategory === field;
                        return (
                          <button
                            key={field}
                            type="button"
                            onClick={() =>
                              setActiveTagCategory((prev) => (prev === field ? prev : field))
                            }
                            className={`relative overflow-hidden rounded-[18px] border bg-white text-left shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition dark:bg-black/30 ${
                              isActive
                                ? "border-red-500 ring-2 ring-red-500/40 dark:border-[#ff7b7b]"
                                : "border-gray-100 dark:border-white/10"
                            }`}
                          >
                            <div className="relative aspect-[4/3] w-full overflow-hidden">
                              <Image
                                src={categoryImage[field]}
                                alt={socialTagLabels[field]}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 45vw, 200px"
                              />
                            </div>
                            <p className="px-2 py-1.5 text-center text-[13px] font-medium text-gray-900 dark:text-white">
                              {socialTagLabels[field]}
                            </p>
                          </button>
                        );
                      };

                      const renderTagStrip = () => (
                        <div className="-mx-4 mt-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          <div className="flex flex-nowrap items-center gap-2">
                            {socialTagOptions[activeTagCategory].map((option) => {
                              const fieldValue = socialProfileDraft[activeTagCategory];
                              const selected = Array.isArray(fieldValue)
                                ? fieldValue.includes(option)
                                : false;
                              return (
                                <button
                                  key={`${activeTagCategory}-${option}`}
                                  type="button"
                                  onClick={() => toggleSocialTag(activeTagCategory, option)}
                                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-medium transition ${
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
                        </div>
                      );

                      return (
                        <>
                          <div className="space-y-2">
                            {rows.map((row, rowIndex) => {
                              const rowContainsActive = row.includes(activeTagCategory);
                              return (
                                <div key={`pref-row-${rowIndex}`}>
                                  <div className="grid grid-cols-2 gap-2">
                                    {row.map(renderCard)}
                                  </div>
                                  {rowContainsActive ? renderTagStrip() : null}
                                </div>
                              );
                            })}
                          </div>

                          <p className="mt-2 text-center text-[12px] text-gray-500 dark:text-white/65">
                            {totalSelected} {totalSelected === 1 ? "tag" : "tags"} selected
                          </p>

                          <button
                            type="button"
                            onClick={() => void handleSaveSocialProfile()}
                            disabled={socialSaving}
                            className="mt-2 w-full rounded-[18px] border border-red-500 bg-red-600 px-4 py-2.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
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
          onAdvanceOnboarding={(email) => {
            setOnboardingEmail(email);
            setIsOnboarding(true);
            navigateTo("preferences");
          }}
          onAccountChange={(nextAccount) => {
            setAccount(nextAccount);
            void hydrateAuthenticatedSession();
            setAccountScreenMode(null);
            const pending = pendingReturnRef.current;
            if (pending) {
              pendingReturnRef.current = null;
              setSelectedEventId(pending.eventId);
              setSelectedEvent(pending.event);
              navigateTo(pending.screen);
            } else {
              setActiveScreen("account");
            }
          }}
        />

        <RoleIdentifierSection
          sectionRef={roleIdentifierRef}
          visible={activeScreen === "role-identifier"}
          onContinue={(roles) => {
            setOnboardingRoles(roles);
            const hasNonConsumerRole = roles.some((role) => role !== "consumer");
            navigateTo(hasNonConsumerRole ? "role-setup" : "onboarding-complete");
          }}
        />

        {activeScreen === "role-unlock" ? (
          <RoleIdentifierSection
            sectionRef={roleUnlockRef}
            visible={true}
            onContinue={() => {
              // TODO: pending states (vendor claim, producer/influencer approval) come later
              navigateTo("home", false);
            }}
          />
        ) : null}

        <RoleSetupSection
          sectionRef={roleSetupRef}
          visible={activeScreen === "role-setup"}
          roles={onboardingRoles.length > 0 ? onboardingRoles : readSelectedRoles()}
          onOpenVendor={() => navigateTo("vendor")}
          onContinue={() => navigateTo("onboarding-complete")}
        />

        <OnboardingCompleteSection
          sectionRef={onboardingCompleteRef}
          visible={activeScreen === "onboarding-complete"}
          email={onboardingEmail}
          onOpenGenie={() => {
            setIsOnboarding(false);
            navigateTo("home", false);
          }}
        />

        <VerifyEmailGate
          visible={verifyGateOpen}
          email={onboardingEmail}
          onClose={() => setVerifyGateOpen(false)}
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
              <div className="rounded-[18px] border border-[#E7070380] bg-transparent px-4 py-4 text-center dark:border-[#E7070380] dark:bg-black/30">
                <p className="text-[2rem] font-bold leading-none text-gray-900 dark:text-white">
                  {offers.length}
                </p>
                <p className="mt-1 text-[0.75rem] font-medium text-red-600 dark:text-white/70">
                  Offers Available
                </p>
              </div>
              <div className="rounded-[18px] border border-[#E7070380] bg-transparent px-4 py-4 text-center dark:border-[#E7070380] dark:bg-black/30">
                <p className="text-[2rem] font-bold leading-none text-gray-900 dark:text-white">
                  {redemptions.length}
                </p>
                <p className="mt-1 text-[0.75rem] font-medium text-red-600 dark:text-white/70">
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
                <p className="text-sm text-gray-500 dark:text-white/60">Loading offers...</p>
              ) : offers.length ? (
                <>
                  <div className="-mx-4 overflow-x-auto">
                    <div className="flex gap-3 px-4 pb-1">
                      {offers.slice(0, 6).map((offer) => (
                        <button
                          key={offer.id}
                          type="button"
                          onClick={() => {
                            setSelectedOfferId(offer.id);
                            navigateTo("offer-detail");
                          }}
                          className="w-[9rem] flex-none rounded-[18px] border border-[#E7070380] bg-transparent p-3 text-left dark:border-[#E7070380] dark:bg-black/35"
                        >
                          <p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-red-600 dark:text-white/55">
                            {offer.offer_type?.replaceAll("_", " ") || "Offer"}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[0.88rem] font-bold leading-snug text-gray-900 dark:text-white">
                            {offer.title}
                          </p>
                          {offer.description ? (
                            <p className="mt-0.5 truncate text-[0.65rem] text-gray-500 dark:text-white/50">
                              {offer.description}
                            </p>
                          ) : null}
                          <span
                            className="mt-2.5 block w-full rounded-[10px] bg-[#e8900a] px-2 py-1.5 text-center text-[0.65rem] font-bold text-white"
                          >
                            View Offer
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo("offers")}
                    className="mt-3 w-full rounded-[16px] border border-red-500 bg-red-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 dark:border-white/15 dark:bg-[rgba(150,15,15,0.55)]"
                  >
                    See All Offers
                  </button>
                </>
              ) : (
                <div className="rounded-[16px] border border-[#E7070380] bg-transparent px-4 py-3 text-sm text-gray-600 dark:bg-black/20 dark:text-white/60">
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
                        className="flex items-center justify-between rounded-[16px] border border-[#E7070380] bg-transparent px-4 py-3 dark:bg-[rgba(60,5,5,0.55)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {matchedOffer?.title || `Offer #${redemption.offer_id}`}
                          </p>
                          {date ? (
                            <p className="mt-0.5 text-[0.72rem] text-gray-500 dark:text-white/50">
                              {date}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`ml-3 inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[0.65rem] font-bold ${
                            isVerified
                              ? "bg-green-600 text-white dark:bg-green-500/20 dark:text-green-400"
                              : "bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-white/55"
                          }`}
                        >
                          {isVerified ? (
                            <Image
                              src="/icons/checked_green.png"
                              alt=""
                              aria-hidden="true"
                              width={12}
                              height={12}
                              className="h-3 w-3 object-contain"
                            />
                          ) : null}
                          {isVerified ? "Verified" : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo("offers")}
                  className="mt-3 w-full rounded-[16px] border border-red-500 bg-red-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 dark:border-white/15 dark:bg-[rgba(150,15,15,0.55)]"
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
                      className="overflow-hidden rounded-[18px] border border-[#E7070380] bg-transparent text-left dark:bg-black/30"
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
                          <Image
                            src="/icons/saved_filled.png"
                            alt=""
                            aria-hidden="true"
                            width={14}
                            height={14}
                            className="h-3.5 w-3.5 object-contain"
                          />
                        </div>
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="line-clamp-1 text-[0.85rem] font-semibold text-gray-900 dark:text-white">
                          {venue.venue_name}
                        </p>
                        <p className="mt-0.5 truncate text-[0.68rem] text-gray-500 dark:text-white/55">
                          {getVenueHeadlineShort(venue)}
                          {(() => {
                            const d = getVenueDistance(venue, index, userCoordsLL);
                            return d ? ` · ${d}` : "";
                          })()}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {buildVenueTags(venue).slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.6rem] font-medium text-gray-600 dark:bg-white/10 dark:text-white/70"
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
            {/* ── RANKED FEED PREVIEW ──────────────────────────────────────────
    Shows top 3 ranked feed posts from ep_get_ranked_feed_dev.
    Full feed tab is a V2 build — this surfaces the algorithm
    result as a preview on the dashboard so it's live for beta.
    Serendipity cards and Genie cards are labeled inline.
────────────────────────────────────────────────────────────── */}
<div>
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-[1.05rem] font-semibold text-gray-900 dark:text-white">
      What&apos;s Happening
    </h2>
    <span className="text-[0.72rem] text-gray-400 dark:text-white/40">
      Ranked for you
    </span>
  </div>

  <div className="rounded-[18px] border border-[#E7070380] bg-transparent px-4 py-4 dark:border-[#E7070380] dark:bg-black/25 text-center">
    <p className="text-[0.85rem] text-gray-500 dark:text-white/55">
      Your personalized feed will appear here once you start saving spots and attending events.
    </p>
    <button
      type="button"
      onClick={goHome}
      className="mt-3 rounded-[14px] border border-red-500 bg-red-600 px-5 py-2 text-[0.82rem] font-semibold text-white"
    >
      Ask Genie something
    </button>
  </div>
</div>
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
                socialProfile={socialProfile}
                isVibeeMember={isVibeeMember}
                onEditPreferences={() => navigateTo("preferences")}
                onOpenMembership={() => navigateTo("membership")}
                onUpgradeMembership={() => navigateTo("membership")}
                onOpenNotifications={() => navigateTo("notification-settings")}
                onBack={() => goBack("home")}
                onSave={async (data) => {
                  if (!account) return;
                  const { updateUserProfile } = await import(
                    "@/app/lib/publicApiClient"
                  );
                  await updateUserProfile({
                    first_name: data.firstName,
                    last_name: data.lastName,
                    phone: data.phone,
                    display_name: data.displayName,
                    avatar_url: data.avatarUrl,
                  });
                  const updated = {
                    ...account,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    phone: data.phone,
                    displayName: data.displayName,
                    avatarUrl: data.avatarUrl,
                  };
                  setAccount(updated);
                  const { writeConsumerAccount } = await import(
                    "@/app/lib/localState"
                  );
                  writeConsumerAccount(updated);
                }}
                onDeleteAccount={async () => {
                  const { deleteAccount } = await import(
                    "@/app/lib/publicApiClient"
                  );
                  await deleteAccount();
                  const { clearConsumerSession } = await import(
                    "@/app/lib/localState"
                  );
                  try {
                    clearConsumerSession();
                  } catch {
                    // best-effort — fall through to reload
                  }
                  setAccount(null);
                  if (typeof window !== "undefined") {
                    window.location.href = "/";
                  }
                }}
              />
            )}
          </section>
        ) : null}

        {/* ── NOTIFICATION SETTINGS ── */}
        {activeScreen === "notification-settings" ? (
          <NotificationSettingsSection
            visible
            onBack={() => goBack("profile")}
          />
        ) : null}

        {/* ── CONTACT ── */}
        {activeScreen === "contact" ? (
          <section className="pb-8">
            <div className="mb-5 flex items-center">
              <button
                type="button"
                onClick={() => goBack("home")}
                aria-label="Go back"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
              >
                <BackIcon size={20} />
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
              <div className="rounded-[20px] border border-green-600/25 bg-green-50/80 px-4 py-6 text-center dark:border-green-500/30 dark:bg-green-500/10">
                <p className="text-base font-semibold text-green-950 dark:text-white">Message sent!</p>
                <p className="mt-1 text-sm text-green-800 dark:text-white/65">We&apos;ll get back to you shortly.</p>
                <button
                  type="button"
                  onClick={() => { setContactSent(false); setContactError(null); setContactForm({ firstName: "", lastName: "", email: "", subject: "", description: "" }); }}
                  className="mt-4 rounded-[14px] border border-green-700/20 bg-white/75 px-5 py-2 text-sm font-semibold text-green-900 dark:border-white/20 dark:bg-white/10 dark:text-white"
                >
                  Send another
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setContactError(null);
                  setContactSending(true);
                  try {
                    await submitContactForm({
                      first_name: contactForm.firstName,
                      last_name: contactForm.lastName,
                      email: contactForm.email,
                      topic: contactForm.subject,
                      message: contactForm.description,
                      source: "app",
                    });
                    setContactSent(true);
                  } catch (err) {
                    setContactError(
                      err instanceof Error
                        ? err.message
                        : "Could not send your message. Please try again."
                    );
                  } finally {
                    setContactSending(false);
                  }
                }}
                className="space-y-3"
              >
                {(
                  [
                    { key: "firstName", label: "First Name", placeholder: "First Name", type: "text" },
                    { key: "lastName", label: "Last Name", placeholder: "Last Name", type: "text" },
                    { key: "email", label: "Email", placeholder: "Email", type: "email" },
                    { key: "subject", label: "Topic", placeholder: "Topic", type: "text" },
                  ] as Array<{ key: keyof typeof contactForm; label: string; placeholder: string; type: string }>
                ).map(({ key, placeholder, type }) => (
                  <input
                    key={key}
                    type={type}
                    value={contactForm[key]}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ fontSize: "16px" }}
                    className="w-full rounded-[14px] border border-red-200/70 bg-white/65 px-4 py-3.5 text-gray-950 placeholder:text-gray-500 focus:border-red-500 focus:outline-none dark:border-white/15 dark:bg-black/25 dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/30"
                  />
                ))}
                <textarea
                  value={contactForm.description}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Message"
                  rows={4}
                  style={{ fontSize: "16px" }}
                  className="w-full resize-none rounded-[14px] border border-red-200/70 bg-white/65 px-4 py-3.5 text-gray-950 placeholder:text-gray-500 focus:border-red-500 focus:outline-none dark:border-white/15 dark:bg-black/25 dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/30"
                />
                {contactError ? (
                  <p className="text-center text-sm text-red-600 dark:text-red-300">
                    {contactError}
                  </p>
                ) : null}
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
                >
                  <BackIcon size={20} />
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
                            <Image
                              src="/icons/checked_green.png"
                              alt=""
                              aria-hidden="true"
                              width={16}
                              height={16}
                              className="h-4 w-4 flex-none object-contain"
                            />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {trialError ? (
  <div className="rounded-[14px] border border-red-300 bg-red-50 px-4 py-3 text-[0.82rem] text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
    {trialError}
  </div>
) : null}
                    <button
  type="button"
  onClick={async () => {
    try {
      setTrialLoading(true);
      const { checkout_url } = await createSubscriptionCheckout({});
      window.location.href = checkout_url;
    } catch {
      setTrialError("Something went wrong. Please try again.");
    } finally {
      setTrialLoading(false);
    }
  }}
  disabled={trialLoading}
  className="w-full rounded-[18px] border border-red-500 bg-red-600 py-4 text-sm font-semibold text-white disabled:opacity-60 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
>
  {trialLoading ? "Loading..." : "Become a V.I.Bee — $2.99/mo"}
</button>
                  </>
                ) : null}
              </div>
            </section>
          );
        })() : null}
        {activeScreen === "event-detail" && selectedEvent ? (
          <EventDetailSection
            eventId={selectedEventId}
            initialData={selectedEvent}
            onBack={handleTopBack}
            logInteraction={logEventInteraction}
            onEventOpen={(evt) => {
              setSelectedEventSlug((evt.public_slug as string) ?? null);
              setSelectedEventId(evt.id as number);
              setSelectedEvent(evt);
            }}
            onAuthRequired={() => {
              pendingReturnRef.current = {
                screen: "event-detail",
                eventId: selectedEventId,
                event: selectedEvent,
              };
              navigateTo("account");
            }}
          />
        ) : null}

{activeScreen === "producer-dashboard" ? (
  <ProducerSection
    account={account}
    onBack={() => goBack("homescreen")}
  />
) : null}

{activeScreen === "influencer-dashboard" ? (
  <InfluencerSection account={account} onNavigate={navigateTo} />
) : null}

{activeScreen === "homescreen" ? (
  <HomescreenSection
    account={account}
    navigateTo={navigateTo}
    userCoords={userCoords}
    onVenueOpen={(id) => {
      setSharedVenueLoading(true);
      setSelectedVenueId(String(id));
      navigateTo("detail");
    }}
    onEventOpen={(evt) => {
      setSelectedEventId(evt.id);
      setSelectedEvent(evt as Record<string, unknown>);
      navigateTo("event-detail");
    }}
    onMenuOpen={() => setIsDrawerOpen(true)}
    onOrbTap={startListening}
    onNotifications={() => navigateTo("notifications")}
    unreadNotifCount={unreadNotifCount}
    onMessages={() => navigateTo("messages")}
    unreadMessageCount={unreadMessageCount}
  />
) : null}

{activeScreen === "notifications" ? (
  <NotificationsScreen
    onBack={() => goBack("homescreen")}
    onClearUnread={() => setUnreadNotifCount(0)}
  />
) : null}

{activeScreen === "messages" ? (
  <MessagesScreen
    account={account}
    onBack={() => goBack("homescreen")}
    onOpenConversation={(conv) => {
      setActiveConversation(conv);
      navigateTo("conversation");
    }}
  />
) : null}

{activeScreen === "conversation" && activeConversation ? (
  <ConversationScreen
    account={account}
    threadId={activeConversation.threadId}
    threadType={activeConversation.threadType}
    counterpartId={activeConversation.counterpartId}
    counterpartName={activeConversation.counterpartName}
    counterpartAvatarUrl={activeConversation.counterpartAvatarUrl}
    viewerRole={activeConversation.viewerRole}
    onBack={() => goBack("messages")}
    onThreadCreated={(threadId, viewerRole) =>
      setActiveConversation((prev) =>
        prev ? { ...prev, threadId, viewerRole: viewerRole ?? prev.viewerRole } : prev
      )
    }
  />
) : null}

</div>

{shouldShowFooter ? (
  <BottomDock
    activeId={activeScreen}
    onHome={() => navigateTo("homescreen")}
    onCenter={() => navigateTo("home")}
    onProfile={() => (account ? navigateTo("dashboard") : navigateTo("account"))}
    onOffers={() => navigateTo("offers")}
    onEvents={() => navigateTo("events-tab")}
  />
) : null}

</main>
  );
}

