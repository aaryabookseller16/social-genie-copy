export type GenieResponseMode =
  | "structured_results"
  | "supported_no_results"
  | "city_missing"
  | "city_unsupported"
  | "ai_fallback";

export type GenieFilters = {
  limit?: number;
  city_filter?: string;
  energy_level_filter?: string;
  music_filter?: string;
  crowd_filter?: string;
  vibe_filter?: string;
};

export type GenieNormalizedFilters = {
  city: string | null;
  energy: string;
  music: string;
  crowd: string;
  vibe_keywords: string[];
};

export type RawGenieVenue = {
  id: number | string;
  venue_name: string;
  area_neighborhood?: string | null;
  city?: string | null;
  address?: string | null;
  vibe_notes?: string | null;
  image?: string | null;
  image_url?: string | null;
  image_primary_url?: string | null;
  image_fallback_url?: string | null;
  /** Ordered vendor-uploaded gallery; index 0 is the primary. */
  image_urls?: string[] | null;
  energy_level?: string | null;
  music?: string | null;
  crowd?: string | null;
  price_band?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  phone?: string | null;
  website_url?: string | null;
  google_maps_url?: string | null;
  google_rating?: number | null;
  google_user_ratings_total?: number | null;
  reservation_url?: string | null;
  reservation_platform?: string | null;
  reservations_supported?: boolean | null;
  best_time_to_go?: string | null;
  is_open_now?: boolean | null;
  is_official_vendor?: boolean | null;
  is_vendor_subscriber?: boolean | null;
  priority_tier?: string | null;
  match_confidence?: number | null;
  vibe_score?: number | null;
  cuisine_tags?: string[] | Record<string, unknown> | null;
  neighborhood_text?: string | null;
  hours_json?: {
    periods?: Array<{
      open?: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
    open_now?: boolean;
    weekday_text?: string[];
  } | null;
};

export type GenieVenue = Omit<RawGenieVenue, "latitude" | "longitude"> & {
  image: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RawGenieEvent = {
  id: number;
  title: string;
  description?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  cover_image_url?: string;
  public_slug?: string;
  status?: string;
  ticket_url?: string;
  ticket_type?: string;
  ticket_price_min?: number;
  ticket_price_max?: number;
  is_free?: boolean;
  is_sold_out?: boolean;
  age_requirement?: number;
  rsvp_count?: number;
  going_count?: number;
  category?: string;
  event_category?: string;
  venue_address?: string;
  neighborhood?: string;
  city?: string;
  source_type?: string;
  discovery_source?: string[];
};
export type RawHandleMessageResponse = {
  reply?: string;
  session_id?: number;
  session_token?: string;
  use_xano?: boolean;
  needs_location?: boolean;
  reply_mode?: string;
  mode?: string;
  top_venues?: RawGenieVenue[];
  more_venues?: RawGenieVenue[];
  venues?: RawGenieVenue[];
  events?: RawGenieEvent[];
  query_mode?: string;
  more_nearby_venues?: RawGenieVenue[];
  decisive?: RawGenieVenue[];
  more_nearby?: RawGenieVenue[];
  debug?: Record<string, unknown> & {
    city?: string;
    city_supported?: boolean;
    reply_mode?: string;
  };
  show_intake_prompt?: boolean;
  intake_prompt_copy?: string;
  profile_strength_tier?: string;
  filters?: Partial<GenieNormalizedFilters>;
  result?: RawHandleMessageResponse;
};

export type GenieResponseEnvelope = {
  response_mode: GenieResponseMode;
  reply: string;
  normalized_intent: string;
  city_context: string | null;
  use_xano: boolean;
  decisive: GenieVenue[];
  more_nearby: GenieVenue[];
  events: RawGenieEvent[];
  query_mode: string;
  needs_location: boolean;
  session_id?: number;
  session_token?: string;
  show_intake_prompt: boolean;
  intake_prompt_copy: string;
  profile_strength_tier?: string;
  filters: GenieNormalizedFilters;
  debug?: Record<string, unknown>;
  raw?: unknown;
};

export type RuntimeQuickChip = {
  id: string;
  label: string;
  prompt: string;
};

export type RuntimeConfig = {
  cityLabel: string;
  citySlug: string;
  cityId: string;
  quickChips: RuntimeQuickChip[];
  signupPromptSuppressAfter: number;
  vibeeMonthlyPrice: string;
  freeBenefits: string[];
  vibeeBenefits: string[];
  vendorPlans: {
    basicBenefits: string[];
    proMonthly: string;
    proDescription: string;
    proBenefits: string[];
    boostMonthly: string;
    boostDescription: string;
    boostBenefits: string[];
  };
};
