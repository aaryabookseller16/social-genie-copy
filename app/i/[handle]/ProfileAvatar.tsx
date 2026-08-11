"use client";

import { useState } from "react";
import Image from "next/image";
import ImageLightbox from "@/app/components/ImageLightbox";

type Props = {
  imageUrl?: string | null;
  displayName: string;
  firstNameInitial: string;
};

export function ProfileAvatar({ imageUrl, displayName, firstNameInitial }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!imageUrl) {
    return (
      <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full border-2 border-red-400 bg-red-600 text-xl font-bold text-white shadow-[0_0_16px_rgba(220,38,38,0.35)]">
        {firstNameInitial}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        aria-label="View profile photo"
        className="relative h-16 w-16 flex-none cursor-pointer overflow-hidden rounded-full border-2 border-red-400 shadow-[0_0_16px_rgba(220,38,38,0.35)]"
      >
        <Image src={imageUrl} alt={displayName} fill className="object-cover" sizes="64px" />
      </button>
      {lightboxOpen ? (
        <ImageLightbox src={imageUrl} alt={displayName} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </>
  );
}
