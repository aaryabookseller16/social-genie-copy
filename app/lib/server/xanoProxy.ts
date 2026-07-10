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
  for (const key of ["message", "Message", "error", "detail", "payload"]) {
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

/**
 * Some Xano functions `throw { name = ..., value = ... }` without an explicit
 * response-code configured on the throw block, so Xano defaults to HTTP 200
 * even though the request failed. The body still identifies itself as an
 * error: `{ statement: "Throw Error", payload: "<message>" }`. Without this
 * check, baseFetch would treat that 200 as success and callers would never
 * see the failure (confirmed live: a failed RSVP silently looked identical
 * to a successful one). Status is inferred from the message text since the
 * original throw `name` isn't present in this response shape.
 */
function isXanoThrowError(payload: unknown): payload is { statement: string; payload: string } {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  return record.statement === "Throw Error" && typeof record.payload === "string";
}

function inferThrowStatus(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("already")) return 409;
  if (lower.includes("not found") || lower.includes("no active")) return 404;
  return 400;
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
  if (isXanoThrowError(json)) {
    throw new XanoError(inferThrowStatus(json.payload), json);
  }
  return json as T;
}

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

/**
 * Maps a caught proxy error to a client-safe { status, message }.
 * 4xx messages (validation/auth) are safe to surface; 5xx / unknown errors are
 * masked behind `fallback` so backend internals never leak to the browser — the
 * detail is logged server-side instead.
 */
export function toClientError(
  error: unknown,
  fallback: string
): { status: number; message: string } {
  if (error instanceof XanoError) {
    if (error.status >= 400 && error.status < 500) {
      return { status: error.status, message: error.message };
    }
    console.error("[xano] upstream error", error.status, error.message, error.body);
    return { status: error.status, message: fallback };
  }
  console.error("[xano] proxy error", error);
  return { status: 500, message: fallback };
}
