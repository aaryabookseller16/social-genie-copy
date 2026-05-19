"use client";

import Image from "next/image";

export default function GenieStage() {
  return (
    <div className="relative flex items-center justify-center overflow-visible">
    {/* Red Orb + Glow */}
<div
  className="
    absolute
    flex items-center justify-center
    w-[700px] max-w-[80vw]
    aspect-square
    -translate-y-[150px]
    -translate-x-4
    opacity-95
    pointer-events-none
  "
>
  {/* Tight rim halo */}
<div
  className="
    absolute
    w-[400px] max-w-[45vw]
    aspect-square
    rounded-full
    bg-red-900
    blur-[22px]
    opacity-30
    pointer-events-none
  "
/>

  {/* orb image */}
  <Image
    src="/red-orb.png"
    alt="Red Orb"
    fill
    className="object-contain"
    priority
  />

  {/* subtle flare ring */}
  <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
</div>


      {/* GENIE */}
      <div className="relative z-10">
        <Image
          src="/genie-pic2.png"
          alt="Genie"
          width={360}
          height={520}
          priority
          className="object-contain"
        />
      </div>
    </div>
  );
}
