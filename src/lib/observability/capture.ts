/**
 * Error capture seam (Feature A.13 — Sentry + Better Stack).
 * Reads credentials from the encrypted NEYO Ops Integration Credential Vault.
 */
import { logger } from "@/lib/observability/logger";
import { sendBetterStackLog, sendSentryEvent } from "@/lib/observability/vault-observability";

export const SENTRY_ENABLED = Boolean(process.env.SENTRY_DSN);

export function captureError(err: unknown, context?: Record<string, unknown>) {
  const e = err instanceof Error ? err : new Error(String(err));
  logger.error({ err: { name: e.name, message: e.message, stack: e.stack }, ...context }, "captured_error");
  void sendSentryEvent({ level: "error", message: e.message, stack: e.stack, context }).catch(() => {});
  void sendBetterStackLog({ level: "error", message: e.message, context: { errName: e.name, stack: e.stack, ...context } }).catch(() => {});
}

export function captureMessage(message: string, context?: Record<string, unknown>) {
  logger.warn({ ...context }, message);
  void sendSentryEvent({ level: "warning", message, context }).catch(() => {});
  void sendBetterStackLog({ level: "warn", message, context }).catch(() => {});
}
