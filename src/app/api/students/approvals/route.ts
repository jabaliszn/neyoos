import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { studentApprovalRequestSchema, studentApprovalReviewSchema } from "@/lib/validations/student-approval";
import { getPendingApprovals, getStudentApprovalHistory, submitStudentApprovalRequest, reviewStudentApprovalRequest, ApprovalError } from "@/lib/services/student-approval.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("students.view"); // Any staff can view if they pass row-level, but PARENTs need a different endpoint or we check role.
    const studentId = req.nextUrl.searchParams.get("studentId");
    
    if (studentId) {
      const history = await getStudentApprovalHistory(user, studentId);
      return ok({ data: history });
    } else {
      // Need academics.view or student.edit to see pending pool
      const pending = await getPendingApprovals(user);
      return ok({ data: pending });
    }
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("students.view"); // Base access, PARENT logic might differ
    const body = await req.json();
    const data = studentApprovalRequestSchema.parse(body);
    const request = await submitStudentApprovalRequest(user, data);
    return ok({ data: request }, 201);
  } catch (error) {
    if ((error as any).name === "ZodError") return fail("INVALID", (error as any).errors[0].message, 400);
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission("student.edit"); // Only authorized staff can approve
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("INVALID", "Missing id", 400);
    
    const body = await req.json();
    const review = studentApprovalReviewSchema.parse(body);
    const request = await reviewStudentApprovalRequest(user, id, review);
    return ok({ data: request });
  } catch (error) {
    if (error instanceof ApprovalError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400 };
      return fail(error.code, error.message, statusMap[error.code as keyof typeof statusMap] as any);
    }
    return handleError(error);
  }
}
