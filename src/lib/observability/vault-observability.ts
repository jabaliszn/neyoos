import { readCompanySecret } from "@/lib/services/company-secret.service";

export async function getObservabilityVaultConfig() {
  return {
    sentryDsn: (await readCompanySecret("sentry_dsn")) || process.env.SENTRY_DSN || "",
    betterStackToken: (await readCompanySecret("better_stack_token")) || process.env.BETTER_STACK_TOKEN || process.env.LOGTAIL_TOKEN || "",
    betterStackIngestUrl: (await readCompanySecret("better_stack_ingest_url")) || process.env.BETTER_STACK_INGEST_URL || "https://in.logs.betterstack.com",
    posthogKey: (await readCompanySecret("posthog_key")) || process.env.POSTHOG_KEY || "",
    posthogHost: (await readCompanySecret("posthog_host")) || process.env.POSTHOG_HOST || "https://app.posthog.com",
  };
}

function parseSentryDsn(dsn: string) {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "").split("/").pop();
    if (!publicKey || !projectId) return null;
    return { publicKey, projectId, storeUrl: `${url.protocol}//${url.host}/api/${projectId}/store/` };
  } catch {
    return null;
  }
}

export async function sendSentryEvent(input: { level: "error" | "warning" | "info"; message: string; stack?: string; context?: Record<string, unknown> }) {
  const config = await getObservabilityVaultConfig();
  if (!config.sentryDsn) return { sent: false, reason: "not_configured" };
  const parsed = parseSentryDsn(config.sentryDsn);
  if (!parsed) return { sent: false, reason: "invalid_dsn" };
  const payload = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    logger: "neyo",
    level: input.level,
    message: input.message,
    exception: input.level === "error" ? { values: [{ type: "Error", value: input.message, stacktrace: input.stack ? { frames: [{ filename: "server", function: input.stack }] } : undefined }] } : undefined,
    extra: input.context || {},
  };
  const res = await fetch(parsed.storeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=neyo-vault/1.0`,
    },
    body: JSON.stringify(payload),
  });
  return { sent: res.ok, status: res.status };
}

export async function sendBetterStackLog(input: { level: string; message: string; context?: Record<string, unknown> }) {
  const config = await getObservabilityVaultConfig();
  if (!config.betterStackToken) return { sent: false, reason: "not_configured" };
  const res = await fetch(config.betterStackIngestUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.betterStackToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ dt: new Date().toISOString(), app: "neyo", level: input.level, message: input.message, ...input.context }),
  });
  return { sent: res.ok, status: res.status };
}

export async function sendPostHogEvent(event: string, props?: Record<string, unknown> & { distinctId?: string }) {
  const config = await getObservabilityVaultConfig();
  if (!config.posthogKey) return { sent: false, reason: "not_configured" };
  const distinctId = props?.distinctId || "neyo-server";
  const res = await fetch(`${config.posthogHost.replace(/\/$/, "")}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: config.posthogKey, event, distinct_id: distinctId, properties: { ...props, distinctId: undefined } }),
  });
  return { sent: res.ok, status: res.status };
}
