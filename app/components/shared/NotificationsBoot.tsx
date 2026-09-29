"use client";

import { useEffect } from "react";
import OneSignal from "react-onesignal";
import { ONE_SIGNAL_APP_ID } from "@/app/lib/config";

let oneSignalInitPromise: Promise<void> | null = null;

export function NotificationsBoot() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!oneSignalInitPromise) {
      oneSignalInitPromise = OneSignal.init({
        appId: ONE_SIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: "/OneSignalSDKWorker.js",
      }).catch((error) => {
        console.error("Failed to initialize OneSignal", error);
      });
    }
  }, []);

  return null;
}

export async function requestPushPermission() {
  try {
    await OneSignal.Slidedown.promptPush();
    const playerId = OneSignal.User.PushSubscription.id;
    return typeof playerId === "string" && playerId.trim().length > 0
      ? playerId
      : null;
  } catch (error) {
    console.error("Push permission error:", error);
    return null;
  }
}
