/**
 * B.21 Clinic API.
 * GET  /api/clinic                    — today's visits + allergy register + active meds + health report
 * GET  /api/clinic?file=<studentId>   — full medical file
 * GET  /api/clinic?child=<studentId>  — family portal child summary (portal.parent, scoped)
 * POST /api/clinic {action: profile|visit|medication|dose|stopMedication}
 * Permissions: clinic.view/manage (SUPPORT_STAFF nurse + leadership).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, requirePermission } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { ok, handleError, fail } from "@/lib/api/respond";
import { medicalProfileSchema, visitSchema, medicationPlanSchema } from "@/lib/validations/clinic";
import {
  upsertMedicalProfile, medicalFile, allergyRegister, recordVisit, listVisits,
  startMedication, giveDose, stopMedication, activeMedications, healthReport, childHealth,
} from "@/lib/services/clinic.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const child = sp.get("child");
    if (child) {
      const user = await requireUser();
      if (!can(user.role as Role, "portal.parent")) return fail("FORBIDDEN", "No access.", 403);
      return ok(await childHealth(user, child));
    }
    const user = await requirePermission("clinic.view");
    const file = sp.get("file");
    if (file) return ok(await medicalFile(user, file));
    const [visits, allergies, meds, report] = await Promise.all([
      listVisits(user),
      allergyRegister(user),
      activeMedications(user),
      healthReport(user),
    ]);
    return ok({ visits, allergies, meds, report });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("clinic.manage");
    const body = await req.json().catch(() => ({}));
    const action = z
      .object({ action: z.enum(["profile", "visit", "medication", "dose", "stopMedication"]) })
      .parse(body).action;
    if (action === "profile") return ok(await upsertMedicalProfile(user, medicalProfileSchema.parse(body)));
    if (action === "visit") return ok(await recordVisit(user, visitSchema.parse(body)), 201);
    if (action === "medication") return ok(await startMedication(user, medicationPlanSchema.parse(body)), 201);
    if (action === "dose") {
      const { planId, note } = z.object({ planId: z.string().min(1), note: z.string().trim().max(200).optional() }).parse(body);
      return ok(await giveDose(user, planId, note), 201);
    }
    const { planId } = z.object({ planId: z.string().min(1) }).parse(body);
    return ok(await stopMedication(user, planId));
  } catch (e) {
    return handleError(e);
  }
}
