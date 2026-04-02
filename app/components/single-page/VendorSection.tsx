"use client";

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
import { type ConsumerAccount } from "@/app/lib/localState";
import {
  claimVendorBusiness,
  createVendorBusiness,
  fetchVendorDashboard,
  searchVendorBusinesses,
  updateVendorProfile,
} from "@/app/lib/publicApiClient";
import {
  readVendorDraft,
  writeVendorDraft,
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
  | "manual"
  | "dashboard"
  | "profile";

type VendorContactState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type VendorManualState = {
  businessName: string;
  address: string;
  cityStateZip: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type DashboardMetrics = {
  views: number;
  clicks: number;
  saves: number;
  genie_appearances: number;
};

type ProfileFormState = {
  description: string;
  phone: string;
  website_url: string;
  reservation_url: string;
  hours: string;
  image_primary_url: string;
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

function createManualState(
  searchText = "",
  account: ConsumerAccount | null = null
): VendorManualState {
  return {
    businessName: searchText,
    address: "",
    cityStateZip: "Houston, TX",
    firstName: account?.firstName ?? "",
    lastName: account?.lastName ?? "",
    email: account?.email ?? "",
    phone: account?.phone ?? "",
  };
}

function getVenueId(venue: GenieVenue) {
  return String(venue.id);
}

function createEmptyProfile(): ProfileFormState {
  return {
    description: "",
    phone: "",
    website_url: "",
    reservation_url: "",
    hours: "",
    image_primary_url: "",
  };
}

/* ------------------------------------------------------------------ */
/*  Small presentational pieces                                        */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#7a3030] bg-black/10 px-3 py-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e83434]/15 text-[#e83434]">
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-[13px] text-white/50">{label}</p>
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
            i < step ? "bg-[#e83434]" : "bg-white/16"
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
}: {
  value: string;
  placeholder: string;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-[#7a3030] bg-transparent px-4 py-3.5 text-[15px] text-white placeholder:text-white/35 focus:border-[#e05050] focus:outline-none"
    />
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
  const [step, setStep] = useState<VendorStep>("claim");
  const [initialDraft] = useState(() => readVendorDraft());
  const [searchInput, setSearchInput] = useState(
    () => initialDraft.searchText ?? ""
  );
  const [suggestions, setSuggestions] = useState<GenieVenue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [candidate, setCandidate] = useState<GenieVenue | null>(null);
  const [contact, setContact] = useState<VendorContactState>(() =>
    createContactState(account)
  );
  const [manual, setManual] = useState<VendorManualState>(() =>
    createManualState(initialDraft.searchText ?? "", account)
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

  /* Dashboard & profile state */
  const [dashboardMetrics, setDashboardMetrics] =
    useState<DashboardMetrics | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(
    createEmptyProfile
  );
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  /* Map steps to 4-segment progress */
  const progressStep: Record<VendorStep, number> = {
    claim: 1,
    finding: 1,
    "not-found": 1,
    match: 1,
    contact: 2,
    manual: 2,
    location: 3,
    plan: 3,
    success: 4,
    dashboard: 4,
    profile: 4,
  };

  /* ---- Effects ---- */

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
    setManual((c) => ({
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
    if (!visible || step !== "location") {
      return;
    }

    trackEvent(analyticsEvents.vendorLocationPromptViewed);
  }, [step, visible]);

  /* Auto-redirect to dashboard if vendor already registered */
  useEffect(() => {
    if (!visible || !account?.vendorId) return;
    if (
      step !== "claim" &&
      step !== "dashboard" &&
      step !== "profile" &&
      step !== "success"
    )
      return;

    // If we arrive on the vendor tab and the user already has a vendor_id,
    // jump straight to the dashboard.
    if (step === "claim") {
      setStep("dashboard");
    }
  }, [visible, account, step]);

  /* Fetch dashboard metrics when on the dashboard step */
  const loadDashboard = useCallback(async () => {
    setIsDashboardLoading(true);
    try {
      const data = await fetchVendorDashboard();
      setDashboardMetrics(data);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not load dashboard data."
      );
    } finally {
      setIsDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || step !== "dashboard") return;
    void loadDashboard();
  }, [visible, step, loadDashboard]);

  /* Live auto-suggest while typing in the claim search */
  useEffect(() => {
    if (
      !visible ||
      !account ||
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
  }, [account, searchInput, step, visible]);

  /* ---- Early returns ---- */

  if (!visible) return null;

  if (!account) {
    return (
      <section
        ref={sectionRef}
        className="relative min-h-screen overflow-hidden px-5 pb-32 pt-14"
      >
        <h2 className="text-center text-[1.65rem] font-semibold leading-tight text-white">
          Claim your business on Genie
        </h2>
        <p className="mt-3 text-center text-[15px] leading-relaxed text-white/55">
          Get discovered by people looking for spots like yours.
        </p>
        <div className="mt-8 space-y-3">
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
      </section>
    );
  }

  /* ---- Navigation ---- */

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
      case "manual":
        setStep("not-found");
        break;
      case "plan":
        setStep("location");
        break;
      case "location":
        setStep(entryMode === "manual" ? "manual" : "contact");
        break;
      case "success":
        onContinueHome();
        break;
      default:
        onContinueHome();
    }
  };

  /* ---- API calls ---- */

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
        trackEvent(analyticsEvents.vendorBusinessMatchViewed, {
          matchedBusinessId: getVenueId(match),
        });
      } else {
        setCandidate(null);
        setStep("not-found");
        trackEvent(analyticsEvents.vendorBusinessSearchNoMatch, {
          searchText: trimmed,
        });
        trackEvent(analyticsEvents.vendorNoMatchScreenViewed, {
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

  const completeRegistration = async () => {
    if (!selectedPlan) {
      setStatusMessage("Pick a plan before continuing.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (entryMode === "manual") {
        await createVendorBusiness({
          business_name: manual.businessName.trim(),
          full_name: `${manual.firstName} ${manual.lastName}`.trim(),
          email: manual.email.trim(),
          phone: manual.phone.trim() || undefined,
          address: manual.address.trim(),
          city_state_zip: manual.cityStateZip.trim() || undefined,
          is_manual_entry: true,
          selected_plan_id: selectedPlan,
          location_enabled:
            locationEnabled === null ? undefined : locationEnabled,
        });
        trackEvent(analyticsEvents.vendorManualAddCompleted, {
          businessName: manual.businessName.trim(),
        });
      } else if (candidate) {
        await claimVendorBusiness({
          venue_id: Number(candidate.id),
          contact_name: `${contact.firstName} ${contact.lastName}`.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim() || undefined,
          selected_plan_id: selectedPlan,
          location_enabled:
            locationEnabled === null ? undefined : locationEnabled,
        });
      }

      setStep("success");
      trackEvent(analyticsEvents.vendorRegistrationCompleted, {
        planId: selectedPlan,
        mode: entryMode,
      });

      // Re-hydrate session so account.vendorId is populated
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

  const continueToPlan = (enabled: boolean) => {
    setLocationEnabled(enabled);
    writeVendorDraft({
      ...readVendorDraft(),
      locationEnabled: enabled,
    });
    setStep("plan");
    trackEvent(analyticsEvents.vendorPlanScreenViewed);
  };

  const handleEnableLocation = () => {
    if (!("geolocation" in navigator)) {
      trackEvent(analyticsEvents.vendorLocationDenied, {
        reason: "unsupported",
      });
      setStatusMessage(
        "Location services are unavailable on this device. Continuing without location."
      );
      continueToPlan(false);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    navigator.geolocation.getCurrentPosition(
      () => {
        setIsSubmitting(false);
        trackEvent(analyticsEvents.vendorLocationEnabled);
        continueToPlan(true);
      },
      (error) => {
        setIsSubmitting(false);
        trackEvent(analyticsEvents.vendorLocationDenied, {
          reason: error.code,
        });
        setStatusMessage(
          "Location access was denied. You can continue without location."
        );
        continueToPlan(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleSaveProfile = async () => {
    setIsProfileSaving(true);
    setProfileMessage(null);

    try {
      // Build payload — only include fields that have values
      const payload: Record<string, string> = {};
      if (profileForm.description.trim())
        payload.description = profileForm.description.trim();
      if (profileForm.phone.trim())
        payload.phone = profileForm.phone.trim();
      if (profileForm.website_url.trim())
        payload.website_url = profileForm.website_url.trim();
      if (profileForm.reservation_url.trim())
        payload.reservation_url = profileForm.reservation_url.trim();
      if (profileForm.hours.trim())
        payload.hours = profileForm.hours.trim();
      if (profileForm.image_primary_url.trim())
        payload.image_primary_url = profileForm.image_primary_url.trim();

      await updateVendorProfile(payload);
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      setProfileMessage(
        error instanceof Error
          ? error.message
          : "Could not update your profile."
      );
    } finally {
      setIsProfileSaving(false);
    }
  };

  /* ---- Step title ---- */

  const stepTitle: Record<VendorStep, string> = {
    claim:
      searchInput.trim().length >= 2
        ? "Select your business"
        : "Claim your business on Genie",
    finding: "Select your business",
    "not-found": "Select your business",
    match: "Select your business",
    contact: "Your contact info",
    manual: "Add your business",
    location: "Share your location",
    plan: "Choose your plan",
    success: "",
    dashboard: "Vendor Dashboard",
    profile: "Edit Profile",
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

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
          className="flex-none text-white/80"
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

      {/* Step title */}
      {stepTitle[step] ? (
        <h2 className="mb-1 text-center text-[1.65rem] font-semibold leading-tight text-white">
          {stepTitle[step]}
        </h2>
      ) : null}

      {/* Subtitle only on claim screen when no input */}
      {step === "claim" && searchInput.trim().length < 2 && (
        <p className="mb-6 mt-2 text-center text-[15px] leading-relaxed text-white/55">
          Get discovered by people looking for spots like yours.
        </p>
      )}

      {/* Dashboard subtitle */}
      {step === "dashboard" && (
        <p className="mb-4 text-center text-[14px] text-white/45">
          Track how customers interact with your business.
        </p>
      )}

      {/* Profile subtitle */}
      {step === "profile" && (
        <p className="mb-4 text-center text-[14px] text-white/45">
          Update your business details visible to Genie users.
        </p>
      )}

      {/* ======== STEP: CLAIM (initial search) ======== */}
      {step === "claim" && (
        <div className="mt-5 space-y-2">
          {/* Search box */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#7a3030] bg-black/20 px-4 py-3.5">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 flex-none text-white/40"
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
                const v = e.target.value;
                setSearchInput(v);
                trackEvent(analyticsEvents.vendorBusinessSearchTyped, {
                  searchText: v,
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
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/35 focus:outline-none"
            />
          </div>

          {/* Live suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#7a3030] bg-black/20">
              {suggestions.map((venue, idx) => (
                <button
                  key={`sug-${venue.id}`}
                  type="button"
                  onClick={() => {
                    setSearchInput(venue.venue_name);
                    trackEvent(
                      analyticsEvents.vendorBusinessSuggestionSelected,
                      {
                        businessId: getVenueId(venue),
                        venueName: venue.venue_name,
                      }
                    );
                    void runSearch(venue.venue_name);
                  }}
                  className={`w-full px-4 py-3.5 text-left transition hover:bg-white/5 ${
                    idx < suggestions.length - 1
                      ? "border-b border-white/8"
                      : ""
                  }`}
                >
                  <p className="text-[15px] font-medium text-white">
                    {venue.venue_name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-white/45">
                    {venue.area_neighborhood || "Midtown"} Business
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Searching indicator */}
          {isSearching && searchInput.trim().length >= 2 && (
            <p className="pt-1 text-center text-sm text-white/45">
              Searching. . .
            </p>
          )}

          {/* Helper text — only when idle with no suggestions */}
          {!isSearching &&
            suggestions.length === 0 &&
            searchInput.trim().length < 2 && (
              <p className="mt-2 text-[13px] text-white/45">
                We&apos;ll match your business so you don&apos;t have to start
                from scratch
              </p>
            )}
        </div>
      )}

      {/* ======== STEP: FINDING (loading state) ======== */}
      {step === "finding" && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[#7a3030] bg-black/20 px-4 py-3.5">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 flex-none text-white/40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <span className="text-[15px] text-white">{searchInput}</span>
          </div>
          <p className="pt-1 text-center text-sm text-white/45">
            Searching. . .
          </p>
        </div>
      )}

      {/* ======== STEP: NOT-FOUND ======== */}
      {step === "not-found" && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#7a3030] bg-black/20 px-4 py-3.5">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 flex-none text-white/40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <span className="text-[15px] text-white">
              {searchInput || "Your search"}
            </span>
          </div>

          <div className="text-[13px] leading-relaxed text-white/55">
            <p>
              Sorry we didn&apos;t find &ldquo;{searchInput}&rdquo;
            </p>
            <p>Please check your details or add it manually.</p>
          </div>

          <ActionButton
            onClick={() => {
              setEntryMode("manual");
              setStep("manual");
              setManual(createManualState(searchInput, account));
              trackEvent(analyticsEvents.vendorAddBusinessCtaTapped, {
                searchText: searchInput,
              });
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
          {/* Venue card */}
          <div className="rounded-2xl border border-[#7a3030] bg-black/20 px-5 py-5 text-center">
            <p className="text-[17px] font-semibold text-white">
              {candidate.venue_name}
            </p>
            <p className="mt-1.5 text-[13px] text-white/50">
              {candidate.address ||
                `${candidate.area_neighborhood || "Midtown"}, ${candidate.city || "Houston"}`}
            </p>
          </div>

          <p className="text-center text-sm text-white/50">
            Is this your business?
          </p>

          <ActionButton
            onClick={() => {
              setStep("contact");
              writeVendorDraft({
                ...readVendorDraft(),
                matchedBusinessId: getVenueId(candidate),
              });
              trackEvent(analyticsEvents.vendorBusinessConfirmed, {
                matchedBusinessId: getVenueId(candidate),
              });
              trackEvent(analyticsEvents.vendorContactInfoStarted);
            }}
            className="w-full"
          >
            Yes, This is my business
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
            className="w-full py-3 text-center text-[14px] text-white/50 transition hover:text-white/70"
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
              setStatusMessage(
                "Enter a valid name and email before continuing."
              );
              trackEvent(analyticsEvents.vendorContactInfoValidationError);
              return;
            }
            setStatusMessage(null);
            setStep("location");
            trackEvent(analyticsEvents.vendorContactInfoCompleted, {
              email: contact.email,
            });
          }}
        >
          <VendorInput
            value={contact.firstName}
            placeholder="First Name"
            onChange={(v) =>
              setContact((c) => ({ ...c, firstName: v }))
            }
          />
          <VendorInput
            value={contact.lastName}
            placeholder="Last Name"
            onChange={(v) =>
              setContact((c) => ({ ...c, lastName: v }))
            }
          />
          <VendorInput
            type="email"
            value={contact.email}
            placeholder="Email"
            onChange={(v) =>
              setContact((c) => ({ ...c, email: v }))
            }
          />
          <VendorInput
            value={contact.phone}
            placeholder="Phone (optional)"
            onChange={(v) =>
              setContact((c) => ({ ...c, phone: v }))
            }
          />
          <p className="text-[13px] text-white/45">
            We&apos;ll only use this to contact you about your account.
          </p>
          <ActionButton type="submit" className="w-full">
            Next
          </ActionButton>
        </form>
      )}

      {/* ======== STEP: MANUAL ADD ======== */}
      {step === "manual" && (
        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (
              !manual.businessName.trim() ||
              !manual.firstName.trim() ||
              !manual.lastName.trim() ||
              !isEmailValid(manual.email)
            ) {
              setStatusMessage(
                "Complete the required fields before continuing."
              );
              trackEvent(analyticsEvents.vendorManualAddValidationError);
              return;
            }
            writeVendorDraft({
              ...readVendorDraft(),
              searchText: manual.businessName,
              isManualEntry: true,
            });
            setEntryMode("manual");
            setStatusMessage(null);
            setStep("location");
            trackEvent(analyticsEvents.vendorManualAddSubmitted, {
              businessName: manual.businessName,
            });
          }}
        >
          <VendorInput
            value={manual.businessName}
            placeholder="Business Name"
            onChange={(v) =>
              setManual((c) => ({ ...c, businessName: v }))
            }
          />
          <VendorInput
            value={manual.firstName}
            placeholder="First Name"
            onChange={(v) =>
              setManual((c) => ({ ...c, firstName: v }))
            }
          />
          <VendorInput
            value={manual.lastName}
            placeholder="Last Name"
            onChange={(v) =>
              setManual((c) => ({ ...c, lastName: v }))
            }
          />
          <VendorInput
            type="email"
            value={manual.email}
            placeholder="Email"
            onChange={(v) =>
              setManual((c) => ({ ...c, email: v }))
            }
          />
          <VendorInput
            value={manual.phone}
            placeholder="Phone (optional)"
            onChange={(v) =>
              setManual((c) => ({ ...c, phone: v }))
            }
          />
          <p className="pt-1 text-[13px] text-white/45">
            We&apos;ll only use this to contact you about your account.
          </p>
          <ActionButton type="submit" className="w-full">
            Next
          </ActionButton>
        </form>
      )}

      {/* ======== STEP: LOCATION PROMPT ======== */}
      {step === "location" && (
        <div className="mt-6 space-y-4">
          <p className="mb-2 text-center text-[15px] leading-relaxed text-white/60">
            Enable location so Genie can better match nearby customers to your
            business. You can skip this and continue.
          </p>

          <ActionButton
            onClick={handleEnableLocation}
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Checking location..." : "Enable location"}
          </ActionButton>

          <ActionButton
            onClick={() => {
              trackEvent(analyticsEvents.vendorLocationSkipped);
              continueToPlan(false);
            }}
            variant="secondary"
            className="w-full"
            disabled={isSubmitting}
          >
            Skip for now
          </ActionButton>
        </div>
      )}

      {/* ======== STEP: PLAN ======== */}
      {step === "plan" && (
        <div className="mt-5 space-y-3">
          {/* Basic — Free */}
          <button
            type="button"
            onClick={() => {
              setSelectedPlan("basic");
              writeVendorDraft({ ...readVendorDraft(), selectedPlanId: "basic" });
              trackEvent(analyticsEvents.vendorPlanSelected, { planId: "basic" });
            }}
            className={`w-full rounded-2xl border p-5 text-left transition ${
              selectedPlan === "basic"
                ? "border-[#c03030] bg-[linear-gradient(180deg,rgba(120,15,15,0.55),rgba(55,5,5,0.80))] shadow-[0_0_24px_rgba(200,40,40,0.2)]"
                : "border-[#7a3030] bg-black/10"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[16px] font-bold text-white">
                  Basic — Claim Your Spot
                </p>
                <p className="mt-0.5 text-[14px] font-semibold text-white/60">
                  Free
                </p>
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Get discovered on Genie with your restaurant&apos;s basic listing
              and customer actions.
            </p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-white/70">
              {config.vendorPlans.basicBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-none text-[#e83434]">•</span>
                  {b}
                </li>
              ))}
            </ul>
          </button>

          {/* Pro — Best Value */}
          <button
            type="button"
            onClick={() => {
              setSelectedPlan("pro");
              writeVendorDraft({ ...readVendorDraft(), selectedPlanId: "pro" });
              trackEvent(analyticsEvents.vendorPlanSelected, { planId: "pro" });
            }}
            className={`w-full rounded-2xl border p-5 text-left transition ${
              selectedPlan === "pro"
                ? "border-[#c03030] bg-[linear-gradient(180deg,rgba(120,15,15,0.55),rgba(55,5,5,0.80))] shadow-[0_0_24px_rgba(200,40,40,0.2)]"
                : "border-[#7a3030] bg-black/10"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[16px] font-bold text-white">
                  Pro — Get More Visibility
                </p>
                <p className="mt-0.5 text-[14px] font-semibold text-[#e83434]">
                  {config.vendorPlans.proMonthly}
                </p>
              </div>
              <span className="flex-none rounded-full bg-[#22c55e] px-2.5 py-1 text-[11px] font-bold text-white">
                Best Value
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              {config.vendorPlans.proDescription}
            </p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-white/70">
              {config.vendorPlans.proBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-none text-[#e83434]">•</span>
                  {b}
                </li>
              ))}
            </ul>
          </button>

          {/* Boost */}
          <button
            type="button"
            onClick={() => {
              setSelectedPlan("boost");
              writeVendorDraft({ ...readVendorDraft(), selectedPlanId: "boost" });
              trackEvent(analyticsEvents.vendorBoostSelected, { planId: "boost" });
            }}
            className={`w-full rounded-2xl border p-5 text-left transition ${
              selectedPlan === "boost"
                ? "border-[#c03030] bg-[linear-gradient(180deg,rgba(120,15,15,0.55),rgba(55,5,5,0.80))] shadow-[0_0_24px_rgba(200,40,40,0.2)]"
                : "border-[#7a3030] bg-black/10"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[16px] font-bold text-white">
                  Boost — Promote Your Restaurant
                </p>
                <p className="mt-0.5 text-[14px] font-semibold text-[#e83434]">
                  {config.vendorPlans.boostMonthly}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              {config.vendorPlans.boostDescription}
            </p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-white/70">
              {config.vendorPlans.boostBenefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-0.5 flex-none text-[#e83434]">•</span>
                  {b}
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
          {/* Checkmark circle — matches CreateAccount-7.png */}
          <div className="flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-white/5">
            <svg
              viewBox="0 0 24 24"
              className="h-16 w-16 text-[#e83434]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
          </div>

          <h2 className="mt-7 text-[1.65rem] font-semibold leading-tight text-white">
            Your business is live!
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-white/50">
            Your listing is now active on Genie. Customers searching for spots
            like yours can start discovering your business right away.
          </p>

          <div className="mt-8 w-full">
            <ActionButton
              onClick={() => {
                trackEvent(analyticsEvents.vendorSuccessContinueTapped);
                setStep("dashboard");
              }}
              className="w-full"
            >
              Continue
            </ActionButton>
          </div>
        </div>
      )}

      {/* ======== STEP: DASHBOARD ======== */}
      {step === "dashboard" && (
        <div className="mt-6">
          {isDashboardLoading && !dashboardMetrics ? (
            <div className="flex min-h-[12rem] items-center justify-center">
              <p className="text-sm text-white/45">Loading dashboard...</p>
            </div>
          ) : dashboardMetrics ? (
            <div className="space-y-6">
              {/* Metric cards grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Profile Views"
                  value={dashboardMetrics.views}
                  icon={
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  }
                />
                <StatCard
                  label="CTA Clicks"
                  value={dashboardMetrics.clicks}
                  icon={
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                    </svg>
                  }
                />
                <StatCard
                  label="Saves"
                  value={dashboardMetrics.saves}
                  icon={
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
                    </svg>
                  }
                />
                <StatCard
                  label="Genie Appearances"
                  value={dashboardMetrics.genie_appearances}
                  icon={
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5Z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  }
                />
              </div>

              {/* Quick actions */}
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

              {/* Insights summary */}
              <div className="rounded-2xl border border-[#7a3030] bg-black/10 p-4">
                <p className="text-sm font-medium text-white/70">Performance Summary</p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/45">
                  Your business has been viewed{" "}
                  <span className="text-white font-medium">
                    {dashboardMetrics.views.toLocaleString()}
                  </span>{" "}
                  times and appeared in{" "}
                  <span className="text-white font-medium">
                    {dashboardMetrics.genie_appearances.toLocaleString()}
                  </span>{" "}
                  Genie recommendations.{" "}
                  <span className="text-white font-medium">
                    {dashboardMetrics.saves.toLocaleString()}
                  </span>{" "}
                  users saved your spot.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-white/50">
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
            <label className="mb-1.5 block text-[13px] font-medium text-white/55">
              Business Description
            </label>
            <textarea
              value={profileForm.description}
              onChange={(e) =>
                setProfileForm((c) => ({
                  ...c,
                  description: e.target.value,
                }))
              }
              placeholder="An upscale poolside nightclub with craft cocktails..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-[#7a3030] bg-transparent px-4 py-3 text-[15px] text-white placeholder:text-white/35 focus:border-[#e05050] focus:outline-none"
            />
          </div>

          <VendorInput
            value={profileForm.phone}
            placeholder="Phone number"
            onChange={(v) =>
              setProfileForm((c) => ({ ...c, phone: v }))
            }
          />

          <VendorInput
            value={profileForm.website_url}
            placeholder="Website URL"
            type="url"
            onChange={(v) =>
              setProfileForm((c) => ({ ...c, website_url: v }))
            }
          />

          <VendorInput
            value={profileForm.reservation_url}
            placeholder="Reservation URL (OpenTable, Resy, etc.)"
            type="url"
            onChange={(v) =>
              setProfileForm((c) => ({ ...c, reservation_url: v }))
            }
          />

          <VendorInput
            value={profileForm.hours}
            placeholder="Hours (e.g. Open Until 2 AM)"
            onChange={(v) =>
              setProfileForm((c) => ({ ...c, hours: v }))
            }
          />

          <VendorInput
            value={profileForm.image_primary_url}
            placeholder="Primary image URL"
            type="url"
            onChange={(v) =>
              setProfileForm((c) => ({ ...c, image_primary_url: v }))
            }
          />

          <ActionButton
            type="submit"
            className="w-full"
            disabled={isProfileSaving}
          >
            {isProfileSaving ? "Saving..." : "Save Profile"}
          </ActionButton>

          <ActionButton
            onClick={() => {
              setStep("dashboard");
              setProfileMessage(null);
            }}
            variant="secondary"
            className="w-full"
          >
            Back to Dashboard
          </ActionButton>

          {profileMessage && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                profileMessage.includes("success")
                  ? "border-green-700/40 text-green-400/80"
                  : "border-white/10 text-white/65"
              }`}
            >
              {profileMessage}
            </div>
          )}
        </form>
      )}

      {/* Status message */}
      {statusMessage && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
          {statusMessage}
        </div>
      )}
    </section>
  );
}
