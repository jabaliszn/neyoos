/**
 * B.22 Security API.
 * GET  /api/security                — gate passes + recent panic alerts
 * GET  /api/security?pickup=<q>     — pickup-authorisation lookup (gate desk)
 * POST {action: gatePass|usePass|cancelPass|addPickup|removePickup|panic|resolvePanic}
 * Permissions: security.view/manage; panic.raise for ANY staff.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, requirePermission } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { ok, handleError, fail } from "@/lib/api/respond";
import {
  issueGatePass, cancelGatePass, listGatePasses, decideGatePass,
  // Aliased: ESLint's react-hooks rule mistakes any "use*" import for a React
  // hook inside this async handler. Same function, lint-safe name.
  useGatePass as markGatePassUsed,
  addPickupPerson, removePickupPerson, pickupListFor,
  raisePanic, resolvePanic, listPanics, confirmPickupPerson,
  createAltPickup, listAltPickups, verifyAltPickup, cancelAltPickup,
} from "@/lib/services/security.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("security.view");
    const pickup = req.nextUrl.searchParams.get("pickup");
    if (pickup) return ok({ results: await pickupListFor(user, pickup) });
    if (req.nextUrl.searchParams.get("altPickups")) return ok({ altPickups: await listAltPickups(user) });
    const [passes, panics] = await Promise.all([listGatePasses(user), listPanics(user)]);
    return ok({ passes, panics });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = z
      .object({ action: z.enum(["gatePass", "approvePass", "rejectPass", "usePass", "cancelPass", "addPickup", "removePickup", "panic", "resolvePanic", "confirmPickup", "createAltPickup", "verifyAltPickup", "cancelAltPickup"]) })
      .parse(body).action;

    // PANIC: any staff with panic.raise — separate gate from security.manage.
    if (action === "panic") {
      const user = await requireUser();
      if (!can(user.role as Role, "panic.raise")) return fail("FORBIDDEN", "No panic permission.", 403);
      const input = z.object({
        kind: z.enum(["FIRE", "MEDICAL", "INTRUDER", "OTHER"]),
        location: z.string().trim().min(2).max(120),
        note: z.string().trim().max(300).optional(),
      }).parse(body);
      return ok(await raisePanic(user, input), 201);
    }

    if (action === "gatePass") {
      // I.7: HODs may propose gate passes even without security.manage;
      // service decides whether the pass is ACTIVE or PENDING approval.
      const user = await requireUser();
      const input = z.object({
        studentId: z.string().min(1),
        reason: z.string().trim().min(3).max(300),
        leaveAt: z.string().min(10),
        returnBy: z.string().min(10).optional(),
        escortName: z.string().trim().max(100).optional(),
      }).parse(body);
      return ok(await issueGatePass(user, input), 201);
    }
    if (action === "approvePass" || action === "rejectPass") {
      const user = await requireUser();
      const { passId, note } = z.object({ passId: z.string().min(1), note: z.string().trim().max(200).optional() }).parse(body);
      return ok(await decideGatePass(user, passId, action === "approvePass", note));
    }

    const user = await requirePermission("security.manage");
    if (action === "usePass") {
      const { passNo } = z.object({ passNo: z.string().min(3) }).parse(body);
      return ok(await markGatePassUsed(user, passNo));
    }
    if (action === "cancelPass") {
      const { passId } = z.object({ passId: z.string().min(1) }).parse(body);
      return ok(await cancelGatePass(user, passId));
    }
    if (action === "addPickup") {
      const input = z.object({
        studentId: z.string().min(1),
        fullName: z.string().trim().min(3).max(100),
        relationship: z.string().trim().min(2).max(60),
        phone: z.string().trim().min(9).max(20),
        nationalId: z.string().trim().max(20).optional(),
      }).parse(body);
      return ok(await addPickupPerson(user, input), 201);
    }
    if (action === "removePickup") {
      const { personId } = z.object({ personId: z.string().min(1) }).parse(body);
      return ok(await removePickupPerson(user, personId));
    }
    if (action === "confirmPickup") {
      const { studentId, personId } = z.object({ studentId: z.string().min(1), personId: z.string().min(1) }).parse(body);
      return ok(await confirmPickupPerson(user, studentId, personId));
    }
    if (action === "createAltPickup") {
      const input = z.object({
        studentId: z.string().min(1),
        pickerName: z.string().trim().min(3).max(100),
        pickerPhone: z.string().trim().max(20).optional(),
        relationship: z.string().trim().max(60).optional(),
        screenshotUrl: z.string().trim().max(500).optional(),
        screenshotName: z.string().trim().max(200).optional(),
        validHours: z.coerce.number().int().min(1).max(72).optional(),
      }).parse(body);
      return ok(await createAltPickup(user, input), 201);
    }
    if (action === "verifyAltPickup") {
      const { code } = z.object({ code: z.string().trim().min(3).max(20) }).parse(body);
      return ok(await verifyAltPickup(user, code));
    }
    if (action === "cancelAltPickup") {
      const { id } = z.object({ id: z.string().min(1) }).parse(body);
      return ok(await cancelAltPickup(user, id));
    }
    const { alertId } = z.object({ alertId: z.string().min(1) }).parse(body);
    return ok(await resolvePanic(user, alertId));
  } catch (e) {
    return handleError(e);
  }
}
