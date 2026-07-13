"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VideoUploadError, uploadVideo, type UploadFolder } from "@/app/lib/videoUpload";

/**
 * Mirrors ImageUploader.tsx's upload-on-select/per-tile-status/retry pattern, but for video:
 * uploads go straight from the browser to Cloudinary (see app/lib/videoUpload.ts) instead of
 * through this app's own upload route, and a tile shows upload progress instead of a plain
 * spinner since a video upload can take much longer than a photo's.
 */

/** Local shape for the picker's own state — camelCase, distinct from the API's VideoItem (snake_case) in publicApiClient.ts. */
export type VideoSlotValue = { url: string; thumbnailUrl: string };

const MAX_CONCURRENT = 2;

type Slot = {
  id: string;
  status: "uploading" | "done" | "error";
  url?: string;
  thumbnailUrl?: string;
  progress?: number;
  error?: string;
  file?: File;
};

export type VideoUploaderProps = {
  /** Committed {url, thumbnailUrl} pairs. */
  value: VideoSlotValue[];
  onChange: (items: VideoSlotValue[]) => void;
  folder: UploadFolder;
  /** Cap on how many video slots remain — typically 5 minus the current photo count. */
  max: number;
  label?: string;
  onUploadingChange?: (busy: boolean) => void;
  disabled?: boolean;
};

let slotSeq = 0;
const nextId = () => `vid-slot-${++slotSeq}`;

async function mapWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await task(item);
    }
  });
  await Promise.all(workers);
}

export default function VideoUploader({
  value,
  onChange,
  folder,
  max,
  label,
  onUploadingChange,
  disabled = false,
}: VideoUploaderProps) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    value
      .filter((v) => v.url)
      .map((v) => ({ id: nextId(), status: "done" as const, url: v.url, thumbnailUrl: v.thumbnailUrl }))
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const hydratedFrom = useRef(value.map((v) => v.url).join("|"));
  useEffect(() => {
    const key = value.map((v) => v.url).join("|");
    if (key === hydratedFrom.current) return;
    hydratedFrom.current = key;
    setSlots(
      value
        .filter((v) => v.url)
        .map((v) => ({ id: nextId(), status: "done" as const, url: v.url, thumbnailUrl: v.thumbnailUrl }))
    );
  }, [value]);

  const busy = slots.some((s) => s.status === "uploading");
  useEffect(() => {
    onUploadingChange?.(busy);
  }, [busy, onUploadingChange]);

  const commit = useCallback(
    (next: Slot[]) => {
      setSlots(next);
      const items = next
        .filter((s) => s.status === "done" && s.url && s.thumbnailUrl)
        .map((s) => ({ url: s.url!, thumbnailUrl: s.thumbnailUrl! }));
      hydratedFrom.current = items.map((i) => i.url).join("|");
      onChange(items);
    },
    [onChange]
  );

  const runUpload = useCallback(
    async (slotId: string, file: File) => {
      try {
        const { url, thumbnailUrl } = await uploadVideo(file, folder, (pct) => {
          setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, progress: pct } : s)));
        });
        setSlots((prev) => {
          const next = prev.map((s) =>
            s.id === slotId ? { ...s, status: "done" as const, url, thumbnailUrl, file: undefined } : s
          );
          const items = next
            .filter((s) => s.status === "done" && s.url && s.thumbnailUrl)
            .map((s) => ({ url: s.url!, thumbnailUrl: s.thumbnailUrl! }));
          hydratedFrom.current = items.map((i) => i.url).join("|");
          onChange(items);
          return next;
        });
      } catch (error) {
        const message =
          error instanceof VideoUploadError || error instanceof Error ? error.message : "Upload failed.";
        setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: "error" as const, error: message } : s)));
      }
    },
    [folder, onChange]
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const room = Math.max(0, max - slots.length);
      const accepted = files.slice(0, room);
      if (!accepted.length) return;

      const pending: Slot[] = accepted.map((file) => ({
        id: nextId(),
        status: "uploading",
        progress: 0,
        file,
      }));

      setSlots((prev) => [...prev, ...pending]);

      await mapWithConcurrency(pending, MAX_CONCURRENT, (slot) => runUpload(slot.id, slot.file!));
    },
    [max, slots.length, runUpload]
  );

  const remove = (id: string) => {
    commit(slots.filter((s) => s.id !== id));
  };

  const retry = (id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot?.file) return;
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, status: "uploading", progress: 0, error: undefined } : s)));
    void runUpload(id, slot.file);
  };

  const openPicker = () => inputRef.current?.click();
  const atCapacity = slots.length >= max;

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[13px] font-medium text-gray-500 dark:text-white/55">{label}</label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <VideoTile key={slot.id} slot={slot} disabled={disabled} onRemove={remove} onRetry={retry} />
        ))}

        {!atCapacity && max > 0 && (
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400 transition hover:border-red-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:bg-black/20 dark:text-white/40"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-[11px]">Add video</span>
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-gray-400 dark:text-white/40">
        Videos up to 60 seconds and 100MB.
      </p>
    </div>
  );
}

function VideoTile({
  slot,
  disabled,
  onRemove,
  onRetry,
}: {
  slot: Slot;
  disabled: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  return (
    <div
      className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border ${
        slot.status === "error" ? "border-red-500 ring-1 ring-red-500/40" : "border-gray-200 dark:border-white/15"
      }`}
    >
      {slot.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slot.thumbnailUrl}
          alt=""
          className={`h-full w-full object-cover ${slot.status !== "done" ? "opacity-50" : ""}`}
        />
      )}

      {slot.status === "done" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">▶</span>
        </span>
      )}

      {slot.status === "uploading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/30">
          <Spinner />
          <span className="text-[10px] font-semibold text-white">{slot.progress ?? 0}%</span>
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

      <button
        type="button"
        onClick={() => onRemove(slot.id)}
        disabled={disabled}
        aria-label="Remove video"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white"
      >
        ×
      </button>
    </div>
  );
}

function Spinner() {
  return <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}
