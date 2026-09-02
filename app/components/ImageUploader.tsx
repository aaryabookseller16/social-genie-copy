"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COVER_ASPECT_RATIO, ImageUploadError, uploadImage, type UploadFolder } from "@/app/lib/imageUpload";
import ImageCropModal from "@/app/components/ImageCropModal";

/** Folders whose main photo is shown as a fixed-box feed/hero image elsewhere — these get a crop step. */
const CROP_FOLDERS = new Set<UploadFolder>(["venues", "events", "offers"]);

/**
 * Files upload as soon as they're picked, not on form submit. An upload is a
 * multi-second round trip on mobile; deferring several of them behind one submit
 * button makes "which of my six photos failed?" unanswerable. Uploading on select
 * gives per-thumbnail progress and single-file retry, and by submit time `value`
 * is already an array of plain URL strings — so the create/save endpoints need no
 * changes. The cost is orphaned Cloudinary assets when a form is abandoned.
 */

const MAX_CONCURRENT = 3;

type Slot = {
  id: string;
  status: "uploading" | "done" | "error";
  url?: string;
  previewUrl?: string;
  error?: string;
  file?: File;
};

export type ImageUploaderProps = {
  mode: "single" | "multi";
  /**
   * Single-mode presentation. "rect" is the default full-width tile; "circle"
   * is the centred avatar puck with a pencil badge. Ignored in multi mode.
   */
  shape?: "rect" | "circle";
  /** Committed Cloudinary URLs. Single mode uses index 0. */
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: UploadFolder;
  /** Multi-mode cap. */
  max?: number;
  label?: string;
  /** Lets the parent disable submit while an upload is in flight. */
  onUploadingChange?: (busy: boolean) => void;
  disabled?: boolean;
};

let slotSeq = 0;
const nextId = () => `slot-${++slotSeq}`;

/** Runs tasks with a bounded number in flight so a phone connection isn't swamped. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await task(item);
    }
  });
  await Promise.all(workers);
}

export default function ImageUploader({
  mode,
  shape = "rect",
  value,
  onChange,
  folder,
  max = 8,
  label,
  onUploadingChange,
  disabled = false,
}: ImageUploaderProps) {
  const isSingle = mode === "single";
  const limit = isSingle ? 1 : max;

  const [slots, setSlots] = useState<Slot[]>(() =>
    value.filter(Boolean).map((url) => ({ id: nextId(), status: "done" as const, url }))
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const cropAspectRatio = folder && CROP_FOLDERS.has(folder) ? COVER_ASPECT_RATIO : undefined;
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropTotal, setCropTotal] = useState(0);

  // Re-seed only when the parent swaps in a genuinely different set (e.g. the user
  // opens a different event to edit). `hydratedFrom` also tracks every URL list we
  // hand back via `commit`, so our own emissions never bounce back as a re-seed.
  const hydratedFrom = useRef(value.join("|"));
  useEffect(() => {
    const key = value.join("|");
    if (key === hydratedFrom.current) return;
    hydratedFrom.current = key;
    setSlots(value.filter(Boolean).map((url) => ({ id: nextId(), status: "done", url })));
  }, [value]);

  const busy = slots.some((s) => s.status === "uploading");
  useEffect(() => {
    onUploadingChange?.(busy);
  }, [busy, onUploadingChange]);

  /** Only committed URLs reach the parent — a failed slot is simply excluded. */
  const commit = useCallback(
    (next: Slot[]) => {
      setSlots(next);
      const urls = next.filter((s) => s.status === "done" && s.url).map((s) => s.url!);
      hydratedFrom.current = urls.join("|");
      onChange(urls);
    },
    [onChange]
  );

  const runUpload = useCallback(
    async (slotId: string, file: File) => {
      try {
        const url = await uploadImage(file, folder);
        setSlots((prev) => {
          const next = prev.map((s) =>
            s.id === slotId ? { ...s, status: "done" as const, url, file: undefined } : s
          );
          const urls = next.filter((s) => s.status === "done" && s.url).map((s) => s.url!);
          hydratedFrom.current = urls.join("|");
          onChange(urls);
          return next;
        });
      } catch (error) {
        const message =
          error instanceof ImageUploadError || error instanceof Error
            ? error.message
            : "Upload failed.";
        setSlots((prev) =>
          prev.map((s) => (s.id === slotId ? { ...s, status: "error" as const, error: message } : s))
        );
      }
    },
    [folder, onChange]
  );

  const startUploads = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;

      const pending: Slot[] = accepted.map((file) => ({
        id: nextId(),
        status: "uploading",
        previewUrl: URL.createObjectURL(file),
        file,
      }));

      setSlots((prev) => (isSingle ? pending : [...prev, ...pending]));

      await mapWithConcurrency(pending, MAX_CONCURRENT, (slot) =>
        runUpload(slot.id, slot.file!)
      );
    },
    [isSingle, runUpload]
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const room = isSingle ? 1 : Math.max(0, limit - slots.length);
      const accepted = files.slice(0, room);
      if (!accepted.length) return;

      if (cropAspectRatio) {
        setCropTotal(accepted.length);
        setCropQueue(accepted);
        return;
      }

      await startUploads(accepted);
    },
    [isSingle, limit, slots.length, cropAspectRatio, startUploads]
  );

  const cropping = cropQueue[0];

  const handleCropConfirm = useCallback(
    (cropped: File) => {
      setCropQueue((prev) => prev.slice(1));
      void startUploads([cropped]);
    },
    [startUploads]
  );

  const handleCropCancel = useCallback(() => {
    setCropQueue((prev) => prev.slice(1));
  }, []);

  // Revoke object URLs when their slot goes away, so previews don't leak.
  useEffect(() => {
    return () => {
      slots.forEach((s) => s.previewUrl && URL.revokeObjectURL(s.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (slot?.previewUrl) URL.revokeObjectURL(slot.previewUrl);
    commit(slots.filter((s) => s.id !== id));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= slots.length) return;
    const next = [...slots];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  const retry = (id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot?.file) return;
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "uploading", error: undefined } : s))
    );
    void runUpload(id, slot.file);
  };

  const openPicker = () => inputRef.current?.click();
  const atCapacity = !isSingle && slots.length >= limit;

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple={!isSingle}
        className="hidden"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {isSingle && shape === "circle" ? (
        <AvatarTile
          slot={slots[0]}
          disabled={disabled}
          onPick={openPicker}
          onRemove={remove}
          onRetry={retry}
        />
      ) : isSingle ? (
        <SingleTile
          slot={slots[0]}
          disabled={disabled}
          onPick={openPicker}
          onRemove={remove}
          onRetry={retry}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {slots.map((slot, index) => (
            <Tile
              key={slot.id}
              slot={slot}
              index={index}
              count={slots.length}
              disabled={disabled}
              onRemove={remove}
              onRetry={retry}
              onMove={move}
            />
          ))}

          {!atCapacity && (
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400 transition hover:border-red-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:bg-black/20 dark:text-white/40"
            >
              <span className="text-2xl leading-none">+</span>
              <span className="text-[11px]">Add photo</span>
            </button>
          )}
        </div>
      )}

      {!isSingle && slots.length > 1 && (
        <p className="mt-2 text-[11px] text-gray-400 dark:text-white/40">
          The first photo is the main one. Use the arrows to reorder.
        </p>
      )}

      {cropping && cropAspectRatio && (
        <ImageCropModal
          file={cropping}
          aspectRatio={cropAspectRatio}
          step={{ index: cropTotal - cropQueue.length + 1, total: cropTotal }}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

function Tile({
  slot,
  index,
  count,
  disabled,
  onRemove,
  onRetry,
  onMove,
}: {
  slot: Slot;
  index: number;
  count: number;
  disabled: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onMove: (index: number, delta: number) => void;
}) {
  const src = slot.url ?? slot.previewUrl;

  return (
    <div
      className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border ${
        slot.status === "error"
          ? "border-red-500 ring-1 ring-red-500/40"
          : "border-gray-200 dark:border-white/15"
      }`}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`h-full w-full object-cover ${slot.status !== "done" ? "opacity-50" : ""}`}
        />
      )}

      {slot.status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Spinner />
        </div>
      )}

      {slot.status === "error" && (
        <button
          type="button"
          onClick={() => onRetry(slot.id)}
          title={slot.error}
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-semibold text-white"
        >
          Retry
        </button>
      )}

      {index === 0 && slot.status === "done" && (
        <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[10px] font-semibold text-white">
          Main
        </span>
      )}

      <button
        type="button"
        onClick={() => onRemove(slot.id)}
        disabled={disabled}
        aria-label="Remove photo"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white"
      >
        ×
      </button>

      {count > 1 && slot.status === "done" && (
        <div className="absolute left-1 top-1 flex gap-0.5">
          {index > 0 && <MoveButton label="‹" onClick={() => onMove(index, -1)} />}
          {index < count - 1 && <MoveButton label="›" onClick={() => onMove(index, 1)} />}
        </div>
      )}
    </div>
  );
}

function MoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white"
    >
      {label}
    </button>
  );
}

function SingleTile({
  slot,
  disabled,
  onPick,
  onRemove,
  onRetry,
}: {
  slot?: Slot;
  disabled: boolean;
  onPick: () => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  if (!slot) {
    return (
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400 transition hover:border-red-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:bg-black/20 dark:text-white/40"
      >
        <span className="text-2xl leading-none">+</span>
        <span className="text-xs">Choose a photo</span>
      </button>
    );
  }

  const src = slot.url ?? slot.previewUrl;

  return (
    <div
      className={`relative h-32 w-full overflow-hidden rounded-xl border ${
        slot.status === "error"
          ? "border-red-500 ring-1 ring-red-500/40"
          : "border-gray-200 dark:border-white/15"
      }`}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`h-full w-full object-cover ${slot.status !== "done" ? "opacity-50" : ""}`}
        />
      )}

      {slot.status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Spinner />
        </div>
      )}

      {slot.status === "error" && (
        <button
          type="button"
          onClick={() => onRetry(slot.id)}
          title={slot.error}
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-semibold text-white"
        >
          Retry
        </button>
      )}

      <button
        type="button"
        onClick={() => onRemove(slot.id)}
        disabled={disabled}
        aria-label="Remove photo"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm leading-none text-white"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Avatar variant: the whole puck is the picker, with a pencil badge as the
 * visual affordance. Keeps the remove control from SingleTile — dropping it
 * would leave no way to clear a photo once set.
 */
function AvatarTile({
  slot,
  disabled,
  onPick,
  onRemove,
  onRetry,
}: {
  slot?: Slot;
  disabled: boolean;
  onPick: () => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const src = slot?.url ?? slot?.previewUrl;

  return (
    <div className="relative mx-auto h-32 w-32">
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        aria-label={src ? "Change profile photo" : "Add profile photo"}
        className={`h-32 w-32 overflow-hidden rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
          slot?.status === "error"
            ? "border-red-500 ring-2 ring-red-500/40"
            : "border-white/20 hover:border-red-400"
        }`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className={`h-full w-full object-cover ${
              slot?.status !== "done" ? "opacity-50" : ""
            }`}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-[#F890B4]">
            <svg viewBox="0 0 24 24" className="h-full w-full text-white" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="8.5" r="4" />
              <path d="M12 14c-4.2 0-7.5 2.6-7.5 5.8V24h15v-4.2c0-3.2-3.3-5.8-7.5-5.8z" />
            </svg>
          </span>
        )}
      </button>

      {slot?.status === "uploading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
          <Spinner />
        </div>
      )}

      {slot?.status === "error" && (
        <button
          type="button"
          onClick={() => onRetry(slot.id)}
          title={slot.error}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-xs font-semibold text-white"
        >
          Retry
        </button>
      )}

      {/* Badge is decorative — the puck behind it opens the picker. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black/20 bg-red-600 text-white shadow-[0_6px_18px_rgba(231,7,3,0.45)]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </span>

      {slot && slot.status !== "uploading" && (
        <button
          type="button"
          onClick={() => onRemove(slot.id)}
          disabled={disabled}
          aria-label="Remove photo"
          className="absolute right-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm leading-none text-white transition hover:bg-black/80"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}
