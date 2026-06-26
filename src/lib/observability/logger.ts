/**
 * Structured logging (Feature A.13). Real pino logger now.
 * In production, ship logs to Better Stack / Logtail by setting LOGTAIL_TOKEN
 * (a transport is wired then); otherwise logs go to stdout as JSON.
 */
import pino from "pino";

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");

/**
 * NOTE: pino transports (e.g. @logtail/pino) are configured at deploy by adding
 * the package + LOGTAIL_TOKEN. We keep the base logger here so app code is stable.
 */
export const logger = pino({
  level,
  base: { app: "neyo" },
  redact: {
    // Never log secrets even if accidentally passed in.
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "consumerKey",
      "consumerSecret",
      "passkey",
      "token",
      "sessionToken",
    ],
    censor: "[redacted]",
  },
});

/** Child logger scoped to a request/feature for traceable logs. */
export function scoped(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
