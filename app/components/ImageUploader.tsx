"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUploadError, uploadImage, type UploadFolder } from "@/app/lib/imageUpload";

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

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const room = isSingle ? 1 : Math.max(0, limit - slots.length);
      const accepted = files.slice(0, room);
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
    [isSingle, limit, slots.length, runUpload]
  );

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

      {isSingle ? (
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

function Spinner() {
  return (
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}
