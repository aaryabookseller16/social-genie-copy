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
    basicBenefits: [
      "Show up in relevant Genie recommendations",
      "Let customers call, get directions, or reserve",
      "Access a simple preview of your visibility",
    ],
    proMonthly: "$37/month",
    proDescription:
      "Stand out in Genie with better visibility, fuller insights, and more ways to grow.",
    proBenefits: [
      "Get increased visibility in relevant recommendations",
      "Unlock deeper performance insights",
      "Access stronger profile features and growth tools",
    ],
    boostMonthly: "$37/month",
    boostDescription:
      "Increase your visibility for key dining moments like brunch, happy hour, dinner, and more.",
    boostBenefits: [
      "Get temporary extra visibility where it matters most",
      "Promote your restaurant by dining occasion or neighborhood",
      "Reach more customers during high-intent moments",
    ],
  },
};

export function getRuntimeConfig(): RuntimeConfig {
  return runtimeConfig;
}
