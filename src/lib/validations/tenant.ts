import { z } from "zod";
import { RESERVED_SUBDOMAINS } from "@/lib/core/subdomain";

/**
 * Tenant slug rules (Feature A.2.5).
 * A slug becomes a subdomain (karibu-high.neyo.co.ke), so it must be:
 *  - lowercase a–z, 0–9, single hyphens between segments
 *  - 3–40 chars, not start/end with a hyphen, no double hyphens
 *  - not a reserved subdomain (api, admin, www, ...)
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN, `Use at least ${SLUG_MIN} characters`)
  .max(SLUG_MAX, `Use at most ${SLUG_MAX} characters`)
  .regex(
    slugPattern,
    "Use lowercase letters, numbers and single hyphens (e.g. karibu-high)"
  )
  .refine((s) => !RESERVED_SUBDOMAINS.has(s), {
    message: "That address is reserved. Please choose another.",
  });

/** School name + slug, for tenant creation. */
export const createTenantSchema = z.object({
  name: z.string().trim().min(2, "Enter the school name").max(120),
  slug: tenantSlugSchema,
  county: z.string().trim().max(60).optional(),
});

/**
 * Turn an arbitrary school name into a candidate slug.
 * "St. Mary's Karibu High!" -> "st-marys-karibu-high"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/['']/g, "") // drop apostrophes so "mary's" -> "marys"
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, "") // trim hyphens
    .replace(/-{2,}/g, "-") // collapse repeats
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, ""); // re-trim after slice
}

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
