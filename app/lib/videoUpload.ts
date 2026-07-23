// app/lib/videoUpload.ts
// Client-side video pipeline: validate -> sign -> upload directly to Cloudinary -> hosted URL.
//
// Unlike photos, video cannot be proxied through /api/upload/* as a JSON body — this app
// deploys to Vercel serverless functions, which hard-cap request bodies at ~4.5MB, and a
// 60-second video is routinely 20-100MB. Instead: /api/upload/video-signature (a tiny JSON
// request) hands back a short-lived Cloudinary signature, and the file itself uploads
// straight from the browser to Cloudinary. This is Cloudinary's own documented pattern for
// signed browser uploads — the API secret never leaves Xano.

import { apiJson } from "./publicApiClient";

export const ACCEPTED_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm"] as const;

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const MAX_VIDEO_DURATION_SECONDS = 60;

export type UploadFolder = "events" | "posts" | "offers";

export class VideoUploadError extends Error {}

export function validateVideoFile(file: File): void {
  if (!ACCEPTED_VIDEO_MIME.includes(file.type as (typeof ACCEPTED_VIDEO_MIME)[number])) {
    throw new VideoUploadError("Please choose an MP4, MOV, or WebM video.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new VideoUploadError("That video is too large. Please choose one under 100MB.");
  }
}

/** Reads video duration without uploading anything, via an off-DOM <video> element. */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new VideoUploadError("That video couldn't be read. Please try another file."));
    };
    video.src = objectUrl;
  });
}

/**
 * Cloudinary generates a JPG thumbnail of a video's first frame on request, lazily, with no
 * extra upload-time transform needed — just insert `so_0` (start-offset zero) into the
 * delivery URL and swap the extension. Documented Cloudinary behavior, not a guess.
 */
export function deriveVideoThumbnail(secureUrl: string): string {
  const withOffset = secureUrl.replace("/upload/", "/upload/so_0/");
  return withOffset.replace(/\.\w+(\?.*)?$/, ".jpg$1");
}

/**
 * Cloudinary transcodes on delivery, so playback surfaces should never request
 * the original upload. Sources here are raw phone clips — measured at 4.8MB,
 * 4.7MB and 7.4MB — and `q_auto`/`f_auto` roughly halves that with no visible
 * loss at feed size. Returns the URL untouched if it is not a Cloudinary
 * delivery URL, so a non-Cloudinary source still plays.
 */
export function cloudinaryVideoVariant(secureUrl: string, transform: string): string {
  if (!secureUrl.includes("/upload/")) return secureUrl;
  return secureUrl.replace("/upload/", `/upload/${transform}/`);
}

/** Muted inline cards. c_limit never upscales, so it only caps oversized uploads. */
export const VIDEO_VARIANT_PREVIEW = "f_auto:video,q_auto,w_480,c_limit";

/** Full-screen playback — source resolution, still transcoded for size. */
export const VIDEO_VARIANT_PLAYBACK = "f_auto:video,q_auto";

type SignatureResponse = {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
};

type CloudinaryVideoUploadResponse = {
  secure_url?: string;
  error?: { message?: string };
};

function uploadToCloudinary(
  file: File,
  sig: SignatureResponse,
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", sig.api_key);
    formData.append("timestamp", String(sig.timestamp));
    formData.append("signature", sig.signature);
    formData.append("folder", sig.folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloud_name}/video/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: CloudinaryVideoUploadResponse = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the generic error below
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
        resolve(body.secure_url);
      } else {
        reject(new VideoUploadError(body.error?.message || "Video upload failed. Please try again."));
      }
    };

    xhr.onerror = () => reject(new VideoUploadError("Video upload failed. Check your connection and try again."));

    xhr.send(formData);
  });
}

/** Uploads one video and resolves to its hosted URL plus a derived thumbnail URL. */
export async function uploadVideo(
  file: File,
  folder: UploadFolder,
  onProgress?: (pct: number) => void
): Promise<{ url: string; thumbnailUrl: string }> {
  validateVideoFile(file);

  const duration = await getVideoDuration(file);
  if (duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new VideoUploadError(
      `That video is ${Math.round(duration)}s long. Please choose one under ${MAX_VIDEO_DURATION_SECONDS} seconds.`
    );
  }

  const sig = await apiJson<SignatureResponse>("/api/upload/video-signature", {
    method: "POST",
    body: JSON.stringify({ folder }),
  });

  const url = await uploadToCloudinary(file, sig, onProgress);

  return { url, thumbnailUrl: deriveVideoThumbnail(url) };
}
