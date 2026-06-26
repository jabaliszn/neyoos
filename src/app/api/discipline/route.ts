/**
 * B.20 Discipline API.
 * GET  /api/discipline                       — incidents (scoped) + suspensions + behavior board
 * GET  /api/discipline?counseling=1[&studentId=] — CONFIDENTIAL notes (counseling.confidential only)
 * GET  /api/discipline?child=<studentId>     — family portal child summary (portal.parent, scoped)
 * POST /api/discipline {action: incident|suspend|completeSuspension|counseling}
 * Permissions: discipline.view/manage; counseling gated separately.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, requirePermission } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { ok, handleError, fail } from "@/lib/api/respond";
import { incidentSchema, suspensionSchema, counselingSchema } from "@/lib/validations/discipline";
import {
  reportIncident, listIncidents, behaviorBoard, issueSuspension, listSuspensions,
  completeSuspension, addCounselingNote, listCounselingNotes, childDiscipline, approveSuspension, approveIncident,
} from "@/lib/services/discipline.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const child = sp.get("child");
    if (child) {
      const user = await requireUser();
      if (!can(user.role as Role, "portal.parent")) return fail("FORBIDDEN", "No access.", 403);
      return ok(await childDiscipline(user, child));
    }
    const user = await requirePermission("discipline.view");
    if (sp.get("counseling")) {
      return ok({ notes: await listCounselingNotes(user, sp.get("studentId") ?? undefined) });
    }
    const [incidents, suspensions, board] = await Promise.all([
      listIncidents(user, { studentId: sp.get("studentId") ?? undefined, search: sp.get("q") ?? undefined }),
      listSuspensions(user),
      behaviorBoard(user),
    ]);
    return ok({ incidents, suspensions, board, canConfidential: can(user.role as Role, "counseling.confidential") });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("discipline.manage");
    const body = await req.json().catch(() => ({}));
    const action = z
      .object({ action: z.enum(["incident", "suspend", "completeSuspension", "counseling", "approveSuspension", "approveIncident", "rejectIncident"]) })
      .parse(body).action;
    if (action === "incident") return ok(await reportIncident(user, incidentSchema.parse(body)), 201);
    if (action === "suspend") return ok(await issueSuspension(user, suspensionSchema.parse(body)), 201);
    if (action === "approveIncident" || action === "rejectIncident") {
      const { incidentId, note } = z.object({ incidentId: z.string().min(1), note: z.string().trim().max(200).optional() }).parse(body);
      return ok(await approveIncident(user, incidentId, action === "approveIncident", note));
    }
    if (action === "completeSuspension") {
      const { suspensionId } = z.object({ suspensionId: z.string().min(1) }).parse(body);
      return ok(await completeSuspension(user, suspensionId));
    }
    if (action === "approveSuspension") {
      const { suspensionId } = z.object({ suspensionId: z.string().min(1) }).parse(body);
      return ok(await approveSuspension(user, suspensionId));
    }
    return ok(await addCounselingNote(user, counselingSchema.parse(body)), 201);
  } catch (e) {
    return handleError(e);
  }
}
