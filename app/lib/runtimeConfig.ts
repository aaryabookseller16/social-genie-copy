import { type RuntimeConfig } from "./genieTypes";

export const runtimeConfig: RuntimeConfig = {
  cityLabel: "Houston",
  citySlug: "houston",
  cityId: "houston_tx",
  quickChips: [
    {
      id: "happy-hour",
      label: "Happy Hour",
      prompt: "Happy Hour near me",
    },
    {
      id: "brunch",
      label: "Brunch",
      prompt: "Brunch spots near me",
    },
    {
      id: "dinner",
      label: "Dinner",
      prompt: "Dinner spots near me",
    },
    {
      id: "rooftop",
      label: "Rooftop",
      prompt: "Rooftop bars near me",
    },
    {
      id: "patio",
      label: "Patio",
      prompt: "Patios near me",
    },
    {
      id: "late-night",
      label: "Late Night",
      prompt: "Late night spots near me",
    },
    {
      id: "live-music",
      label: "Live Music",
      prompt: "Live music venues near me",
    },
    {
      id: "date-night",
      label: "Date Night",
      prompt: "Date night spots near me",
    },
  ],
  signupPromptSuppressAfter: 3,
  vibeeMonthlyPrice: "$2.99/mo",
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

/**
 * The genie_posts id shown on the homescreen's Social Post card to logged-out
 * visitors (who have no auth token, so the real feed-list endpoint is out of
 * reach). Staff should update this to feature a different real post.
 * TODO: replace with a real, non-deleted genie_posts id before shipping.
 */
export const FEATURED_HOMESCREEN_POST_ID = 1;
