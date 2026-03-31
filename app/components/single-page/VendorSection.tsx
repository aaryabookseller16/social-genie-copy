"use client";

import {
  type FormEvent,
  type RefObject,
  useDeferredValue,
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
  searchVendorBusinesses,
} from "@/app/lib/publicApiClient";
import {
  readVendorDraft,
  writeVendorDraft,
} from "@/app/lib/vendorOnboarding";

import { ActionButton, Field, SectionShell } from "./ui";

type VendorStep =
  | "claim"
  | "finding"
  | "not-found"
  | "match"
  | "contact"
  | "location"
  | "plan"
  | "success"
  | "manual";

type VendorContactState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type VendorManualState = {
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
  businessAddress: string;
  cityStateZip: string;
};

function isEmailValid(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function createContactState(account: ConsumerAccount | null): VendorContactState {
  return {
    firstName: account?.firstName ?? "",
    lastName: account?.lastName ?? "",
    email: account?.email ?? "",
    phone: account?.phone ?? "",
  };
}

function createManualState(searchText = "", account: ConsumerAccount | null = null): VendorManualState {
  return {
    businessName: searchText,
    fullName:
      account ? `${account.firstName} ${account.lastName}`.trim() : "",
    email: account?.email ?? "",
    phone: account?.phone ?? "",
    businessAddress: "",
    cityStateZip: "Houston, TX 77008",
  };
}

function getVenueId(venue: GenieVenue) {
  return String(venue.id);
}

export function VendorSection({
  visible,
  sectionRef,
  account,
  config,
  onContinueHome,
  onOpenAccount,
}: {
  visible: boolean;
  sectionRef: RefObject<HTMLElement | null>;
  account: ConsumerAccount | null;
  config: RuntimeConfig;
  onContinueHome: () => void;
  onOpenAccount: () => void;
}) {
  const [step, setStep] = useState<VendorStep>("claim");
  const [initialDraft] = useState(() => readVendorDraft());
  const [searchInput, setSearchInput] = useState(
    () => initialDraft.searchText ?? ""
  );
  const deferredSearch = useDeferredValue(searchInput);
  const [suggestions, setSuggestions] = useState<GenieVenue[]>([]);
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
    "founding_partner" | "boost_placement" | null
  >(() =>
    initialDraft.selectedPlanId === "founding_partner" ||
    initialDraft.selectedPlanId === "boost_placement"
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

  useEffect(() => {
    if (!account) {
      setContact(createContactState(null));
      return;
    }

    setContact((current) => ({
      firstName: current.firstName || account.firstName,
      lastName: current.lastName || account.lastName,
      email: current.email || account.email,
      phone: current.phone || account.phone || "",
    }));

    setManual((current) => ({
      ...current,
      fullName:
        current.fullName || `${account.firstName} ${account.lastName}`.trim(),
      email: current.email || account.email,
      phone: current.phone || account.phone || "",
    }));
  }, [account]);

  useEffect(() => {
    if (!visible || !account || step !== "claim") {
      return;
    }

    trackEvent(analyticsEvents.vendorClaimStarted);
  }, [account, step, visible]);

  useEffect(() => {
    if (!visible || !account || step !== "claim" || deferredSearch.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const results = await searchVendorBusinesses(deferredSearch.trim());
        if (cancelled) {
          return;
        }

        setSuggestions(results);
        if (results.length) {
          trackEvent(analyticsEvents.vendorBusinessSuggestionShown, {
            searchText: deferredSearch,
            suggestionCount: results.length,
          });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSuggestions([]);
        setStatusMessage(
          error instanceof Error
            ? error.message
            : "Could not search businesses right now."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, deferredSearch, step, visible]);

  if (!visible) {
    return null;
  }

  if (!account) {
    return (
      <SectionShell
        sectionRef={sectionRef}
        title="Sign in to claim your business"
        subtitle="Vendor search, claim, and manual business creation all require an authenticated account."
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-black/18 px-4 py-5 text-sm leading-6 text-white/74">
            Create an account first, then come back here to search your listing or add your business manually.
          </div>
          <ActionButton onClick={onOpenAccount} className="w-full">
            Open account screen
          </ActionButton>
          <ActionButton onClick={onContinueHome} variant="secondary" className="w-full">
            Back to home
          </ActionButton>
        </div>
      </SectionShell>
    );
  }

  const stepIndex: Record<VendorStep, number> = {
    claim: 1,
    finding: 1,
    "not-found": 2,
    match: 2,
    manual: 2,
    contact: 3,
    location: 4,
    plan: 5,
    success: 6,
  };

  const goBack = () => {
    setStatusMessage(null);

    switch (step) {
      case "claim":
        onContinueHome();
        break;
      case "finding":
      case "not-found":
      case "match":
        setStep("claim");
        break;
      case "contact":
        setStep("match");
        break;
      case "location":
        setStep(entryMode === "manual" ? "manual" : "contact");
        break;
      case "plan":
        setStep("location");
        break;
      case "success":
        setStep("plan");
        break;
      case "manual":
        setStep("not-found");
        break;
      default:
        onContinueHome();
    }
  };

  const runSearch = async (searchText: string) => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      return;
    }

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
          (venue) => venue.venue_name.toLowerCase() === trimmed.toLowerCase()
        ) ?? results[0] ?? null;

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
          full_name: manual.fullName.trim(),
          email: manual.email.trim(),
          phone: manual.phone.trim() || undefined,
          address: manual.businessAddress.trim(),
          city_state_zip: manual.cityStateZip.trim() || undefined,
          is_manual_entry: true,
          selected_plan_id: selectedPlan,
          location_enabled: Boolean(locationEnabled),
        });
      } else if (candidate) {
        await claimVendorBusiness({
          venue_id: Number(candidate.id),
          contact_name: `${contact.firstName} ${contact.lastName}`.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim() || undefined,
          selected_plan_id: selectedPlan,
          location_enabled: Boolean(locationEnabled),
        });
      }

      setStep("success");
      trackEvent(analyticsEvents.vendorRegistrationCompleted, {
        planId: selectedPlan,
        mode: entryMode,
      });
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

  return (
    <SectionShell
      sectionRef={sectionRef}
      title={
        step === "claim"
          ? "Claim your business on Genie"
          : step === "finding"
            ? "Finding your business..."
            : step === "not-found"
              ? "Select your business"
              : step === "match"
                ? "Select your business"
                : step === "contact"
                  ? "Your contact info"
                  : step === "location"
                    ? "Improve your visibility"
                    : step === "plan"
                      ? "Choose your plan"
                      : step === "success"
                        ? "You're live on Genie"
                        : "Add your business"
      }
      subtitle={
        step === "claim"
          ? "Get discovered by people looking for your kind of vibe."
          : step === "location"
            ? "Enable location to help customers find you more easily."
            : step === "success"
              ? "Customers can now discover your business instantly."
              : "Follow the steps to complete your Genie vendor setup."
      }
    >
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-black/20 text-white/78"
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
        <p className="text-xs uppercase tracking-[0.28em] text-white/34">
          Step {stepIndex[step]} of 6
        </p>
      </div>

      <div className="mb-5 flex items-center gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`vendor-step-${index + 1}`}
            className={`h-2 flex-1 rounded-full ${
              index + 1 <= stepIndex[step] ? "bg-[#ff4f4f]" : "bg-white/16"
            }`}
          />
        ))}
      </div>

      {step === "claim" ? (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-[#8d3535] bg-black/18 p-3">
            <div className="flex items-center gap-3">
              <input
                value={searchInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchInput(value);
                  setManual(createManualState(value, account));
                  trackEvent(analyticsEvents.vendorBusinessSearchTyped, {
                    searchText: value,
                  });
                }}
                placeholder="Search your venue"
                className="flex-1 bg-transparent text-lg text-white placeholder:text-white/34 focus:outline-none"
              />
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/42" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </div>
          </div>

          {suggestions.length ? (
            <div className="overflow-hidden rounded-[22px] border border-[#8d3535] bg-black/18">
              {suggestions.map((venue) => (
                <button
                  key={`suggestion-${venue.id}`}
                  type="button"
                  onClick={() => {
                    setSearchInput(venue.venue_name);
                    trackEvent(analyticsEvents.vendorBusinessSuggestionSelected, {
                      businessId: getVenueId(venue),
                      venueName: venue.venue_name,
                    });
                    void runSearch(venue.venue_name);
                  }}
                  className="flex w-full items-center justify-between border-b border-white/8 px-4 py-3 text-left last:border-b-0"
                >
                  <div>
                    <p className="text-lg text-white">{venue.venue_name}</p>
                    <p className="text-sm text-white/48">
                      {venue.area_neighborhood || venue.city || "Houston"} - business
                    </p>
                  </div>
                  <span className="text-white/66">✓</span>
                </button>
              ))}
            </div>
          ) : null}

          <p className="text-sm leading-6 text-white/62">
            We&apos;ll match your business so you do not have to start from scratch.
          </p>

          <ActionButton
            onClick={() => void runSearch(searchInput)}
            className="w-full"
            disabled={searchInput.trim().length < 2 || isSubmitting}
          >
            Find my business
          </ActionButton>
        </div>
      ) : null}

      {step === "finding" ? (
        <div className="flex min-h-[18rem] flex-col items-center justify-center text-center">
          <p className="text-lg text-white/82">Finding your business...</p>
          <div className="mt-4 flex gap-3">
            {[0, 1, 2, 3, 4].map((dot) => (
              <span
                key={`dot-${dot}`}
                className="h-2.5 w-2.5 rounded-full bg-[#ff4f4f] animate-orbGlow"
              />
            ))}
          </div>
          <div className="mt-6 w-full rounded-[18px] border border-[#8d3535] bg-black/18 px-4 py-3 text-left text-lg text-white">
            {searchInput}
          </div>
        </div>
      ) : null}

      {step === "not-found" ? (
        <div className="space-y-4">
          <div className="rounded-[18px] border border-[#8d3535] bg-black/18 px-4 py-3 text-lg text-white">
            <div className="flex items-center justify-between gap-3">
              <span>{searchInput || "Your search"}</span>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-white/42"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
            </div>
          </div>
          <p className="text-lg leading-8 text-white/82">
            Please check your details or add it manually.
          </p>
          <ActionButton
            onClick={() => {
              setEntryMode("manual");
              setStep("manual");
              trackEvent(analyticsEvents.vendorAddBusinessCtaTapped, {
                searchText: searchInput,
              });
              trackEvent(analyticsEvents.vendorManualAddStarted);
              setManual(createManualState(searchInput, account));
            }}
            className="w-full"
          >
            Add my business
          </ActionButton>
          <ActionButton
            onClick={() => {
              setStep("claim");
              setStatusMessage(null);
            }}
            variant="secondary"
            className="w-full"
          >
            Try another search
          </ActionButton>
        </div>
      ) : null}

      {step === "match" && candidate ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[24px] border border-[#e05d5d] bg-black/18 p-4 shadow-[0_0_24px_rgba(255,90,90,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold text-white">{candidate.venue_name}</p>
                <p className="mt-1 text-white/56">
                  {(candidate.area_neighborhood || "Midtown")} · {candidate.city || "Houston"}
                </p>
                <p className="mt-4 flex items-center gap-1.5 text-sm text-white/72">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#ff7b7b]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
                    <circle cx="12" cy="10" r="2" />
                  </svg>
                  {candidate.address || "Houston, Texas"}
                </p>
              </div>
              <span className="mt-2 text-2xl text-white/40">&rsaquo;</span>
            </div>
          </div>
          <p className="text-xl text-white/84">Is this your business?</p>
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
            Yes, this is my business
          </ActionButton>
          <ActionButton
            onClick={() => {
              setEntryMode("manual");
              setStep("manual");
              setManual(createManualState(candidate.venue_name, account));
              trackEvent(analyticsEvents.vendorBusinessRejected, {
                matchedBusinessId: getVenueId(candidate),
              });
            }}
            variant="secondary"
            className="w-full"
          >
            This isn&apos;t my business
          </ActionButton>
        </div>
      ) : null}

      {step === "contact" ? (
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (
              !contact.firstName.trim() ||
              !contact.lastName.trim() ||
              !isEmailValid(contact.email)
            ) {
              setStatusMessage("Enter a valid name and email before continuing.");
              trackEvent(analyticsEvents.vendorContactInfoValidationError);
              return;
            }

            setStep("location");
            setStatusMessage(null);
            trackEvent(analyticsEvents.vendorContactInfoCompleted, {
              email: contact.email,
            });
            trackEvent(analyticsEvents.vendorLocationPromptViewed);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First Name"
              value={contact.firstName}
              placeholder="John"
              onChange={(value) =>
                setContact((current) => ({ ...current, firstName: value }))
              }
            />
            <Field
              label="Last Name"
              value={contact.lastName}
              placeholder="Doe"
              onChange={(value) =>
                setContact((current) => ({ ...current, lastName: value }))
              }
            />
          </div>
          <Field
            label="Email"
            type="email"
            value={contact.email}
            placeholder="name@email.com"
            onChange={(value) =>
              setContact((current) => ({ ...current, email: value }))
            }
          />
          <Field
            label="Phone"
            value={contact.phone}
            placeholder="(123) 456-7890"
            onChange={(value) =>
              setContact((current) => ({ ...current, phone: value }))
            }
          />
          <p className="text-sm text-white/58">
            We&apos;ll only use this to contact you about your account.
          </p>
          <ActionButton type="submit" className="w-full">
            Next
          </ActionButton>
        </form>
      ) : null}

      {step === "location" ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-[#e05d5d] bg-black/18 shadow-[0_0_26px_rgba(255,89,89,0.22)]">
            <svg viewBox="0 0 24 24" className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </div>
          <ActionButton
            onClick={() => {
              if (!navigator.geolocation) {
                setStatusMessage("Location services are unavailable on this device.");
                trackEvent(analyticsEvents.vendorLocationDenied, {
                  reason: "unsupported",
                });
                return;
              }

              navigator.geolocation.getCurrentPosition(
                () => {
                  writeVendorDraft({
                    ...readVendorDraft(),
                    locationEnabled: true,
                  });
                  setLocationEnabled(true);
                  setStep("plan");
                  setStatusMessage(null);
                  trackEvent(analyticsEvents.vendorLocationEnabled);
                  trackEvent(analyticsEvents.vendorPlanScreenViewed);
                },
                () => {
                  setStatusMessage("Location was blocked. You can still continue.");
                  trackEvent(analyticsEvents.vendorLocationDenied, {
                    reason: "blocked",
                  });
                }
              );
            }}
            className="w-full"
          >
            Enable Location
          </ActionButton>
          <ActionButton
            onClick={() => {
              writeVendorDraft({
                ...readVendorDraft(),
                locationEnabled: false,
              });
              setLocationEnabled(false);
              setStep("plan");
              setStatusMessage(null);
              trackEvent(analyticsEvents.vendorLocationSkipped);
              trackEvent(analyticsEvents.vendorPlanScreenViewed);
            }}
            variant="secondary"
            className="w-full"
          >
            Skip for now
          </ActionButton>
        </div>
      ) : null}

      {step === "plan" ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setSelectedPlan("founding_partner");
              writeVendorDraft({
                ...readVendorDraft(),
                selectedPlanId: "founding_partner",
              });
              trackEvent(analyticsEvents.vendorPlanSelected, {
                planId: "founding_partner",
              });
            }}
            className={`w-full rounded-[24px] border p-4 text-left ${
              selectedPlan === "founding_partner"
                ? "border-[#ff9f7a] bg-[linear-gradient(180deg,rgba(58,20,10,0.95),rgba(28,7,4,0.98))] shadow-[0_0_26px_rgba(255,132,89,0.18)]"
                : "border-white/10 bg-black/18"
            }`}
          >
            <p className="text-3xl font-semibold text-white">Founding Partner</p>
            <p className="mt-2 text-2xl text-[#ffcf9f]">
              {config.vendorPlans.foundingPartnerMonthly}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/74">
              {config.vendorPlans.foundingPartnerBenefits.map((benefit) => (
                <li key={benefit}>- {benefit}</li>
              ))}
            </ul>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedPlan("boost_placement");
              writeVendorDraft({
                ...readVendorDraft(),
                selectedPlanId: "boost_placement",
              });
              trackEvent(analyticsEvents.vendorBoostSelected, {
                planId: "boost_placement",
              });
            }}
            className={`w-full rounded-[24px] border p-4 text-left ${
              selectedPlan === "boost_placement"
                ? "border-[#ff9f7a] bg-[linear-gradient(180deg,rgba(58,20,10,0.95),rgba(28,7,4,0.98))] shadow-[0_0_26px_rgba(255,132,89,0.18)]"
                : "border-white/10 bg-black/18"
            }`}
          >
            <p className="text-3xl font-semibold text-white">Boost Placement</p>
            <p className="mt-2 text-2xl text-[#ffcf9f]">
              {config.vendorPlans.boostPlacementOneTime}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/74">
              {config.vendorPlans.boostPlacementBenefits.map((benefit) => (
                <li key={benefit}>- {benefit}</li>
              ))}
            </ul>
          </button>

          <p className="text-center text-sm text-white/58">
            No long-term contracts. Cancel anytime.
          </p>

          <ActionButton
            onClick={() => void completeRegistration()}
            className="w-full"
            disabled={isSubmitting}
          >
            Continue
          </ActionButton>
        </div>
      ) : null}

      {step === "manual" ? (
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (
              !manual.businessName.trim() ||
              !manual.fullName.trim() ||
              !isEmailValid(manual.email) ||
              !manual.businessAddress.trim()
            ) {
              setStatusMessage("Complete the required business fields before continuing.");
              trackEvent(analyticsEvents.vendorManualAddValidationError);
              return;
            }

            writeVendorDraft({
              ...readVendorDraft(),
              searchText: manual.businessName,
              isManualEntry: true,
            });
            setEntryMode("manual");
            setStep("location");
            setStatusMessage(null);
            trackEvent(analyticsEvents.vendorManualAddSubmitted, {
              businessName: manual.businessName,
            });
            trackEvent(analyticsEvents.vendorManualAddCompleted, {
              businessName: manual.businessName,
            });
            trackEvent(analyticsEvents.vendorLocationPromptViewed);
          }}
        >
          <Field
            label="Business Name"
            value={manual.businessName}
            placeholder="Sunset Grill"
            onChange={(value) =>
              setManual((current) => ({ ...current, businessName: value }))
            }
          />
          <Field
            label="Full Name"
            value={manual.fullName}
            placeholder="First Last"
            onChange={(value) =>
              setManual((current) => ({ ...current, fullName: value }))
            }
          />
          <Field
            label="Email"
            type="email"
            value={manual.email}
            placeholder="name@email.com"
            onChange={(value) =>
              setManual((current) => ({ ...current, email: value }))
            }
          />
          <Field
            label="Phone (optional)"
            value={manual.phone}
            placeholder="(123) 456-7890"
            onChange={(value) =>
              setManual((current) => ({ ...current, phone: value }))
            }
          />
          <Field
            label="Business Address"
            value={manual.businessAddress}
            placeholder="2945 Westheimer Rd"
            onChange={(value) =>
              setManual((current) => ({ ...current, businessAddress: value }))
            }
          />
          <Field
            label="City, State, Zip"
            value={manual.cityStateZip}
            placeholder="Houston, TX 77008"
            onChange={(value) =>
              setManual((current) => ({ ...current, cityStateZip: value }))
            }
          />
          <ActionButton type="submit" className="w-full">
            Continue
          </ActionButton>
        </form>
      ) : null}

      {step === "success" ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-[#ff6666] bg-black/18 shadow-[0_0_26px_rgba(255,89,89,0.22)]">
            <svg viewBox="0 0 24 24" className="h-14 w-14 text-[#ff6767]" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </div>
          <ActionButton
            onClick={() => {
              trackEvent(analyticsEvents.vendorSuccessContinueTapped);
              onContinueHome();
            }}
            className="w-full"
          >
            Continue
          </ActionButton>
        </div>
      ) : null}

      {statusMessage ? (
        <div className="mt-5 rounded-[20px] border border-white/10 bg-black/18 px-4 py-3 text-sm leading-6 text-white/74">
          {statusMessage}
        </div>
      ) : null}
    </SectionShell>
  );
}
