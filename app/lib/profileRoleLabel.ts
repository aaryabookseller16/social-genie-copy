/**
 * "Vendor" / "Producer" label for a profile. A person can hold both roles at
 * once (e.g. a producer who also runs a vendor account) — Vendor wins in that
 * case, per product decision.
 */
export function getProfileRoleLabel(roles?: string[] | null): string | undefined {
  if (!roles || roles.length === 0) return undefined;
  if (roles.includes("vendor")) return "Vendor";
  if (roles.includes("producer")) return "Producer";
  return undefined;
}
