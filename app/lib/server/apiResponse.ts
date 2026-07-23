import { NextResponse } from "next/server";

/**
 * JSON response that no cache may store.
 *
 * Vercel serves route handlers with `Cache-Control: public, max-age=0,
 * must-revalidate` by default. `public` is wrong for a per-user,
 * token-authenticated body — it permits shared caches to hold it — and, more
 * practically, it gives the browser and any service worker no signal that the
 * response is user-specific. Use this for anything that varies by caller.
 *
 * Note this is defence in depth, not the primary fix: the Cache Storage API
 * used by service workers ignores HTTP cache headers entirely. The rule that
 * actually keeps `/api/**` out of the app's cache lives in `public/sw.js`.
 */
export function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    },
  });
}
