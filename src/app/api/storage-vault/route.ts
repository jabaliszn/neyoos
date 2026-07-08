import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  configureStorageProvider, recordStorageSnapshot, requestStorageUpgrade, runStorageHealthCheckForUser,
  storageProviderSchema, storageVaultSummary, linkedStorageSchema,
  linkExternalStorage, unlinkExternalStorage, recheckExternalStorageLink,
} from "@/lib/services/storage-vault.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("tenant.manage_settings");
    return ok(await storageVaultSummary(user));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const body = await req.json().catch(() => ({}));
    const action = z.enum(["configure", "upgrade", "snapshot", "healthCheck", "linkExternal", "unlinkExternal", "recheckExternal"]).parse(body.action || "configure");
    if (action === "upgrade") return ok({ provider: await requestStorageUpgrade(user, { plan: String(body.plan || "NEYO managed storage add-on") }) });
    if (action === "snapshot") return ok(await recordStorageSnapshot(user));
    if (action === "healthCheck") return ok(await runStorageHealthCheckForUser(user));
    // R.7 — School-Linked External Storage (leadership-only, real reachability-checked).
    if (action === "linkExternal") return ok({ provider: await linkExternalStorage(user, linkedStorageSchema.parse(body)) });
    if (action === "unlinkExternal") return ok({ provider: await unlinkExternalStorage(user) });
    if (action === "recheckExternal") return ok(await recheckExternalStorageLink(user));
    return ok({ provider: await configureStorageProvider(user, storageProviderSchema.parse(body)) });
  } catch (error) {
    return handleError(error);
  }
}
