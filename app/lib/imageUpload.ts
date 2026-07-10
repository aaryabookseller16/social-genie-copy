// app/lib/imageUpload.ts
// Client-side image pipeline: validate -> downscale/re-encode -> upload -> Cloudinary URL.
//
// Uploads go to /api/upload/image, which proxies to Xano `genie/ep_upload_image_dev`.
// The endpoint takes a base64 data URI and returns a hosted Cloudinary URL, which is
// what every create/save endpoint in this app already accepts.

import { apiJson } from "./publicApiClient";

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** Rejected before decode so a 40MP RAW-ish PNG never reaches the canvas. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/**
 * Longest edge after downscale. The phone-frame UI never renders an image wider
 * than a `max-w-md` column (448 CSS px), so 1600px covers it at 3x DPR. Larger
 * sources only inflate the base64 payload, which must clear Xano's body cap.
 */
export const MAX_EDGE = 1600;

export type UploadFolder = "avatars" | "events" | "posts" | "venues";

export class ImageUploadError extends Error {}

function isHeic(file: File) {
  return /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function validateFile(file: File): void {
  if (file.type === "image/gif") {
    throw new ImageUploadError(
      "GIFs aren't supported — animation is lost when the image is resized. Please choose a JPEG, PNG, or WebP."
    );
  }
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    throw new ImageUploadError("Please choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageUploadError("That image is too large. Please choose one under 25MB.");
  }
}

/**
 * `imageOrientation: "from-image"` is load-bearing: without it the canvas ignores
 * EXIF rotation and every photo shot in portrait on an iPhone uploads sideways.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * PNG is the output format everywhere. WebP was tried first but the Cloudinary
 * upload path rejects it ("Cloudinary upload failed") while PNG works — swapped
 * as a stopgap until that's root-caused. Lossless, so output is larger than WebP
 * would have been, but it keeps alpha support (transparent logos) that JPEG lacks.
 */
function encode(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

export async function downscaleToDataUrl(file: File): Promise<string> {
  validateFile(file);

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    // Chrome and Firefox cannot decode HEIC on canvas; Safari usually can. iOS
    // normally transcodes to JPEG on web upload, so this is an uncommon path.
    if (isHeic(file)) {
      throw new ImageUploadError(
        "HEIC images aren't supported in this browser — please choose a JPEG or PNG."
      );
    }
    throw new ImageUploadError("That image couldn't be read. Please try another file.");
  }

  const { width, height } = source;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageUploadError("That image couldn't be processed.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  if ("close" in source) source.close();

  return encode(canvas);
}

type UploadResponse = {
  success: boolean;
  cloudinary_url: string | null;
  error?: string;
};

/** Uploads one file and resolves to its hosted Cloudinary URL. */
export async function uploadImage(file: File, folder?: UploadFolder): Promise<string> {
  const dataUrl = await downscaleToDataUrl(file);

  const result = await apiJson<UploadResponse>("/api/upload/image", {
    method: "POST",
    body: JSON.stringify({ file: dataUrl, folder }),
  });

  if (!result.success || !result.cloudinary_url) {
    throw new ImageUploadError(result.error || "Upload failed. Please try again.");
  }

  return result.cloudinary_url;
}
