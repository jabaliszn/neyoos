/**
 * Identity generation config (Feature A.4 — two-ID system).
 *
 * Tenant ID format:  <PREFIX>-<ENTITY_CODE>-<PADDED_NUMBER>
 *   e.g. KH-S-000247  (Karibu High, Student, #247)
 *
 * - PREFIX is derived from the tenant slug (uppercased word-initials).
 * - ENTITY_CODE comes from ENTITY_CODES below.
 * - PADDED_NUMBER is an atomic per-(tenant, entityType) counter, zero-padded.
 */

/** Short codes per entity type. Extend as business modules land. */
export const ENTITY_CODES: Record<string, string> = {
  STUDENT: "S",
  STAFF: "T", // teacher/staff
  PARENT: "P",
  INVOICE: "INV",
  RECEIPT: "RCP",
  PAYMENT: "PAY",
  ADMISSION: "ADM",
  CLASS: "C",
  EXAM: "EXM",
  USER: "U",
  PURCHASE_ORDER: "PO", // B.25 procurement
};

/** Default zero-padding width for the numeric part. */
export const DEFAULT_PADDING = 6; // 000247

/**
 * Derive a short uppercase prefix from a tenant slug.
 *  "karibu-high"   -> "KH"
 *  "uhuru-academy" -> "UA"
 *  "stmarys"       -> "ST" (single word -> first two letters)
 */
export function prefixFromSlug(slug: string): string {
  const words = slug
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter(Boolean);

  if (words.length === 0) return "NE"; // NEYO fallback
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  // Multiple words: first letter of each of the first 3 words.
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Look up an entity code, or fall back to the uppercased type name. */
export function entityCode(entityType: string): string {
  return ENTITY_CODES[entityType.toUpperCase()] ?? entityType.toUpperCase();
}
