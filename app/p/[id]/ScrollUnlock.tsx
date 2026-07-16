"use client";

import { useEffect } from "react";

// globals.css locks body { overflow: hidden; height: 100dvh } for
// SinglePageGenieApp. Standalone pages need to undo that so they scroll.
export function ScrollUnlock() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);
  return null;
}
