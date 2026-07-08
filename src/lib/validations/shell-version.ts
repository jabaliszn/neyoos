/**
 * Shell Version (founder-requested "NEYO Shell V2", 2026-07-04) — validation.
 * Modeled directly on the existing G.33/I.74 platform-appearance pattern
 * (PlatformSetting-backed, company-wide today). Phase 1 = NEYO Ops only sets
 * the platform default. Phase 2 (2026-07-05, this file) = a real STAGED
 * release gate NEYO Ops configures (master on/off + which schools get early
 * access), plus a personal per-user override once released — the founder's
 * own words: "for now neyo ops but later wen we launch it every one can
 * change in their setting and later it becomes companys default."
 */
import { z } from "zod";

export const SHELL_VERSIONS = ["v1", "v2"] as const;
export type ShellVersion = (typeof SHELL_VERSIONS)[number];

export const setShellVersionSchema = z.object({
  shellVersion: z.enum(SHELL_VERSIONS),
});
export type SetShellVersionInput = z.infer<typeof setShellVersionSchema>;

/** A staff member's own personal choice — null clears back to "follow the
 * platform/school default", exactly like O.3's lgContrast "company" option. */
export const setPersonalShellVersionSchema = z.object({
  shellVersion: z.union([z.enum(SHELL_VERSIONS), z.null()]),
});
export type SetPersonalShellVersionInput = z.infer<typeof setPersonalShellVersionSchema>;

/** NEYO Ops staged-release control: master on/off + a real per-school early-
 * access list, same shape/spirit as the existing J.23 Revenue Grants model
 * (a JSON map in PlatformSetting, no new table needed). */
export const setShellReleaseSchema = z.object({
  released: z.boolean().optional(),
  tenantId: z.string().min(1).optional(),
  earlyAccess: z.boolean().optional(),
}).refine(
  (v) => v.released !== undefined || (v.tenantId !== undefined && v.earlyAccess !== undefined),
  "Provide either { released } for the master switch, or { tenantId, earlyAccess } for one school's early access."
);
export type SetShellReleaseInput = z.infer<typeof setShellReleaseSchema>;
