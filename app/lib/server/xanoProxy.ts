/**
 * Xano proxy helper — all backend calls go through here.
 *
 * Three base URLs:
 *   Genie:  /api:pgMKWi2e  — venues, vendor, dashboard
 *   Auth:   /api:dRDS80y8  — magic-link signup/login/me
 *   Stripe: /api:jQf3GatY  — native Stripe products/sessions
 */

const XANO_ORIGIN =
  process.env.XANO_BASE_URL || "https://xwpg-kuah-brlj.n7d.xano.io";

const GENIE_DEV_BASE =
  process.env.XANO_GENIE_DEV_BASE || `${XANO_ORIGIN}/api:pgMKWi2e`;

const AUTH_BASE =
  process.env.XANO_AUTH_BASE || `${XANO_ORIGIN}/api:dRDS80y8`;

const STRIPE_BASE =
  process.env.XANO_STRIPE_BASE || `${XANO_ORIGIN}/api:jQf3GatY`;

type XanoRequestInit = {
  method?: string;
  body?: unknown;
  authToken?: string;
  params?: Record<string, string>;
};

export class XanoError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(readXanoErrorMessage(body) || `Xano request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

function readXanoErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return typeof payload === "string" ? payload : null;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["message", "Message", "error", "detail"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  for (const value of Object.values(record)) {
    const nested = readXanoErrorMessage(value);
    if (nested) {
      return nested;
    }
  }

  return null;
}

async function baseFetch<T = unknown>(
  base: string,
  path: string,
  init: XanoRequestInit = {}
): Promise<T> {
  const { method = "GET", body, authToken, params } = init;

  let url = `${base}/${path.replace(/^\//, "")}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new XanoError(res.status, json);
  }

  return json as T;
}

/** Genie endpoints — /api:pgMKWi2e */
export async function xanoFetch<T = unknown>(
  path: string,
  init: XanoRequestInit = {}
): Promise<T> {
  return baseFetch<T>(GENIE_DEV_BASE, path, init);
}

/** Auth (Magic Link) endpoints — /api:dRDS80y8 */
export async function xanoAuthFetch<T = unknown>(
  path: string,
  init: XanoRequestInit = {}
): Promise<T> {
  return baseFetch<T>(AUTH_BASE, path, init);
}

/** Stripe endpoints — /api:jQf3GatY */
export async function xanoStripeFetch<T = unknown>(
  path: string,
  init: XanoRequestInit = {}
): Promise<T> {
  return baseFetch<T>(STRIPE_BASE, path, init);
}

/** Helper to extract Bearer token from request headers */
export function extractBearerToken(
  request: Request
): string | undefined {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return undefined;
  return auth.slice(7);
}
