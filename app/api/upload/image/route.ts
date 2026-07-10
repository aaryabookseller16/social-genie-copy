import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/upload/image
 * Body: { file: "data:image/png;base64,...", folder?: "avatars"|"events"|"posts"|"venues" }
 * Proxies to: genie/ep_upload_image_dev → Cloudinary, returns the hosted URL.
 * Requires Bearer JWT.
 *
 * The client downscales before sending (app/lib/imageUpload.ts), then encodes PNG
 * (lossless, so noticeably larger than the WebP payloads this used to send — see
 * imageUpload.ts for why). The size check below is a backstop against a caller
 * that skips that pipeline, not the primary defense.
 */

const DATA_URI_PREFIX = /^data:image\/(?:jpeg|png|webp);base64,/;
const MAX_DECODED_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const file = String(body.file ?? "");

    if (!DATA_URI_PREFIX.test(file)) {
      return NextResponse.json(
        { error: "Expected a base64 image data URI (JPEG, PNG, or WebP)." },
        { status: 400 }
      );
    }

    const base64 = file.slice(file.indexOf(",") + 1);
    if (Math.floor(base64.length * 0.75) > MAX_DECODED_BYTES) {
      return NextResponse.json({ error: "Image too large." }, { status: 413 });
    }

    const payload: Record<string, unknown> = { file };
    if (body.folder) payload.folder = String(body.folder).slice(0, 64);

    const result = await xanoFetch("genie/ep_upload_image_dev", {
      method: "POST",
      authToken,
      body: payload,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/upload/image failed:", error);
    return NextResponse.json({ error: "Could not upload image." }, { status: 500 });
  }
}
