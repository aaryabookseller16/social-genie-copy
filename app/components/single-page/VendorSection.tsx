"use client";

import Image from "next/image";
import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useState,
} from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import { type RuntimeConfig } from "@/app/lib/genieTypes";
import { type GenieVenue } from "@/app/lib/genieClient";
import { type ConsumerAccount, readConsumerAccount, writeConsumerAccount } from "@/app/lib/localState";
import {
  createSubscriptionCheckout,
  createVendorBusiness,
  fetchVendorDashboard,
  searchVendorBusinesses,
  updateVendorProfile,
  vendorOnboardingSearch,
  vendorOnboardingContact,
  vendorOnboardingConfirm,
} from "@/app/lib/publicApiClient";
import {
  readVendorDraft,
  writeVendorDraft,
  clearVendorDraft,
} from "@/app/lib/vendorOnboarding";

import { ActionButton } from "./ui";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type VendorStep =
  | "claim"
  | "finding"
  | "not-found"
  | "match"
  | "contact"
  | "location"
  | "plan"
  | "success"
  | "manual-info"
  | "manual-location"
  | "manual-profile"
  | "manual-contact"
  | "dashboard"
  | "profile";

type VendorContactState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type ManualBusinessInfo = {
  businessName: string;
  category: string;
  cuisine: string;
  phone: string;
  website: string;
  reservationUrl: string;
  instagram: string;
};

type ManualLocationInfo = {
  address: string;
  city: string;
  state: string;
  zip: string;
  neighborhood: string;
};

type ManualProfileInfo = {
  shortDescription: string;
  priceBand: string;
  music: string;
  hookah: string;
  happyHour: string;
  mainPhotoUrl: string;
};

type ManualContactInfo = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleTitle: string;
};

type FullDashboardData = {
  vendor_id: number;
  business_name: string;
  email: string;
  plan_selected: string;
  is_live: boolean;
  plan_selected_at: number;
  onboarding_completed: boolean;
  is_pro: boolean;
  offers: Array<{
    id: number;
    title: string;
    offer_type: string;
    member_only?: boolean;
    active?: boolean;
    redeem_instructions?: string | null;
    schedule_json?: Record<string, unknown> | null;
  }>;
  offer_count: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isEmailValid(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function createContactState(
  account: ConsumerAccount | null
): VendorContactState {
  return {
    firstName: account?.firstName ?? "",
    lastName: account?.lastName ?? "",
    email: account?.email ?? "",
    phone: account?.phone ?? "",
  };
}

function getVenueId(venue: GenieVenue) {
  return String(venue.id);
}

function tierLabel(planTier: string) {
  return planTier === "pro" ? "PRO" : "Basic";
}

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  const stars: string[] = [];
  for (let i = 0; i < full; i++) stars.push("★");
  if (half) stars.push("½");
  return stars.join("");
}

/* ------------------------------------------------------------------ */
/*  Small presentational pieces                                        */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  icon,
  locked,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  locked?: boolean;
}) {
  if (locked) return null;
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-5 dark:border-white/10 dark:bg-black/20">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-[#ff7b7b]">
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-[13px] text-gray-500 dark:text-white/55">{label}</p>
    </div>
  );
}

function ProgressBar({ step }: { step: number }) {
  const total = 4;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={`pb-${i}`}
          className={`h-[3px] flex-1 rounded-full ${
            i < step ? "bg-red-600" : "bg-gray-200 dark:bg-white/12"
          }`}
        />
      ))}
    </div>
  );
}

function VendorInput({
  value,
  placeholder,
  type = "text",
  onChange,
  label,
}: {
  value: string;
  placeholder: string;
  type?: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
      />
    </div>
  );
}

function SelectInput({
  value,
  placeholder,
  options,
  onChange,
  label,
}: {
  value: string;
  placeholder: string;
  options: string[];
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-[15px] text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:focus:border-[#ff6a6a]"
      >
        <option value="">
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function VendorSection({
  visible,
  sectionRef,
  account,
  config,
  onContinueHome,
  onOpenAccount,
  onRefreshSession,
}: {
  visible: boolean;
  sectionRef: RefObject<HTMLElement | null>;
  account: ConsumerAccount | null;
  config: RuntimeConfig;
  onContinueHome: () => void;
  onOpenAccount: () => void;
  onRefreshSession?: () => void;
}) {
  const [initialDraft] = useState(() => readVendorDraft());
  const [step, setStep] = useState<VendorStep>(() => {
    // If account already has a vendorId, go straight to dashboard
    if (account?.vendorId) return "dashboard";
    // Resume from saved step if vendor_id exists (in-progress onboarding)
    if (initialDraft.vendorId && initialDraft.currentStep) {
      const saved = initialDraft.currentStep as VendorStep;
      if (["contact", "plan", "success", "dashboard", "manual-info", "manual-location", "manual-profile", "manual-contact"].includes(saved)) {
        return saved;
      }
    }
    return "claim";
  });
  const [searchInput, setSearchInput] = useState(
    () => initialDraft.searchText ?? ""
  );
  const [suggestions, setSuggestions] = useState<GenieVenue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [candidate, setCandidate] = useState<GenieVenue | null>(null);
  const [contact, setContact] = useState<VendorContactState>(() =>
    createContactState(account)
  );
  const [entryMode, setEntryMode] = useState<"match" | "manual">(
    initialDraft.isManualEntry ? "manual" : "match"
  );
  const [selectedPlan, setSelectedPlan] = useState<
    "basic" | "pro" | "boost" | null
  >(() =>
    initialDraft.selectedPlanId === "basic" ||
    initialDraft.selectedPlanId === "pro" ||
    initialDraft.selectedPlanId === "boost"
      ? initialDraft.selectedPlanId
      : null
  );
  const [locationEnabled, setLocationEnabled] = useState<boolean | null>(
    typeof initialDraft.locationEnabled === "boolean"
      ? initialDraft.locationEnabled
      : null
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [vendorId, setVendorId] = useState<number | null>(
    () => initialDraft.vendorId ?? null
  );
  const [onboardingId, setOnboardingId] = useState<number | null>(
    () => initialDraft.onboardingId ?? null
  );

  const [manualInfo, setManualInfo] = useState<ManualBusinessInfo>({
    businessName: initialDraft.searchText ?? "",
    category: "",
    cuisine: "",
    phone: "",
    website: "",
    reservationUrl: "",
    instagram: "",
  });
  const [manualLocation, setManualLocation] = useState<ManualLocationInfo>({
    address: "",
    city: "Houston",
    state: "TX",
    zip: "",
    neighborhood: "",
  });
  const [manualProfile, setManualProfile] = useState<ManualProfileInfo>({
    shortDescription: "",
    priceBand: "",
    music: "",
    hookah: "",
    happyHour: "",
    mainPhotoUrl: "",
  });
  const [manualContact, setManualContact] = useState<ManualContactInfo>({
    firstName: account?.firstName ?? "",
    lastName: account?.lastName ?? "",
    email: account?.email ?? "",
    phone: account?.phone ?? "",
    roleTitle: "",
  });

  const [dashboardData, setDashboardData] =
    useState<FullDashboardData | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    description: "",
    phone: "",
    website_url: "",
    reservation_url: "",
    hours: "",
    image_primary_url: "",
  });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const progressStep: Record<VendorStep, number> = {
    claim: 1,
    finding: 1,
    "not-found": 1,
    match: 1,
    contact: 2,
    "manual-info": 1,
    "manual-location": 2,
    "manual-profile": 3,
    "manual-contact": 3,
    location: 3,
    plan: 3,
    success: 4,
    dashboard: 4,
    profile: 4,
  };

  useEffect(() => {
    if (!account) {
      setContact(createContactState(null));
      return;
    }
    setContact((c) => ({
      firstName: c.firstName || account.firstName,
      lastName: c.lastName || account.lastName,
      email: c.email || account.email,
      phone: c.phone || account.phone || "",
    }));
    setManualContact((c) => ({
      ...c,
      firstName: c.firstName || account.firstName,
      lastName: c.lastName || account.lastName,
      email: c.email || account.email,
      phone: c.phone || account.phone || "",
    }));
  }, [account]);

  useEffect(() => {
    if (!visible || !account || step !== "claim") return;
    trackEvent(analyticsEvents.vendorClaimStarted);
  }, [account, step, visible]);

  useEffect(() => {
    if (!visible) return;
    const vid = account?.vendorId || initialDraft.vendorId;
    if (!vid) return;
    if (step === "claim") {
      setVendorId(vid);
      setStep("dashboard");
    }
  }, [visible, account, step, initialDraft.vendorId]);

  const loadDashboard = useCallback(async () => {
    const vid = vendorId ?? account?.vendorId;
    if (!vid) return;

    setIsDashboardLoading(true);
    try {
      const data = await fetchVendorDashboard(vid);
      setDashboardData(data);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not load dashboard data."
      );
    } finally {
      setIsDashboardLoading(false);
    }
  }, [vendorId, account]);

  useEffect(() => {
    if (!visible || step !== "dashboard") return;
    void loadDashboard();
  }, [visible, step, loadDashboard]);

  /** Persist vendor_id into ConsumerAccount localStorage so dashboard survives refresh */
  const persistVendorIdToAccount = (vid: number) => {
    const current = readConsumerAccount();
    if (current) {
      writeConsumerAccount({ ...current, vendorId: vid });
    }
    // Also keep it in the draft as a fallback for non-authenticated users
    writeVendorDraft({ vendorId: vid, currentStep: "dashboard" });
  };

  useEffect(() => {
    if (
      !visible ||
      step !== "claim" ||
      searchInput.trim().length < 2
    ) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchVendorBusinesses(searchInput.trim());
          if (cancelled) return;
          setSuggestions(results);
          setIsSearching(false);
          if (results.length) {
            trackEvent(analyticsEvents.vendorBusinessSuggestionShown, {
              searchText: searchInput,
              suggestionCount: results.length,
            });
          }
        } catch {
          if (cancelled) return;
          setSuggestions([]);
          setIsSearching(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchInput, step, visible]);

  if (!visible) return null;

  if (!account) {
    return (
      <section
        ref={sectionRef}
        className="relative min-h-screen overflow-hidden px-5 pb-32 pt-14"
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-center">
          <div className="relative mb-6 h-28 w-28 overflow-hidden rounded-full border-2 border-red-400/40">
            <Image
              src="/genie-profile-pic.png"
              alt="Genie"
              fill
              className="object-cover"
            />
          </div>
          <h2 className="text-center text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Claim your business on Genie
          </h2>
          <p className="mt-3 text-center text-[15px] leading-relaxed text-gray-500 dark:text-white/60">
            Get discovered by people looking for spots like yours.
          </p>
          <div className="mt-8 w-full space-y-3">
            <ActionButton onClick={onOpenAccount} className="w-full">
              Create Account to Get Started
            </ActionButton>
            <ActionButton
              onClick={onContinueHome}
              variant="secondary"
              className="w-full"
            >
              Back to Home
            </ActionButton>
          </div>
        </div>
      </section>
    );
  }

  const goBack = () => {
    setStatusMessage(null);
    setProfileMessage(null);
    switch (step) {
      case "claim":
      case "dashboard":
        onContinueHome();
        break;
      case "profile":
        setStep("dashboard");
        break;
      case "finding":
      case "not-found":
      case "match":
        setStep("claim");
        break;
      case "contact":
        setStep(candidate ? "match" : "claim");
        break;
      case "manual-info":
        setStep("not-found");
        break;
      case "manual-location":
        setStep("manual-info");
        break;
      case "manual-profile":
        setStep("manual-location");
        break;
      case "manual-contact":
        setStep("manual-profile");
        break;
      case "plan":
        setStep("contact");
        break;
      case "location":
        setStep(entryMode === "manual" ? "manual-contact" : "contact");
        break;
      case "success":
        onContinueHome();
        break;
      default:
        onContinueHome();
    }
  };

  const runSearch = async (searchText: string) => {
    const trimmed = searchText.trim();
    if (!trimmed) return;

    setStep("finding");
    setStatusMessage(null);
    setIsSubmitting(true);
    writeVendorDraft({ ...readVendorDraft(), searchText: trimmed });
    trackEvent(analyticsEvents.vendorBusinessSearchStarted, {
      searchText: trimmed,
    });

    try {
      const results = await searchVendorBusinesses(trimmed);
      const match =
        results.find(
          (v) => v.venue_name.toLowerCase() === trimmed.toLowerCase()
        ) ??
        results[0] ??
        null;

      if (match) {
        setCandidate(match);
        setEntryMode("match");
        setStep("match");
        writeVendorDraft({
          ...readVendorDraft(),
          searchText: trimmed,
          matchedBusinessId: getVenueId(match),
        });
        trackEvent(analyticsEvents.vendorBusinessSearchCompleted, {
          matchedBusinessId: getVenueId(match),
        });
      } else {
        setCandidate(null);
        setStep("not-found");
        trackEvent(analyticsEvents.vendorBusinessSearchNoMatch, {
          searchText: trimmed,
        });
      }
    } catch (error) {
      setStep("claim");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not search businesses right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMatch = async () => {
    if (!candidate) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const result = await vendorOnboardingSearch({
        business_name: candidate.venue_name,
      });
      setVendorId(result.vendor_id);
      setOnboardingId(result.onboarding_id);
      writeVendorDraft({
        ...readVendorDraft(),
        vendorId: result.vendor_id,
        onboardingId: result.onboarding_id,
        currentStep: "contact",
      });
      setStep("contact");
      trackEvent(analyticsEvents.vendorBusinessConfirmed, {
        matchedBusinessId: getVenueId(candidate),
      });
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not start onboarding."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContactSubmit = async () => {
    if (!vendorId || !onboardingId) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await vendorOnboardingContact({
        vendor_id: vendorId,
        onboarding_id: onboardingId,
        first_name: contact.firstName.trim(),
        last_name: contact.lastName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim() || undefined,
      });
      await vendorOnboardingConfirm({
        vendor_id: vendorId,
        onboarding_id: onboardingId,
        confirmed: true,
      });
      writeVendorDraft({
        ...readVendorDraft(),
        vendorId,
        onboardingId,
        currentStep: "plan",
      });
      setStep("plan");
      trackEvent(analyticsEvents.vendorContactInfoCompleted);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not save contact info."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeRegistration = async () => {
    if (!selectedPlan) {
      setStatusMessage("Pick a plan before continuing.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      let finalVendorId = vendorId;

      if (entryMode === "manual") {
        const createResult = await createVendorBusiness({
          business_name: manualInfo.businessName.trim(),
          full_name: `${manualContact.firstName} ${manualContact.lastName}`.trim(),
          email: manualContact.email.trim(),
          phone: manualContact.phone.trim() || undefined,
          address: manualLocation.address.trim(),
          city: manualLocation.city.trim(),
          state: manualLocation.state.trim(),
          zip: manualLocation.zip.trim(),
          neighborhood: manualLocation.neighborhood.trim(),
          category: manualInfo.category,
          cuisine: manualInfo.cuisine,
          website: manualInfo.website,
          reservation_url: manualInfo.reservationUrl,
          instagram: manualInfo.instagram,
          short_description: manualProfile.shortDescription,
          price_band: manualProfile.priceBand,
          music: manualProfile.music,
          hookah: manualProfile.hookah,
          happy_hour: manualProfile.happyHour,
          main_photo_url: manualProfile.mainPhotoUrl,
          role_title: manualContact.roleTitle,
        });
        setVendorId(createResult.vendor_id);
        if (createResult.onboarding_id) {
          setOnboardingId(createResult.onboarding_id);
        }
        finalVendorId = createResult.vendor_id;
        writeVendorDraft({
          ...readVendorDraft(),
          vendorId: createResult.vendor_id,
          onboardingId: createResult.onboarding_id,
          currentStep: "plan",
        });

        trackEvent(analyticsEvents.vendorManualAddCompleted, {
          businessName: manualInfo.businessName.trim(),
        });
      }

      if (selectedPlan === "pro" && finalVendorId) {
        // Persist vendor ID before redirecting to Stripe
        persistVendorIdToAccount(finalVendorId);
        const { checkout_url } = await createSubscriptionCheckout({
          vendor_id: finalVendorId,
          plan_type: "founding_partner",
        });
        window.location.href = checkout_url;
        return;
      }

      if (finalVendorId) {
        persistVendorIdToAccount(finalVendorId);
      }
      // Keep vendorId in draft so dashboard loads on refresh
      writeVendorDraft({ vendorId: finalVendorId ?? undefined, currentStep: "dashboard" });
      setStep("success");
      trackEvent(analyticsEvents.vendorRegistrationCompleted, {
        planId: selectedPlan,
        mode: entryMode,
      });

      onRefreshSession?.();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not finish vendor registration right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnableLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationEnabled(false);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    navigator.geolocation.getCurrentPosition(
      () => {
        setIsSubmitting(false);
        setLocationEnabled(true);
        trackEvent(analyticsEvents.vendorLocationEnabled);
      },
      () => {
        setIsSubmitting(false);
        setLocationEnabled(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleSaveProfile = async () => {
    setIsProfileSaving(true);
    setProfileMessage(null);

    try {
      const payload: Record<string, string> = {};
      if (profileForm.description.trim())
        payload.description = profileForm.description.trim();
      if (profileForm.phone.trim()) payload.phone = profileForm.phone.trim();
      if (profileForm.website_url.trim())
        payload.website_url = profileForm.website_url.trim();
      if (profileForm.reservation_url.trim())
        payload.reservation_url = profileForm.reservation_url.trim();
      if (profileForm.hours.trim()) payload.hours = profileForm.hours.trim();
      if (profileForm.image_primary_url.trim())
        payload.image_primary_url = profileForm.image_primary_url.trim();

      await updateVendorProfile(payload);
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Could not update your profile."
      );
    } finally {
      setIsProfileSaving(false);
    }
  };

  const stepTitle: Record<VendorStep, string> = {
    claim:
      searchInput.trim().length >= 2
        ? "Select your business"
        : "Claim your business on Genie",
    finding: "Select your business",
    "not-found": "Add your business",
    match: "Select your business",
    contact: "Your contact info",
    "manual-info": "Business Info",
    "manual-location": "Location - Required",
    "manual-profile": "Genie Profile",
    "manual-contact": "Contact Info",
    location: "Share your location",
    plan: "Choose your plan",
    success: "",
    dashboard: "",
    profile: "Edit Profile",
  };

  const isPro = Boolean(dashboardData?.is_pro);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden px-5 pb-32 pt-6"
    >
      {/* Back arrow + progress bar */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="flex-none text-gray-600 dark:text-white/82"
          aria-label="Go back"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H6m0 0 5-5m-5 5 5 5" />
          </svg>
        </button>
        {step !== "dashboard" && step !== "profile" && (
          <div className="flex-1">
            <ProgressBar step={progressStep[step]} />
          </div>
        )}
      </div>

      {stepTitle[step] ? (
        <h2 className="mb-1 text-center text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
          {stepTitle[step]}
        </h2>
      ) : null}

      {step === "claim" && searchInput.trim().length < 2 && (
        <p className="mb-6 mt-2 text-center text-[15px] leading-relaxed text-gray-500 dark:text-white/60">
          Get discovered by people looking for spots like yours.
        </p>
      )}

      {/* ======== STEP: CLAIM ======== */}
      {step === "claim" && (
        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-[#b74c4c]/55 dark:bg-black/20">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 flex-none text-gray-400 dark:text-white/42"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                trackEvent(analyticsEvents.vendorBusinessSearchTyped, {
                  searchText: e.target.value,
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runSearch(searchInput);
                }
              }}
              placeholder="Search your business name"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white dark:placeholder:text-white/30"
            />
          </div>

          {suggestions.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-[#b74c4c]/55 dark:bg-black/20">
              {suggestions.map((venue, idx) => (
                <button
                  key={`sug-${venue.id}`}
                  type="button"
                  onClick={() => {
                    setSearchInput(venue.venue_name);
                    trackEvent(
                      analyticsEvents.vendorBusinessSuggestionSelected,
                      { businessId: getVenueId(venue), venueName: venue.venue_name }
                    );
                    void runSearch(venue.venue_name);
                  }}
                  className={`w-full px-4 py-3.5 text-left transition hover:bg-gray-50 dark:hover:bg-white/5 ${
                    idx < suggestions.length - 1
                      ? "border-b border-gray-100 dark:border-white/10"
                      : ""
                  }`}
                >
                  <p className="text-[15px] font-medium text-gray-900 dark:text-white">
                    {venue.venue_name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-gray-400 dark:text-white/42">
                    {venue.address || venue.area_neighborhood || "Houston"}
                  </p>
                </button>
              ))}
            </div>
          )}

          {isSearching && searchInput.trim().length >= 2 && (
            <p className="pt-1 text-center text-sm text-gray-400 dark:text-white/42">
              Searching. . .
            </p>
          )}

          {!isSearching &&
            suggestions.length === 0 &&
            searchInput.trim().length < 2 && (
              <p className="mt-2 text-[13px] text-gray-400 dark:text-white/42">
                We&apos;ll match your business so you don&apos;t have to start
                from scratch
              </p>
            )}
        </div>
      )}

      {/* ======== STEP: FINDING ======== */}
      {step === "finding" && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-[#b74c4c]/55 dark:bg-black/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-gray-400 dark:text-white/42" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
            </svg>
            <span className="text-[15px] text-gray-900 dark:text-white">{searchInput}</span>
          </div>
          <p className="pt-1 text-center text-sm text-gray-400 dark:text-white/42">Searching. . .</p>
        </div>
      )}

      {/* ======== STEP: NOT-FOUND ======== */}
      {step === "not-found" && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-[#b74c4c]/55 dark:bg-black/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-gray-400 dark:text-white/42" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
            </svg>
            <span className="text-[15px] text-gray-900 dark:text-white">{searchInput || "Your search"}</span>
          </div>
          <div className="text-[13px] leading-relaxed text-gray-500 dark:text-white/60">
            <p>Sorry we didn&apos;t find &ldquo;{searchInput}&rdquo;</p>
            <p>Please check your details or add it manually.</p>
          </div>
          <ActionButton
            onClick={() => {
              setEntryMode("manual");
              setManualInfo((c) => ({ ...c, businessName: searchInput }));
              writeVendorDraft({
                ...readVendorDraft(),
                isManualEntry: true,
                currentStep: "manual-info",
              });
              setStep("manual-info");
              trackEvent(analyticsEvents.vendorManualAddStarted);
            }}
            className="w-full"
          >
            Add my business manually
          </ActionButton>
        </div>
      )}

      {/* ======== STEP: MATCH ======== */}
      {step === "match" && candidate && (
        <div className="mt-5 space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-5 text-center dark:border-white/10 dark:bg-black/20">
            <p className="text-[17px] font-semibold text-gray-900 dark:text-white">
              {candidate.venue_name}
            </p>
            <p className="mt-1.5 text-[13px] text-gray-500 dark:text-white/55">
              {candidate.address ||
                `${candidate.area_neighborhood || "Midtown"}, ${candidate.city || "Houston"}`}
            </p>
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-white/60">Is this your business?</p>
          <ActionButton
            onClick={() => void handleConfirmMatch()}
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Confirming..." : "Yes, This is my business"}
          </ActionButton>
          <button
            type="button"
            onClick={() => {
              setEntryMode("manual");
              setStep("not-found");
              trackEvent(analyticsEvents.vendorBusinessRejected, {
                matchedBusinessId: getVenueId(candidate),
              });
            }}
            className="w-full py-3 text-center text-[14px] text-gray-500 transition hover:text-gray-600 dark:text-white/60 dark:hover:text-white/80"
          >
            My business isn&apos;t listed
          </button>
        </div>
      )}

      {/* ======== STEP: CONTACT ======== */}
      {step === "contact" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (
              !contact.firstName.trim() ||
              !contact.lastName.trim() ||
              !isEmailValid(contact.email)
            ) {
              setStatusMessage("Enter a valid name and email before continuing.");
              return;
            }
            setStatusMessage(null);
            void handleContactSubmit();
          }}
        >
          <VendorInput value={contact.firstName} placeholder="First Name" onChange={(v) => setContact((c) => ({ ...c, firstName: v }))} />
          <VendorInput value={contact.lastName} placeholder="Last Name" onChange={(v) => setContact((c) => ({ ...c, lastName: v }))} />
          <VendorInput type="email" value={contact.email} placeholder="Email" onChange={(v) => setContact((c) => ({ ...c, email: v }))} />
          <VendorInput value={contact.phone} placeholder="Phone (optional)" onChange={(v) => setContact((c) => ({ ...c, phone: v }))} />
          <p className="text-[13px] text-gray-400 dark:text-white/42">
            We&apos;ll only use this to contact you about your account.
          </p>
          <ActionButton type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Next"}
          </ActionButton>
        </form>
      )}

      {/* ======== STEP: MANUAL — Business Info ======== */}
      {step === "manual-info" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (!manualInfo.businessName.trim()) {
              setStatusMessage("Business name is required.");
              return;
            }
            setStatusMessage(null);
            setStep("manual-location");
          }}
        >
          <VendorInput label="Business Name" value={manualInfo.businessName} placeholder="Business Name" onChange={(v) => setManualInfo((c) => ({ ...c, businessName: v }))} />
          <SelectInput label="Category / Type" value={manualInfo.category} placeholder="restaurant, bar, & grill" options={["Restaurant", "Bar", "Lounge", "Club", "Cafe", "Food Truck", "Other"]} onChange={(v) => setManualInfo((c) => ({ ...c, category: v }))} />
          <VendorInput label="Cuisine" value={manualInfo.cuisine} placeholder="Seafood, Mexican, Italian" onChange={(v) => setManualInfo((c) => ({ ...c, cuisine: v }))} />
          <VendorInput label="Phone" value={manualInfo.phone} placeholder="Phone" onChange={(v) => setManualInfo((c) => ({ ...c, phone: v }))} />
          <VendorInput label="Website" value={manualInfo.website} placeholder="Website" type="url" onChange={(v) => setManualInfo((c) => ({ ...c, website: v }))} />
          <VendorInput label="Reservation Link (if available)" value={manualInfo.reservationUrl} placeholder="Reservation URL" type="url" onChange={(v) => setManualInfo((c) => ({ ...c, reservationUrl: v }))} />
          <VendorInput label="Instagram" value={manualInfo.instagram} placeholder="Instagram" onChange={(v) => setManualInfo((c) => ({ ...c, instagram: v }))} />
          <ActionButton type="submit" className="w-full">Next</ActionButton>
        </form>
      )}

      {/* ======== STEP: MANUAL — Location ======== */}
      {step === "manual-location" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (!manualLocation.address.trim()) {
              setStatusMessage("Street address is required.");
              return;
            }
            setStatusMessage(null);
            setStep("manual-profile");
          }}
        >
          <VendorInput label="Street Address" value={manualLocation.address} placeholder="Street Address" onChange={(v) => setManualLocation((c) => ({ ...c, address: v }))} />
          <VendorInput label="City" value={manualLocation.city} placeholder="City" onChange={(v) => setManualLocation((c) => ({ ...c, city: v }))} />
          <VendorInput label="State" value={manualLocation.state} placeholder="State" onChange={(v) => setManualLocation((c) => ({ ...c, state: v }))} />
          <VendorInput label="Zip" value={manualLocation.zip} placeholder="Zip" onChange={(v) => setManualLocation((c) => ({ ...c, zip: v }))} />
          <VendorInput label="Neighborhood" value={manualLocation.neighborhood} placeholder="Neighborhood" onChange={(v) => setManualLocation((c) => ({ ...c, neighborhood: v }))} />
          <ActionButton type="submit" className="w-full">Next</ActionButton>
        </form>
      )}

      {/* ======== STEP: MANUAL — Genie Profile ======== */}
      {step === "manual-profile" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            setStep("manual-contact");
          }}
        >
          <VendorInput label="Short Description / Vibe" value={manualProfile.shortDescription} placeholder="Short Description / Vibe" onChange={(v) => setManualProfile((c) => ({ ...c, shortDescription: v }))} />
          <SelectInput label="Price Band" value={manualProfile.priceBand} placeholder="$, $$, $$$, $$$$ - (Optional)" options={["$", "$$", "$$$", "$$$$"]} onChange={(v) => setManualProfile((c) => ({ ...c, priceBand: v }))} />
          <VendorInput label="Music" value={manualProfile.music} placeholder="Music" onChange={(v) => setManualProfile((c) => ({ ...c, music: v }))} />
          <VendorInput label="Hookah" value={manualProfile.hookah} placeholder="Hookah" onChange={(v) => setManualProfile((c) => ({ ...c, hookah: v }))} />
          <VendorInput label="Happy Hour" value={manualProfile.happyHour} placeholder="Happy Hour" onChange={(v) => setManualProfile((c) => ({ ...c, happyHour: v }))} />
          <VendorInput label="Main Photo - Required" value={manualProfile.mainPhotoUrl} placeholder="Main Photo URL" type="url" onChange={(v) => setManualProfile((c) => ({ ...c, mainPhotoUrl: v }))} />
          <ActionButton type="submit" className="w-full">Next</ActionButton>
        </form>
      )}

      {/* ======== STEP: MANUAL — Contact Info ======== */}
      {step === "manual-contact" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (
              !manualContact.firstName.trim() ||
              !manualContact.lastName.trim() ||
              !isEmailValid(manualContact.email)
            ) {
              setStatusMessage("Name and valid email are required.");
              return;
            }
            setStatusMessage(null);
            setEntryMode("manual");
            setStep("plan");
          }}
        >
          <VendorInput label="First Name" value={manualContact.firstName} placeholder="First Name" onChange={(v) => setManualContact((c) => ({ ...c, firstName: v }))} />
          <VendorInput label="Last Name" value={manualContact.lastName} placeholder="Last Name" onChange={(v) => setManualContact((c) => ({ ...c, lastName: v }))} />
          <VendorInput label="Email" type="email" value={manualContact.email} placeholder="Email" onChange={(v) => setManualContact((c) => ({ ...c, email: v }))} />
          <VendorInput label="Phone" value={manualContact.phone} placeholder="Phone" onChange={(v) => setManualContact((c) => ({ ...c, phone: v }))} />
          <VendorInput label="Role / Title" value={manualContact.roleTitle} placeholder="Role / Title" onChange={(v) => setManualContact((c) => ({ ...c, roleTitle: v }))} />
          <ActionButton type="submit" className="w-full">Next</ActionButton>
        </form>
      )}

      {/* ======== STEP: PLAN ======== */}
      {step === "plan" && (
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => {
              setSelectedPlan("basic");
              writeVendorDraft({ ...readVendorDraft(), selectedPlanId: "basic" });
              trackEvent(analyticsEvents.vendorPlanSelected, { planId: "basic" });
            }}
            className={`w-full rounded-2xl border p-5 text-left transition ${
              selectedPlan === "basic"
                ? "border-red-500/60 bg-red-50 shadow-[0_0_24px_rgba(220,38,38,0.08)] dark:border-red-500/40 dark:bg-red-900/20"
                : "border-gray-100 bg-white dark:border-white/10 dark:bg-black/20"
            }`}
          >
            <p className="text-[16px] font-bold text-gray-900 dark:text-white">Basic — Claim Your Spot</p>
            <p className="mt-0.5 text-[14px] font-semibold text-gray-500 dark:text-white/55">Free</p>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-white/60">
              Get discovered on Genie with your basic listing and customer actions.
            </p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-gray-600 dark:text-white/72">
              {config.vendorPlans.basicBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-none text-red-600 dark:text-[#ff7b7b]">•</span>{b}
                </li>
              ))}
            </ul>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedPlan("pro");
              writeVendorDraft({ ...readVendorDraft(), selectedPlanId: "pro" });
              trackEvent(analyticsEvents.vendorPlanSelected, { planId: "pro" });
            }}
            className={`w-full rounded-2xl border p-5 text-left transition ${
              selectedPlan === "pro"
                ? "border-red-500/60 bg-red-50 shadow-[0_0_24px_rgba(220,38,38,0.08)] dark:border-red-500/40 dark:bg-red-900/20"
                : "border-gray-100 bg-white dark:border-white/10 dark:bg-black/20"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[16px] font-bold text-gray-900 dark:text-white">Pro — Get More Visibility</p>
                <p className="mt-0.5 text-[14px] font-semibold text-red-600 dark:text-[#ff7b7b]">{config.vendorPlans.proMonthly}</p>
              </div>
              <span className="flex-none rounded-full bg-[#22c55e] px-2.5 py-1 text-[11px] font-bold text-white">Best Value</span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-white/60">{config.vendorPlans.proDescription}</p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-gray-600 dark:text-white/72">
              {config.vendorPlans.proBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-none text-red-600 dark:text-[#ff7b7b]">•</span>{b}
                </li>
              ))}
            </ul>
          </button>

          <div className="pt-1">
            <ActionButton
              onClick={() => void completeRegistration()}
              className="w-full"
              disabled={isSubmitting || !selectedPlan}
            >
              {isSubmitting ? "Submitting..." : "Continue"}
            </ActionButton>
          </div>
        </div>
      )}

      {/* ======== STEP: SUCCESS ======== */}
      {step === "success" && (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex h-36 w-36 items-center justify-center rounded-full border border-gray-100 bg-red-50 dark:border-white/10 dark:bg-red-900/30">
            <svg viewBox="0 0 24 24" className="h-16 w-16 text-red-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5L20 7" />
            </svg>
          </div>
          <h2 className="mt-7 text-[1.65rem] font-semibold leading-tight text-gray-900 dark:text-white">
            Welcome to Genie {selectedPlan === "pro" ? "Pro" : ""}
          </h2>
          <p className="mt-2 text-[15px] text-gray-500 dark:text-white/60">Your business is live!</p>
          <p className="mt-4 text-[14px] leading-relaxed text-gray-500 dark:text-white/60">
            Your listing is now discoverable by people searching for spots like yours on Genie.
            Check your dashboard to see how you&apos;re performing.
          </p>
          <div className="mt-8 w-full">
            <ActionButton
              onClick={() => {
                trackEvent(analyticsEvents.vendorSuccessContinueTapped);
                setStep("dashboard");
              }}
              className="w-full"
            >
              Go to Dashboard
            </ActionButton>
          </div>
        </div>
      )}

      {/* ======== STEP: DASHBOARD ======== */}
      {step === "dashboard" && (
        <div className="mt-2">
          {isDashboardLoading && !dashboardData ? (
            <div className="flex min-h-[12rem] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-red-600" />
            </div>
          ) : dashboardData ? (
            <div className="space-y-5">
              <div className="text-center">
                <p className="font-[family-name:var(--font-cormorant)] text-xl italic text-gray-500 dark:text-white/60">
                  Genie
                </p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  Welcome to Your Dashboard
                </h2>
                <p className="mt-1 text-[14px] text-gray-500 dark:text-white/60">
                  {dashboardData.business_name}{" "}
                  <span
                    className={`ml-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white ${
                      isPro ? "bg-red-600" : "bg-gray-300"
                    }`}
                  >
                    {tierLabel(isPro ? "pro" : "basic")}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <StatCard
                  label="Offers"
                  value={dashboardData.offer_count}
                  icon={
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 12V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v5" />
                      <path d="M2 12h20" />
                      <path d="M7 16h.01M12 16h.01M17 16h.01" />
                      <path d="M6 19h12" />
                    </svg>
                  }
                />
                <StatCard
                  label="Live Status"
                  value={dashboardData.is_live ? 1 : 0}
                  icon={
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20" />
                      <path d="M2 12h20" />
                    </svg>
                  }
                />
                <StatCard
                  label="Pro Features"
                  value={isPro ? 1 : 0}
                  icon={
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" />
                    </svg>
                  }
                />
              </div>

              {dashboardData.plan_selected_at > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-black/20">
                  <p className="text-[13px] text-gray-500 dark:text-white/55">Plan Selected</p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(dashboardData.plan_selected_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-black/20">
                <p className="text-sm font-medium text-gray-600 dark:text-white/72">
                  Vendor Overview
                </p>
                <div className="mt-3 space-y-2 text-[13px]">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-gray-300">🏢</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {dashboardData.business_name}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-gray-300">✉️</span>
                    <p className="text-gray-500">{dashboardData.email}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-gray-300">📦</span>
                    <p className="text-gray-500">
                      {dashboardData.plan_selected || "basic"}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-gray-300">✅</span>
                    <p className="text-gray-500">
                      {dashboardData.is_live ? "Live on Genie" : "Not live yet"}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-gray-300">🧭</span>
                    <p className="text-gray-500">
                      {dashboardData.onboarding_completed
                        ? "Onboarding complete"
                        : "Onboarding still in progress"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-black/20">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-600 dark:text-white/72">
                    Active Offers
                  </p>
                  <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
                    {dashboardData.offer_count}
                  </span>
                </div>
                {dashboardData.offers.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {dashboardData.offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-black/20"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {offer.title}
                          </p>
                          <span className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/42">
                            {offer.offer_type}
                          </span>
                        </div>
                        {offer.redeem_instructions ? (
                          <p className="mt-1.5 text-[12px] text-gray-500 dark:text-white/55">
                            {offer.redeem_instructions}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] text-gray-500 dark:text-white/55">
                    No active offers yet.
                  </p>
                )}
              </div>

              {!isPro && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-500/30 dark:bg-red-900/20">
                  <p className="text-sm font-medium text-gray-700 dark:text-white/82">
                    Unlock more insights & boost your business
                  </p>
                  <p className="mt-1 text-[12px] text-gray-400 dark:text-white/42">
                    Call clicks, map clicks, reservation clicks, saves,
                    engagement rate, and performance trends
                  </p>
                  <ActionButton
                    onClick={() => {
                      void (async () => {
                        try {
                          const { checkout_url } = await createSubscriptionCheckout({
                            vendor_id: dashboardData.vendor_id,
                            plan_type: "founding_partner",
                          });
                          window.location.href = checkout_url;
                        } catch {
                          setStatusMessage("Could not start upgrade.");
                        }
                      })();
                    }}
                    className="mt-3 w-full"
                  >
                    Upgrade to Pro
                  </ActionButton>
                </div>
              )}

              <div className="space-y-3">
                <ActionButton
                  onClick={() => {
                    setStep("profile");
                    setProfileMessage(null);
                  }}
                  className="w-full"
                >
                  Edit Business Profile
                </ActionButton>
                <ActionButton
                  onClick={() => void loadDashboard()}
                  variant="secondary"
                  className="w-full"
                  disabled={isDashboardLoading}
                >
                  {isDashboardLoading ? "Refreshing..." : "Refresh Metrics"}
                </ActionButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-500 dark:text-white/60">
                Could not load dashboard data.
              </p>
              <ActionButton
                onClick={() => void loadDashboard()}
                variant="secondary"
                className="w-full"
              >
                Try again
              </ActionButton>
            </div>
          )}
        </div>
      )}

      {/* ======== STEP: PROFILE EDIT ======== */}
      {step === "profile" && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            void handleSaveProfile();
          }}
        >
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
              Business Description
            </label>
            <textarea
              value={profileForm.description}
              onChange={(e) =>
                setProfileForm((c) => ({ ...c, description: e.target.value }))
              }
              placeholder="An upscale poolside nightclub with craft cocktails..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]"
            />
          </div>
          <VendorInput value={profileForm.phone} placeholder="Phone number" onChange={(v) => setProfileForm((c) => ({ ...c, phone: v }))} />
          <VendorInput value={profileForm.website_url} placeholder="Website URL" type="url" onChange={(v) => setProfileForm((c) => ({ ...c, website_url: v }))} />
          <VendorInput value={profileForm.reservation_url} placeholder="Reservation URL" type="url" onChange={(v) => setProfileForm((c) => ({ ...c, reservation_url: v }))} />
          <VendorInput value={profileForm.hours} placeholder="Hours (e.g. Open Until 2 AM)" onChange={(v) => setProfileForm((c) => ({ ...c, hours: v }))} />
          <VendorInput value={profileForm.image_primary_url} placeholder="Primary image URL" type="url" onChange={(v) => setProfileForm((c) => ({ ...c, image_primary_url: v }))} />

          <ActionButton type="submit" className="w-full" disabled={isProfileSaving}>
            {isProfileSaving ? "Saving..." : "Save Profile"}
          </ActionButton>
          <ActionButton onClick={() => { setStep("dashboard"); setProfileMessage(null); }} variant="secondary" className="w-full">
            Back to Dashboard
          </ActionButton>

          {profileMessage && (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${
              profileMessage.includes("success")
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-900/20 dark:text-green-400"
                : "border-gray-100 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-black/20 dark:text-white/60"
            }`}>
              {profileMessage}
            </div>
          )}
        </form>
      )}

      {statusMessage && (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-white/10 dark:bg-black/20 dark:text-white/60">
          {statusMessage}
        </div>
      )}
    </section>
  );
}
