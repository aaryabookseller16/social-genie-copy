"use client";

import { useEffect, useState } from "react";

type GeoStatus = "idle" | "loading" | "granted" | "denied" | "error";

type GeoState = {
  lat: number | null;
  lng: number | null;
  status: GeoStatus;
};

const KEY = "genie_geo_v1";

export function useGenieLocation() {
  const [state, setState] = useState<GeoState>({
    lat: null,
    lng: null,
    status: "idle",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem(KEY);
    if (!saved) return;

    try {
      const p = JSON.parse(saved);
      if (typeof p.lat === "number" && typeof p.lng === "number") {
        setState({ lat: p.lat, lng: p.lng, status: "granted" });
      }
    } catch {}
  }, []);

  const requestLocation = () =>
    new Promise<{ lat: number | null; lng: number | null }>((resolve) => {
      if (typeof window === "undefined") return resolve({ lat: null, lng: null });

      if (!navigator.geolocation) {
        setState((s) => ({ ...s, status: "error" }));
        return resolve({ lat: null, lng: null });
      }

      setState((s) => ({ ...s, status: "loading" }));

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          window.localStorage.setItem(KEY, JSON.stringify({ lat, lng }));
          setState({ lat, lng, status: "granted" });

          resolve({ lat, lng });
        },
        () => {
          setState((s) => ({ ...s, status: "denied" }));
          resolve({ lat: null, lng: null });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

  return {
    lat: state.lat,
    lng: state.lng,
    status: state.status,
    requestLocation,
  };
}