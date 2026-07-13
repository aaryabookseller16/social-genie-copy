import { NextRequest, NextResponse } from "next/server";
import { xanoFetch, extractBearerToken, XanoError } from "@/app/lib/server/xanoProxy";

/**
 * POST /api/upload/video-signature
 * Body: { folder?: "events"|"posts" }
 * Proxies to: genie/ep_get_video_upload_signature_dev, which returns a short-lived
 * Cloudinary signed-upload payload. Requires Bearer JWT.
 *
 * This route never sees the video file itself — only this tiny signature request/response
 * passes through it. The browser then uploads the video directly to Cloudinary using the
 * returned signature (see app/lib/videoUpload.ts). Vercel's serverless function body-size
 * limit (~4.5MB) is why video can't be proxied the way /api/upload/image proxies photos.
 */

export async function POST(request: NextRequest) {
  try {
    const authToken = extractBearerToken(request);
    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload: Record<string, unknown> = {};
    if (body.folder) payload.folder = String(body.folder).slice(0, 64);

    const result = await xanoFetch("genie/ep_get_video_upload_signature_dev", {
      method: "POST",
      authToken,
      body: payload,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XanoError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/upload/video-signature failed:", error);
    return NextResponse.json({ error: "Could not get an upload signature." }, { status: 500 });
  }
}
