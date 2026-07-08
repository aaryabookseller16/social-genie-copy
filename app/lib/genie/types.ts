export type GenieVenue = {
  id: number;
  venue_name: string;
  area_neighborhood?: string;
  vibe_notes?: string;
  price_band?: string;
  address?: string;
  image_primary_url?: string | null;
  image_fallback_url?: string | null;
};

export type GenieResponse = {
  reply: string;
  top_venues: GenieVenue[];
  more_venues: GenieVenue[];
  needs_location: boolean;
  use_xano: boolean;
  debug?: any;
};