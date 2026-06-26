/**
 * Product analytics seam (Feature A.13 — PostHog).
 * Reads PostHog credentials from the encrypted NEYO Ops Integration Credential Vault.
 */
import { logger } from "@/lib/observability/logger";
import { sendPostHogEvent } from "@/lib/observability/vault-observability";

export const ANALYTICS_ENABLED = Boolean(process.env.POSTHOG_KEY);

export function track(event: string, props?: Record<string, unknown> & { distinctId?: string }) {
  logger.debug({ event, ...props }, "analytics_event");
  void sendPostHogEvent(event, props).catch(() => {});
}
