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

export type FeaturedVideo = {
  id: string;
  url: string;
  /**
   * Optional caption shown over the card and used as the player's accessible
   * name. Omit it and the card renders no caption, falling back to a positional
   * label ("Play video 2") for screen readers.
   */
  title?: string;
  /**
   * Poster frame. Optional — Cloudinary-hosted videos fall back to a derived
   * first-frame JPG (see deriveVideoThumbnail in app/lib/videoUpload.ts).
   */
  posterUrl?: string;
};

/**
 * Client-supplied videos for the homescreen "Featured" rail.
 *
 * Hardcoded on purpose: there is no backend source for these yet. The events
 * rail's lean projection in fn_genie_get_homescreen_events_dev drops
 * video_urls, so nothing Xano returns to the homescreen carries video. Staff
 * edit this list to change what is featured; swap it for an endpoint once that
 * projection carries video_urls.
 */
export const FEATURED_HOMESCREEN_VIDEOS: FeaturedVideo[] = [
  {
    id: "featured-1",
    url: "https://res.cloudinary.com/dak7jjbdy/video/upload/v1784822776/WhatsApp_Video_2026-07-23_at_3.34.20_PM_jmhw0z.mp4",
  },
  {
    id: "featured-2",
    url: "https://res.cloudinary.com/dak7jjbdy/video/upload/v1784822657/WhatsApp_Video_2026-07-23_at_3.36.04_PM_m1z6mw.mp4",
  },
  {
    id: "featured-3",
    url: "https://res.cloudinary.com/dak7jjbdy/video/upload/v1784822144/WhatsApp_Video_2026-07-23_at_3.31.10_PM_kl8o38.mp4",
  },
];
