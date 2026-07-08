/**
 * R.3 — GET/POST the school's requireBiometricForFinance setting.
 * GET: any signed-in staff with finance visibility can see the current state.
 * POST: only leadership (tenant.manage_settings) may change it.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { financeSecurityStatus, setFinanceSecurity } from "@/lib/services/finance-security.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("finance.view");
    return ok(await financeSecurityStatus(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const { enabled } = z.object({ enabled: z.boolean() }).parse(await req.json().catch(() => ({})));
    return ok(await setFinanceSecurity(user, enabled));
  } catch (err) {
    return handleError(err);
  }
}
