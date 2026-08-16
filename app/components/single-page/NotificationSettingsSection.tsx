"use client";

import { useEffect, useState } from "react";
import { BackIcon } from "@/app/components/single-page/ui";
import {
  fetchProducerNotifPrefs,
  updateProducerNotifPrefs,
} from "@/app/lib/publicApiClient";

/**
 * Full "Manage Notifications" screen — all nine per-user notification
 * preferences on one page. Reuses the same endpoints as the producer settings
 * screen. Saving always sends the complete object (the Xano
 * `update-notification-preferences-dev` endpoint requires every field), which
 * is why this works where the old single-toggle card returned
 * `Missing param: notify_new_follower`.
 */

type NotifPrefs = {
  notify_new_follower: boolean;
  notify_post_like: boolean;
  notify_post_comment: boolean;
  notify_going_match: boolean;
  notify_venue_energy_alert: boolean;
  notify_event_reminder: boolean;
  notify_promoter_new_event: boolean;
  notify_new_message: boolean;
  notify_genie_alerts: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  notify_new_follower: true,
  notify_post_like: true,
  notify_post_comment: true,
  notify_going_match: true,
  notify_venue_energy_alert: true,
  notify_event_reminder: true,
  notify_promoter_new_event: true,
  notify_new_message: true,
  notify_genie_alerts: true,
};

const NOTIF_TOGGLES: { key: keyof NotifPrefs; label: string }[] = [
  { key: "notify_new_message", label: "New messages" },
  { key: "notify_new_follower", label: "New follower" },
  { key: "notify_post_like", label: "Post liked" },
  { key: "notify_post_comment", label: "Post commented" },
  { key: "notify_going_match", label: "Friend going to same event" },
  { key: "notify_venue_energy_alert", label: "Venue energy alerts" },
  { key: "notify_event_reminder", label: "Event reminders" },
  { key: "notify_promoter_new_event", label: "New event from someone you follow" },
  { key: "notify_genie_alerts", label: "Genie platform alerts" },
];

export function NotificationSettingsSection({
  visible,
  onBack,
}: {
  visible: boolean;
  onBack: () => void;
}) {
  const [form, setForm] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // (Re)load the current preferences each time the screen opens.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    fetchProducerNotifPrefs()
      .then((prefs) => {
        if (cancelled) return;
        setForm({
          notify_new_follower: prefs.notify_new_follower ?? true,
          notify_post_like: prefs.notify_post_like ?? true,
          notify_post_comment: prefs.notify_post_comment ?? true,
          notify_going_match: prefs.notify_going_match ?? true,
          notify_venue_energy_alert: prefs.notify_venue_energy_alert ?? true,
          notify_event_reminder: prefs.notify_event_reminder ?? true,
          notify_promoter_new_event: prefs.notify_promoter_new_event ?? true,
          notify_new_message: prefs.notify_new_message ?? true,
          notify_genie_alerts: prefs.notify_genie_alerts ?? true,
        });
      })
      .catch(() => {
        // Fall back to all-on defaults if the read fails.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProducerNotifPrefs(form);
      setMessage("Settings saved.");
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <section className="flex flex-1 flex-col pb-28">
      <div className="mb-5 flex items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 dark:border dark:border-white/12 dark:bg-black/24 dark:text-white/82"
        >
          <BackIcon size={20} />
        </button>
        <h2 className="flex-1 pr-9 text-center font-[family:var(--font-display)] text-[1.35rem] font-semibold text-gray-900 dark:text-white">
          Notifications
        </h2>
      </div>

      <p className="mb-4 text-center text-sm text-gray-500 dark:text-white/60">
        Choose what you want to be notified about.
      </p>

      <form onSubmit={handleSave} className="space-y-3">
        {NOTIF_TOGGLES.map(({ key, label }) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white/60 px-4 py-3.5 dark:border-white/10 dark:bg-black/20"
          >
            <span className="text-sm text-gray-800 dark:text-white/80">
              {label}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form[key]}
              aria-label={label}
              disabled={loading || saving}
              onClick={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                form[key] ? "bg-red-600" : "bg-gray-300 dark:bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  form[key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}

        {message ? (
          <p
            className={`text-sm ${
              message.includes("saved") ? "text-green-500" : "text-red-500"
            }`}
          >
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || saving}
          className="w-full rounded-[18px] border border-red-500 bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 dark:border-[#d75050] dark:bg-[linear-gradient(180deg,rgba(134,10,12,0.88),rgba(81,3,4,0.95))]"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </section>
  );
}
