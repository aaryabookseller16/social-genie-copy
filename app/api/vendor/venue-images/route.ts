import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * Venue photo gallery for the authenticated vendor.
 *
 * Both endpoints resolve the venue from the JWT via genie_vendor — no venue id
 * or external_user_id is accepted from the caller, so one vendor cannot read or
 * write another's photos.
 */

/** GET /api/vendor/venue-images → genie/ep_get_venue_images_dev */
export async function GET(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await xanoFetch("genie/ep_get_venue_images_dev", { authToken });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET /api/vendor/venue-images failed:", error);
    return NextResponse.json({ error: "Could not load venue photos." }, { status: 500 });
  }
}

/**
 * POST /api/vendor/venue-images
 * Body: { images: string[] }  — ordered; index 0 becomes the primary.
 * Proxies to genie/ep_save_venue_images_dev, which replaces the whole set.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const images = Array.isArray(body.images)
      ? body.images.filter(
          (url): url is string => typeof url === "string" && url.trim().length > 0
        )
      : [];

    // Xano can't tell an empty array from an absent one, so removing every photo
    // needs the explicit flag rather than `images: []`.
    const payload: Record<string, unknown> =
      images.length > 0 ? { images } : { clear_images: true };

    const result = await xanoFetch("genie/ep_save_venue_images_dev", {
      method: "POST",
      authToken,
      body: payload,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/vendor/venue-images failed:", error);
    return NextResponse.json({ error: "Could not save venue photos." }, { status: 500 });
  }
}
