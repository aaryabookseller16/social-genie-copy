"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";

export type ImageCropModalProps = {
  file: File;
  aspectRatio: number;
  /** 1-based position and total, e.g. "Photo 2 of 3" while working through a batch. */
  step?: { index: number; total: number };
  onConfirm: (cropped: File) => void;
  onCancel: () => void;
};

/** Draws the visible crop region to a canvas and resolves it as a PNG File. */
async function getCroppedImg(imageUrl: string, area: Area, fileName: string): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("crop decode failed"));
    img.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("crop encode failed");

  return new File([blob], fileName, { type: "image/png" });
}

export default function ImageCropModal({
  file,
  aspectRatio,
  step,
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!objectUrl || !croppedAreaPixels || busy) return;
    setBusy(true);
    try {
      const cropped = await getCroppedImg(objectUrl, croppedAreaPixels, file.name);
      onConfirm(cropped);
    } catch {
      // Cropping failed for some reason (unsupported source, canvas error) —
      // fall back to uploading the original rather than stranding the user.
      onConfirm(file);
    } finally {
      setBusy(false);
    }
  };

  // Portaled to <body> so this always escapes the current screen's own
  // `fixed z-40` wrapper (see ProducerSection.tsx) — nested inside it, our
  // z-index would only rank within that lower stacking context and the
  // app's bottom nav (z-[80]) would always render on top regardless.
  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[100] flex h-dvh flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        {objectUrl && (
          <Cropper
            image={objectUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        )}
      </div>

      <div
        className="flex shrink-0 flex-col gap-3 bg-black px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        {step && (
          <p className="text-center text-xs font-medium text-white/60">
            Photo {step.index} of {step.total}
          </p>
        )}

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-red-600"
          aria-label="Zoom"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full border border-white/20 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !croppedAreaPixels}
            className="flex-1 rounded-full bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Cropping…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
