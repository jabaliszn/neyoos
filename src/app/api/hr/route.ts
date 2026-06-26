/**
 * B.9 HR hub API.
 * GET  ?view=directory|leave|mine|postings|file&userId=
 * POST {action: profile|promote|leave_apply|leave_decide|posting|application|
 *       app_status|appraisal|disciplinary|training}
 * Reads: staff.view (leave_apply/mine = any staff). Writes: staff.manage
 * except leave_apply (self-service).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission, requireUser } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { kePhone } from "@/lib/validations/reception";
import {
  staffDirectory, upsertProfile, promoteStaff, applyForLeave, decideLeave,
  listLeave, leaveBalances, listPostings, createPosting, addApplication,
  setApplicationStatus, addAppraisal, addDisciplinary, addTraining, staffFile,
} from "@/lib/services/hr.service";

export const dynamic = "force-dynamic";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const view = sp.get("view") ?? "directory";
    if (view === "mine") {
      const user = await requireUser();
      return ok({ leave: await listLeave(user, true), balances: await leaveBalances(user, user.id) });
    }
    const user = await requirePermission("staff.view");
    if (view === "directory") return ok({ staff: await staffDirectory(user) });
    if (view === "leave") return ok({ leave: await listLeave(user, false) });
    if (view === "postings") return ok({ postings: await listPostings(user) });
    if (view === "file") {
      const userId = sp.get("userId");
      if (!userId) return fail("MISSING", "userId required.", 400);
      return ok(await staffFile(user, userId));
    }
    return fail("BAD_VIEW", "Unknown view.", 400);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = z.string().parse(body?.action);

    if (action === "leave_apply") {
      const user = await requireUser(); // any staff member, self-service
      const input = z.object({ type: z.string(), startDate: dateYmd, endDate: dateYmd, reason: z.string().max(300).optional() }).parse(body);
      return ok(await applyForLeave(user, input));
    }

    const user = await requirePermission("staff.manage");
    switch (action) {
      case "profile": {
        const input = z.object({
          userId: z.string().min(1), tscNumber: z.string().max(30).optional(), nationalId: z.string().max(20).optional(),
          kraPin: z.string().max(20).optional(), qualifications: z.string().max(300).optional(),
          employmentDate: dateYmd.optional().or(z.literal("")), contractType: z.enum(["PERMANENT", "CONTRACT", "BOM", "INTERN"]).optional(),
          contractEndDate: dateYmd.optional().or(z.literal("")), emergencyContact: z.string().max(120).optional(),
        }).parse(body);
        return ok(await upsertProfile(user, { ...input, employmentDate: input.employmentDate || undefined, contractEndDate: input.contractEndDate || undefined }));
      }
      case "promote": {
        const { userId, newRole, note } = z.object({ userId: z.string(), newRole: z.string(), note: z.string().max(200).optional() }).parse(body);
        return ok(await promoteStaff(user, userId, newRole, note));
      }
      case "leave_decide": {
        const { leaveId, approve, note } = z.object({ leaveId: z.string(), approve: z.boolean(), note: z.string().max(200).optional() }).parse(body);
        return ok(await decideLeave(user, leaveId, approve, note));
      }
      case "posting": {
        const input = z.object({ title: z.string().min(3).max(100), description: z.string().max(1000).optional(), deadline: dateYmd.optional().or(z.literal("")) }).parse(body);
        return ok(await createPosting(user, { ...input, deadline: input.deadline || undefined }));
      }
      case "application": {
        const input = z.object({ postingId: z.string(), name: z.string().min(2).max(80), phone: kePhone, email: z.string().email().optional().or(z.literal("")), notes: z.string().max(500).optional() }).parse(body);
        return ok(await addApplication(user, input.postingId, { ...input, email: input.email || undefined }));
      }
      case "app_status": {
        const { applicationId, status } = z.object({ applicationId: z.string(), status: z.enum(["NEW", "SHORTLISTED", "INTERVIEWED", "HIRED", "REJECTED"]) }).parse(body);
        return ok(await setApplicationStatus(user, applicationId, status));
      }
      case "appraisal": {
        const input = z.object({ userId: z.string(), period: z.string().min(4).max(12), score: z.coerce.number().int().min(1).max(5), strengths: z.string().max(500).optional(), improvements: z.string().max(500).optional() }).parse(body);
        return ok(await addAppraisal(user, input));
      }
      case "disciplinary": {
        const input = z.object({ userId: z.string(), date: dateYmd, category: z.enum(["VERBAL_WARNING", "WRITTEN_WARNING", "SUSPENSION", "OTHER"]), details: z.string().min(5).max(1000), actionTaken: z.string().max(500).optional() }).parse(body);
        return ok(await addDisciplinary(user, input));
      }
      case "training": {
        const input = z.object({ userId: z.string(), title: z.string().min(3).max(160), provider: z.string().max(100).optional(), date: dateYmd, durationDays: z.coerce.number().int().min(1).max(365).default(1), certificateUrl: z.string().max(500).optional() }).parse(body);
        return ok(await addTraining(user, input));
      }
      default:
        return fail("BAD_ACTION", "Unknown action.", 400);
    }
  } catch (e) {
    return handleError(e);
  }
}
