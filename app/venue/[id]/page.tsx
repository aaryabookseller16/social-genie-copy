import type { Metadata } from "next";

import { SinglePageGenieApp } from "@/app/components/SinglePageGenieApp";
import { mapVenue } from "@/app/lib/genieMappers";
import { type RawGenieVenue } from "@/app/lib/genieTypes";
import { fetchCatalogVenueById } from "@/app/lib/server/xanoCatalog";
import { xanoFetch } from "@/app/lib/server/xanoProxy";
import { VenueDetailClient } from "./VenueDetailClient";

const FALLBACK_OG_IMAGE = "https://genie.socialbevy.com/genie-profile-pic.png";

async function loadVenue(id: string) {
  try {
    const response = await xanoFetch<{ venue?: RawGenieVenue }>(
      "genie/ep_get_venue_dev",
      { params: { venue_id: id } }
    );
    if (response.venue) {
      return mapVenue(response.venue);
    }
  } catch {
    // Primary endpoint isn't returning this venue; fall back to the catalog
    // source the message endpoint uses so shared links can still preview.
  }

  try {
    const raw = await fetchCatalogVenueById(id);
    return raw ? mapVenue(raw) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const venue = await loadVenue(id);

  if (!venue) {
    return {
      title: "Venue - Genie by Social Bevy",
    };
  }

  const name = venue.venue_name || "Venue";
  const neighborhood = venue.area_neighborhood || venue.city || "";
  const description =
    venue.vibe_notes?.trim() ||
    [name, neighborhood].filter(Boolean).join(" - ") ||
    "Discover this venue on Genie by Social Bevy.";
  const image = venue.image || venue.image_url || FALLBACK_OG_IMAGE;
  const url = `https://genie.socialbevy.com/venue/${id}`;
  const title = `${name} - Genie by Social Bevy`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Genie - Social Bevy",
      type: "website",
      images: [
        {
          url: image,
          alt: name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = await loadVenue(id);
  if (venue) {
    return <VenueDetailClient venue={venue} />;
  }
  return <SinglePageGenieApp initialScreen="detail" initialVenueId={id} />;
}
