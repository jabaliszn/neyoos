import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import {
  getBundiProviderConfig,
  saveBundiProviderConfig,
  mintUnlockCode,
  revokeUnlockCode,
  listUnlockCodes,
  bundiUsageDashboard,
} from "@/lib/services/bundi-import.service";
import {
  mintUnlockCodeSchema,
  revokeUnlockCodeSchema,
} from "@/lib/validations/bundi-import";

export const dynamic = "force-dynamic";

/**
 * PART M.5 — NEYO Ops console for Bundi Handwritten Import.
 * SUPER_ADMIN only — company-level provider config, unlock-code minting, and
 * the real usage/cost dashboard (never tenant-scoped; this is NEYO's own
 * cost-control surface, not a school-facing feature).
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");
    const view = req.nextUrl.searchParams.get("view") || "dashboard";

    if (view === "config") return ok({ config: await getBundiProviderConfig() });
    if (view === "codes") return ok({ codes: await listUnlockCodes() });
    if (view === "usage") return ok({ usage: await bundiUsageDashboard() });

    const [config, codes, usage] = await Promise.all([
      getBundiProviderConfig(),
      listUnlockCodes(),
      bundiUsageDashboard(),
    ]);
    return ok({ config, codes, usage });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const body = await req.json().catch(() => ({}));
    const actor = { id: user.id, fullName: user.fullName, tenantId: user.tenantId };

    if (body.action === "update_config") {
      const config = await saveBundiProviderConfig(body.data, actor);
      return ok({ config });
    }
    if (body.action === "mint_code") {
      const input = mintUnlockCodeSchema.parse(body.data ?? {});
      const code = await mintUnlockCode(input, actor);
      return ok({ code }, 201);
    }
    if (body.action === "revoke_code") {
      const input = revokeUnlockCodeSchema.parse(body.data ?? {});
      const result = await revokeUnlockCode(input.codeId, actor);
      return ok(result);
    }

    return fail("INVALID", "Unknown action.", 422);
  } catch (err) {
    return handleError(err);
  }
}
