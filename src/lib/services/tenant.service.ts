/**
 * Tenant lookup service (Feature A.2).
 * These read the Tenant root table directly (Tenant is not tenant-scoped).
 */
import { db } from "@/lib/db";
import {
  tenantSlugSchema,
  slugify,
  SLUG_MAX,
} from "@/lib/validations/tenant";

export interface PublicTenant {
  id: string;
  name: string;
  slug: string;
  county: string | null;
}

/** Find a tenant by its slug (subdomain), or null. */
export async function getTenantBySlug(
  slug: string
): Promise<PublicTenant | null> {
  if (!slug) return null;
  const t = await db.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, county: true },
  });
  return t;
}

/** Find a tenant by id (e.g. from a session), or null. */
export async function getTenantById(
  id: string
): Promise<PublicTenant | null> {
  const t = await db.tenant.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, county: true },
  });
  return t;
}

// --- Slug validation & suggestion (A.2.5) ---

export type SlugCheck =
  | { ok: true; slug: string }
  | { ok: false; reason: "INVALID" | "RESERVED" | "TAKEN"; message: string };

/** Validate format + reserved words (no DB hit). */
function validateSlugFormat(
  slug: string
): { ok: true; slug: string } | { ok: false; message: string } {
  const parsed = tenantSlugSchema.safeParse(slug);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  return { ok: true, slug: parsed.data };
}

/** True if the slug is well-formed, not reserved, AND not already taken. */
export async function checkSlug(
  slug: string,
  opts?: { excludeTenantId?: string }
): Promise<SlugCheck> {
  const fmt = validateSlugFormat(slug);
  if (!fmt.ok) {
    // Distinguish reserved from generic-invalid for clearer UI copy.
    const reason = fmt.message.includes("reserved") ? "RESERVED" : "INVALID";
    return { ok: false, reason, message: fmt.message };
  }

  const existing = await db.tenant.findUnique({
    where: { slug: fmt.slug },
    select: { id: true },
  });
  if (existing && existing.id !== opts?.excludeTenantId) {
    return {
      ok: false,
      reason: "TAKEN",
      message: "That address is already taken.",
    };
  }

  return { ok: true, slug: fmt.slug };
}

/** Throwing version for use inside create/rename flows. */
export class SlugError extends Error {
  constructor(
    public reason: "INVALID" | "RESERVED" | "TAKEN",
    message: string
  ) {
    super(message);
    this.name = "SlugError";
  }
}

export async function assertSlugUsable(
  slug: string,
  opts?: { excludeTenantId?: string }
): Promise<string> {
  const res = await checkSlug(slug, opts);
  if (!res.ok) throw new SlugError(res.reason, res.message);
  return res.slug;
}

/**
 * Suggest an available slug derived from a school name, appending -2, -3, ...
 * until a free one is found.
 */
export async function suggestSlug(name: string): Promise<string> {
  const base = slugify(name) || "school";
  if ((await checkSlug(base)).ok) return base;

  for (let i = 2; i < 1000; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
    if ((await checkSlug(candidate)).ok) return candidate;
  }
  // Extremely unlikely fallback.
  return `${base.slice(0, SLUG_MAX - 7)}-${Date.now().toString(36).slice(-6)}`;
}
