"use client";

import { type RefObject, useState } from "react";

import { trackEvent } from "@/app/lib/analytics";
import { analyticsEvents } from "@/app/lib/analyticsEvents";
import { type OnboardingRole } from "@/app/lib/localState";
import { readAuthToken } from "@/app/lib/localState";
import {
  saveProducerDetails,
  saveInfluencerDetails,
} from "@/app/lib/publicApiClient";
import { ActionButton } from "./ui";

// Producer/influencer have no backend yet, so their details are persisted
// locally only and handed off when those features land (see plan §8).
const ROLE_DETAILS_STORAGE_KEY = "genie_onboarding_role_details_v1";

const inputClass =
  "w-full rounded-2xl border border-gray-300 bg-transparent px-4 py-3.5 text-gray-900 placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20 dark:border-[#b74c4c]/55 dark:bg-black/20 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#ff6a6a]";

export function RoleSetupSection({
  sectionRef,
  visible,
  roles,
  onOpenVendor,
  onContinue,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  visible: boolean;
  roles: OnboardingRole[];
  onOpenVendor: () => void;
  onContinue: () => void;
}) {
  const [brandName, setBrandName] = useState("");
  const [producerHandle, setProducerHandle] = useState("");
  const [influencerHandle, setInfluencerHandle] = useState("");

  if (!visible) {
    return null;
  }

  const showVendor = roles.includes("vendor");
  const showProducer = roles.includes("producer");
  const showInfluencer = roles.includes("influencer");

  const handleContinue = () => {
    // Always keep a local copy as backup
    if ((showProducer || showInfluencer) && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          ROLE_DETAILS_STORAGE_KEY,
          JSON.stringify({ brandName, producerHandle, influencerHandle })
        );
      } catch {
        // best-effort
      }
    }
    // Only fire immediately if already logged in (e.g. returning user updating roles).
    // New users: local copy above is enough — sync happens after magic link click.
    if (readAuthToken()) {
      if (showProducer) {
        saveProducerDetails({ brand_name: brandName, producer_handle: producerHandle }).catch(() => {});
      }
      if (showInfluencer) {
        saveInfluencerDetails({ influencer_handle: influencerHandle }).catch(() => {});
      }
    }
    trackEvent(analyticsEvents.onboardingRoleSetupContinue, { roles });
    onContinue();
  };

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden bg-transparent px-1 pb-6 pt-10"
    >
      <div className="flex flex-1 flex-col">
        <h2 className="mt-2 text-center text-[1.75rem] font-semibold leading-tight text-gray-900 dark:text-white">
          Set up your tools
        </h2>
        <p className="mx-auto mt-3 max-w-[30ch] text-center text-[15px] leading-relaxed text-gray-700 dark:text-white/70">
          Everything here is optional — your roles are already active. You can
          finish these any time.
        </p>

        <div className="mt-8 space-y-6">
          {showVendor ? (
            <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/15 dark:bg-black/25">
              <p className="text-[16px] font-semibold text-red-600 dark:text-[#ff7b7b]">
                Your venue
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-600 dark:text-white/70">
                Find and claim your venue to start managing your listing.
              </p>
              <ActionButton className="mt-3 w-full" onClick={onOpenVendor}>
                Set up my venue
              </ActionButton>
            </div>
          ) : null}

          {showProducer ? (
            <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/15 dark:bg-black/25">
              <p className="text-[16px] font-semibold text-red-600 dark:text-[#ff7b7b]">
                Event promoter
              </p>
              <p className="mt-1 mb-3 text-[13px] leading-relaxed text-gray-600 dark:text-white/70">
                Tell us about your brand so locals recognise your events.
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Brand / promoter name"
                  style={{ fontSize: "16px" }}
                  className={inputClass}
                />
                <input
                  type="text"
                  value={producerHandle}
                  onChange={(e) => setProducerHandle(e.target.value)}
                  placeholder="Instagram handle (optional)"
                  style={{ fontSize: "16px" }}
                  className={inputClass}
                />
              </div>
            </div>
          ) : null}

          {showInfluencer ? (
            <div className="rounded-[20px] border border-gray-200 bg-transparent p-4 dark:border-white/15 dark:bg-black/25">
              <p className="text-[16px] font-semibold text-red-600 dark:text-[#ff7b7b]">
                Content creator
              </p>
              <p className="mt-1 mb-3 text-[13px] leading-relaxed text-gray-600 dark:text-white/70">
                Add your handle so we can feature your nights out.
              </p>
              <input
                type="text"
                value={influencerHandle}
                onChange={(e) => setInfluencerHandle(e.target.value)}
                placeholder="@yourhandle (optional)"
                style={{ fontSize: "16px" }}
                className={inputClass}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto pt-8">
        <ActionButton className="w-full" onClick={handleContinue}>
          Continue
        </ActionButton>
      </div>
    </section>
  );
}
