/**
 * Subdomain → tenant slug resolution (Feature A.2.3).
 *
 * Production:  karibu-high.neyo.co.ke  -> "karibu-high"
 * Dev:         localhost has no subdomains, so we also accept
 *                - ?tenant=karibu-high   (query override)
 *                - x-neyo-tenant header  (set by middleware/tests)
 * Bare root (neyo.co.ke / localhost) -> null (no tenant; root/marketing).
 *
 * Set ROOT_DOMAIN in prod (e.g. "neyo.co.ke") for precise extraction.
 */

// Subdomains that are NOT tenants (reserved). Also used by slug validation later.
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "auth",
  "static",
  "assets",
  "cdn",
  "mail",
  "blog",
  "help",
  "status",
  "docs",
  "neyo",
]);

function rootDomain(): string {
  return process.env.ROOT_DOMAIN || "neyo.co.ke";
}

/** Extract a tenant slug from a Host header, or null. */
export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;

  // Strip port and lowercase.
  const hostname = host.split(":")[0].toLowerCase().trim();

  // Local dev hosts never carry a real tenant subdomain.
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost")
  ) {
    // Support "karibu-high.localhost" for those who set /etc/hosts.
    if (hostname.endsWith(".localhost")) {
      const sub = hostname.replace(".localhost", "");
      return RESERVED_SUBDOMAINS.has(sub) ? null : sub || null;
    }
    return null;
  }

  const root = rootDomain();
  if (hostname === root || hostname === `www.${root}`) return null;

  if (hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -1 * (root.length + 1)); // remove ".<root>"
    // Only the first label is the tenant (ignore deeper nesting).
    const firstLabel = sub.split(".")[0];
    if (!firstLabel || RESERVED_SUBDOMAINS.has(firstLabel)) return null;
    return firstLabel;
  }

  // Unknown host (custom domain handled separately in A.2.4) -> no slug here.
  return null;
}

/**
 * Resolve the tenant slug for a request, honoring dev overrides.
 * `host` = Host header; `searchTenant` = ?tenant= value; `headerTenant` = x-neyo-tenant.
 */
export function resolveTenantSlug(opts: {
  host?: string | null;
  searchTenant?: string | null;
  headerTenant?: string | null;
}): string | null {
  const fromHost = slugFromHost(opts.host);
  if (fromHost) return fromHost;

  // Dev-only overrides (also harmless in prod if present).
  const override = (opts.headerTenant || opts.searchTenant || "")
    .toLowerCase()
    .trim();
  if (override && !RESERVED_SUBDOMAINS.has(override)) return override;

  return null;
}
