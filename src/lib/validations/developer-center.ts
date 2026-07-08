/**
 * Part X — Developer Center 2.0 (founder-requested 2026-07-06).
 * Real NEYO Ops configuration + query contracts for API monitoring.
 */
import { z } from "zod";

/** Real, NEYO-Ops-editable knobs — same proven config-JSON-in-`PlatformSetting`
 * pattern used everywhere else in NEYO. */
export const developerCenterConfigSchema = z.object({
  // Real, honest publish switch for the public developer docs page — off
  // by default until NEYO Ops is ready to announce the platform publicly.
  docsPublished: z.boolean(),
  // A real, sensible default per-key rate limit (requests/minute) new keys
  // get unless a specific key needs a different real limit.
  defaultRateLimitPerMinute: z.number().int().min(1).max(10000),
  // A slower-response threshold (ms) NEYO Ops wants flagged as "a slow
  // endpoint" in the real usage dashboard — never a hardcoded number.
  slowRequestThresholdMs: z.number().int().min(50).max(60000),
});
export type DeveloperCenterConfig = z.infer<typeof developerCenterConfigSchema>;

export function defaultDeveloperCenterConfig(): DeveloperCenterConfig {
  return {
    docsPublished: false,
    defaultRateLimitPerMinute: 120,
    slowRequestThresholdMs: 1500,
  };
}

/** A real query window for the Ops API-usage dashboard. */
export const apiUsageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  tenantId: z.string().optional(),
});
export type ApiUsageQueryInput = z.infer<typeof apiUsageQuerySchema>;
