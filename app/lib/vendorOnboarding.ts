const VENDOR_DRAFT_STORAGE_KEY = "genie_vendor_onboarding_v1";

export type VendorOnboardingDraft = {
  searchText?: string;
  matchedBusinessId?: string;
  selectedPlanId?: string;
  locationEnabled?: boolean;
  isManualEntry?: boolean;
  vendorId?: number;
  onboardingId?: number;
  currentStep?: string;
};

export function readVendorDraft(): VendorOnboardingDraft {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(VENDOR_DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VendorOnboardingDraft) : {};
  } catch {
    return {};
  }
}

export function writeVendorDraft(draft: VendorOnboardingDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(VENDOR_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function clearVendorDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(VENDOR_DRAFT_STORAGE_KEY);
}
