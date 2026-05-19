"use client";

import HamburgerMenu from "@/components/nav/HamburgerMenu";

export default function TopBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-5">
      <div className="mx-auto flex w-full max-w-md items-center justify-end">
        <HamburgerMenu />
      </div>
    </div>
  );
}
