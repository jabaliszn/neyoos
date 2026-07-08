import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { studentApprovalRequestSchema, studentApprovalReviewSchema } from "@/lib/validations/student-approval";
import { getPendingApprovals, getStudentApprovalHistory, submitStudentApprovalRequest, reviewStudentApprovalRequest, ApprovalError } from "@/lib/services/student-approval.service";

export const dynamic = "force-dynamic";

/**
 * K.10 — Parent/teacher upload approval queue.
 *
 * GET  ?studentId=...  → request history for one student (row-scoped).
 * GET  (no params)     → pending pool (row-scoped to caller's classes for teachers).
 * POST                 → submit a PHOTO_UPDATE / DOCUMENT_UPLOAD request (own student only).
 * PATCH ?id=...        → approve / reject (requires student.edit).
 */

export async function GET(req: NextRequest) {
  try {
    // student.view is enough to read; the service enforces row-scope per student/class.
    const user = await requirePermission("student.view");
    const studentId = req.nextUrl.searchParams.get("studentId");

    if (studentId) {
      const history = await getStudentApprovalHistory(user, studentId);
      return ok(history);
    }
    const pending = await getPendingApprovals(user);
    return ok(pending);
  } catch (error) {
    if (error instanceof ApprovalError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400 } as const;
      return fail(error.code, error.message, statusMap[error.code]);
    }
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // student.view is the base read grant held by PARENT/TEACHER; ownership is
    // enforced inside the service via canViewStudent (a parent can only act on
    // their own child, a teacher only on a class they teach).
    const user = await requirePermission("student.view");
    const body = await req.json();
    const data = studentApprovalRequestSchema.parse(body);
    const request = await submitStudentApprovalRequest(user, data);
    return ok(request, 201);
  } catch (error) {
    if ((error as any).name === "ZodError") return fail("INVALID", (error as any).errors[0].message, 400);
    if (error instanceof ApprovalError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400 } as const;
      return fail(error.code, error.message, statusMap[error.code]);
    }
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Only staff with student.edit may approve (CLASS_TEACHER + leadership/DEAN).
    // Plain TEACHER lacks student.edit, so they cannot approve photo/document changes.
    const user = await requirePermission("student.edit");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("INVALID", "Missing id", 400);

    const body = await req.json();
    const review = studentApprovalReviewSchema.parse(body);
    const request = await reviewStudentApprovalRequest(user, id, review);
    return ok(request);
  } catch (error) {
    if ((error as any).name === "ZodError") return fail("INVALID", (error as any).errors[0].message, 400);
    if (error instanceof ApprovalError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400 } as const;
      return fail(error.code, error.message, statusMap[error.code]);
    }
    return handleError(error);
  }
}
