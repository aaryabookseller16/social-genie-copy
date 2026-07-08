"use client";

import { useEffect } from "react";
import OneSignal from "react-onesignal";
import { registerPushToken } from "@/app/lib/publicApiClient";
import { readExternalUserId } from "@/app/lib/sessionToken";

let oneSignalInitPromise: Promise<void> | null = null;

const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ??
  "2b0988a9-9a1e-4039-9131-e4859ea641e2";

/** Pull a thread_id out of a push URL (e.g. .../messages?thread_id=1). */
function threadIdFromUrl(url: string | undefined | null): number | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    const raw = parsed.searchParams.get("thread_id");
    const num = raw ? Number(raw) : NaN;
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

export function NotificationsBoot() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!oneSignalInitPromise) {
      oneSignalInitPromise = OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        // Single worker at scope "/" (public/sw.js imports the OneSignal SDK).
        serviceWorkerPath: "/sw.js",
        serviceWorkerParam: { scope: "/" },
      })
        .then(() => {
          // Re-register whenever the device's subscription id changes (new
          // device/token) so the recipient never silently gets "no_token".
          OneSignal.User.PushSubscription.addEventListener("change", (change) => {
            const id = change.current?.id;
            if (id && readExternalUserId()) {
              void registerPushToken(id).catch((error) => {
                console.error("Failed to re-register push token", error);
              });
            }
          });

          // Deep-link when a push is tapped while the app is already open.
          // (Cold opens navigate straight to the launch URL, handled by the
          // /messages route.)
          OneSignal.Notifications.addEventListener("click", (event) => {
            const url = event.result?.url ?? event.notification?.launchURL;
            const threadId = threadIdFromUrl(url);
            if (threadId !== null) {
              window.location.href = `/?screen=conversation&thread_type=user&thread_id=${threadId}`;
            }
          });
        })
        .catch((error) => {
          console.error("Failed to initialize OneSignal", error);
        });
    }
  }, []);

  return null;
}

/** Whether the browser has already granted notification permission. */
export function isPushPermissionGranted(): boolean {
  try {
    return OneSignal.Notifications.permission === true;
  } catch {
    return false;
  }
}

/** The current device's OneSignal subscription id, if one exists. */
export function getPushSubscriptionId(): string | null {
  try {
    const id = OneSignal.User.PushSubscription.id;
    return typeof id === "string" && id.trim().length > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function requestPushPermission() {
  try {
    await OneSignal.Slidedown.promptPush();
    return getPushSubscriptionId();
  } catch (error) {
    console.error("Push permission error:", error);
    return null;
  }
}
