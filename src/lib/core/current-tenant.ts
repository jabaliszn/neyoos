/**
 * Read the tenant the current request is scoped to via subdomain (A.2.3).
 * The middleware put the slug on `x-neyo-tenant-slug`; we resolve it to a tenant.
 */
import { headers } from "next/headers";
import { getTenantBySlug, type PublicTenant } from "@/lib/services/tenant.service";

/** The tenant slug resolved from the subdomain/override, or null at the root. */
export function currentTenantSlug(): string | null {
  return headers().get("x-neyo-tenant-slug");
}

/** The resolved tenant for this request (by subdomain), or null. */
export async function currentSubdomainTenant(): Promise<PublicTenant | null> {
  const slug = currentTenantSlug();
  if (!slug) return null;
  return getTenantBySlug(slug);
}
