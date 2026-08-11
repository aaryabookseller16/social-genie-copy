/**
 * "Happening Tonight / This Weekend / This Week" — derived purely from the
 * event's date on every call, never stored. That's what makes editing an
 * event's date safe: the badge is just a projection of event_date, so the
 * next render always reflects the current value with nothing to overwrite.
 *
 * event_date is a plain YYYY-MM-DD already localized to the city — compared
 * via date components (not `new Date(string)`, which parses as UTC and can
 * slip a day) to avoid timezone drift.
 */
export function getEventBadge(eventDate?: string): string | undefined {
  if (!eventDate) return undefined;
  const [y, m, d] = eventDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;

  const eventDay = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const daysAway = Math.round((eventDay.getTime() - today.getTime()) / 86400000);
  if (daysAway < 0 || daysAway > 6) return undefined;
  if (daysAway === 0) return "Happening Tonight";

  const dayOfWeek = eventDay.getDay(); // 0 Sun … 6 Sat
  const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  return isWeekendDay ? "Happening This Weekend" : "Happening This Week";
}
