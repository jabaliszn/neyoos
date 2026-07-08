/**
 * T.8 (founder-requested 2026-07-06) — real parent-portal transport
 * route/shift change requests. A school must have explicitly opted in via
 * Tenant.allowParentTransportRequests (enforced server-side inside the
 * real service call, never just hidden in the UI).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { createRouteChangeRequestSchema } from "@/lib/validations/transport";
import {
  parentRequestTransportRouteChange,
  parentTransportRouteChangeRequests,
  parentTransportInfo,
} from "@/lib/services/parent-portal.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const studentId = req.nextUrl.searchParams.get("studentId") || "";
    if (req.nextUrl.searchParams.get("view") === "info") {
      return ok(await parentTransportInfo(user, studentId));
    }
    return ok({ requests: await parentTransportRouteChangeRequests(user, studentId) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const input = createRouteChangeRequestSchema.parse(await req.json().catch(() => ({})));
    return ok(await parentRequestTransportRouteChange(user, input), 201);
  } catch (e) {
    return handleError(e);
  }
}
