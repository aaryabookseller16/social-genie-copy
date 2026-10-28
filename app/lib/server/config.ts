const XANO_ORIGIN =
  process.env.XANO_BASE_URL || "https://xwpg-kuah-brlj.n7d.xano.io";

export const XANO_GENIE_BASE =
  process.env.XANO_GENIE_DEV_BASE || `${XANO_ORIGIN}/api:pgMKWi2e`;

export const XANO_AUTH_BASE =
  process.env.XANO_AUTH_BASE || `${XANO_ORIGIN}/api:dRDS80y8`;

export const XANO_STRIPE_BASE =
  process.env.XANO_STRIPE_BASE || `${XANO_ORIGIN}/api:jQf3GatY`;

export const XANO_GENIE_VENUES_URL =
  process.env.XANO_GENIE_VENUES_URL ||
  `${XANO_ORIGIN}/api:mY7zYhwk/genie_v1`;

/** Xano datasource to read and write (e.g. `tamu_capstone`). Empty uses Xano's default (live). */
export const XANO_DATA_SOURCE = (process.env.XANO_DATA_SOURCE || "").trim();

/** Headers that point a Xano request at XANO_DATA_SOURCE, or none when it is unset. */
export function xanoDataSourceHeaders(): Record<string, string> {
  return XANO_DATA_SOURCE ? { "X-Data-Source": XANO_DATA_SOURCE } : {};
}
