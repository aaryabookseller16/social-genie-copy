import { type RuntimeConfig } from "./genieTypes";

export const runtimeConfig: RuntimeConfig = {
  cityLabel: "Houston",
  citySlug: "houston",
  cityId: "houston_tx",
  quickChips: [
    {
      id: "happy-hour",
      label: "Happy Hour",
      prompt: "Find me a happy hour in Houston",
    },
    {
      id: "brunch",
      label: "Brunch",
      prompt: "Find me a brunch spot in Houston",
    },
    {
      id: "dinner",
      label: "Dinner",
      prompt: "Find me a dinner spot in Houston",
    },
    {
      id: "more",
      label: "...",
      prompt: "Find me something fun to do in Houston tonight",
    },
  ],
  signupPromptSuppressAfter: 3,
  vibeeMonthlyPrice: "$1.99/mo",
  freeBenefits: [
    "Explore city spots",
    "Discover local events",
    "No credit card required",
  ],
  vibeeBenefits: [
    "Exclusive event access",
    "Early invites and giveaways",
    "Hidden gems and VIP deals",
  ],
  vendorPlans: {
    foundingPartnerMonthly: "$37/month",
    boostPlacementOneTime: "$77 one-time",
    foundingPartnerBenefits: [
      "Show up in Genie recommendations",
      "Get discovered by nearby customers",
      "Track your performance",
    ],
    boostPlacementBenefits: ["Get priority visibility"],
  },
};

export function getRuntimeConfig(): RuntimeConfig {
  return runtimeConfig;
}
