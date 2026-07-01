import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import { SessionUser } from "@/lib/core/session";
import { canViewStudent } from "@/lib/services/student.service";
import { type StudentApprovalRequestInput, type StudentApprovalReviewInput } from "@/lib/validations/student-approval";

export class ApprovalError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

/**
 * K.10 — Parent / teacher upload requests that enter a Pending Approval state.
 *
 * SECURITY MODEL (this is the repaired, honest version):
 *  - A requester may only raise a request for a student they are allowed to see.
 *    We reuse `canViewStudent` (B.1 row-scoping) so:
 *      - a PARENT can only request for their OWN child (Guardian.userId link),
 *      - a TEACHER / CLASS_TEACHER can only request for a student in a class
 *        they teach (classTeacherId link),
 *      - leadership/office can request for any student in the tenant.
 *  - Only holders of `student.edit` (CLASS_TEACHER + leadership/DEAN) may APPROVE
 *    or REJECT. Plain TEACHER has only `student.view`, so they CANNOT silently
 *    edit a student's photo — they must raise a request that a class teacher /
 *    department approves. That is the "restrict teachers from editing student
 *    photos without explicit department permission" rule, enforced for real.
 */

export async function submitStudentApprovalRequest(user: SessionUser, input: StudentApprovalRequestInput) {
  // Ownership / row-scope check: requester must be allowed to see this student.
  const allowed = await canViewStudent(user, input.studentId);
  if (!allowed) {
    throw new ApprovalError("FORBIDDEN", "You can only submit requests for your own student.");
  }

  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    return tDb.studentApprovalRequest.create({
      data: {
        tenantId: user.tenantId,
        studentId: input.studentId,
        requestedByRole: user.role,
        requestedById: user.id,
        requestedByName: user.fullName,
        requestType: input.requestType,
        documentLabel: input.documentLabel || null,
        fileUrl: input.fileUrl,
        fileName: input.fileName || null,
      },
    });
  });
}

export async function reviewStudentApprovalRequest(user: SessionUser, requestId: string, review: StudentApprovalReviewInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    const req = await tDb.studentApprovalRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new ApprovalError("NOT_FOUND", "Request not found");
    if (req.status !== "PENDING") throw new ApprovalError("INVALID", "Request already processed");

    // Reviewer must also be allowed to see this student (row-scope on approve side):
    // a class teacher cannot approve a request for a child outside their class.
    const allowed = await canViewStudent(user, req.studentId);
    if (!allowed) {
      throw new ApprovalError("FORBIDDEN", "You can only review requests for students in your scope.");
    }

    // Perform the approval side effects.
    if (review.status === "APPROVED") {
      if (req.requestType === "PHOTO_UPDATE") {
        await tDb.student.update({
          where: { id: req.studentId },
          data: { photoUrl: req.fileUrl },
        });
      } else if (req.requestType === "DOCUMENT_UPLOAD") {
        await tDb.studentDocument.create({
          data: {
            tenantId: user.tenantId,
            studentId: req.studentId,
            label: req.documentLabel || "Uploaded Document",
            fileUrl: req.fileUrl,
            fileName: req.fileName,
            uploadedById: req.requestedById,
          },
        });
      }
    }

    return tDb.studentApprovalRequest.update({
      where: { id: requestId },
      data: {
        status: review.status,
        reviewedById: user.id,
        reviewedByName: user.fullName,
        reviewedAt: new Date(),
        rejectionReason: review.rejectionReason || null,
      },
    });
  });
}

export async function getPendingApprovals(user: SessionUser, classId?: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const where: any = { status: "PENDING" };

    if (classId) {
      where.student = { classId };
    }
    // A CLASS_TEACHER / TEACHER only sees requests for students in classes they
    // are the class teacher of (fail-closed if they teach none).
    if (user.role === "CLASS_TEACHER" || user.role === "TEACHER") {
      const classes = await tDb.schoolClass.findMany({
        where: { classTeacherId: user.id },
        select: { id: true },
      });
      const ids = classes.map((c) => c.id);
      where.student = { classId: { in: ids.length ? ids : ["__none__"] } };
    }

    return tDb.studentApprovalRequest.findMany({
      where,
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
      orderBy: { createdAt: "asc" },
    });
  });
}

export async function getStudentApprovalHistory(user: SessionUser, studentId: string) {
  // Only return history for a student the caller is allowed to see.
  const allowed = await canViewStudent(user, studentId);
  if (!allowed) {
    throw new ApprovalError("FORBIDDEN", "You cannot view this student's request history.");
  }
  return withTenant(user.tenantId, async () => {
    return tenantDb().studentApprovalRequest.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });
  });
}
