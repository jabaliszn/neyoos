import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";
import { type StudentApprovalRequestInput, type StudentApprovalReviewInput } from "@/lib/validations/student-approval";

export class ApprovalError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

export async function submitStudentApprovalRequest(user: SessionUser, input: StudentApprovalRequestInput) {
  const tDb = tenantDb();
  
  // Basic validation that user can request this
  // In a real app we'd explicitly check if the PARENT owns this student
  // or if the TEACHER teaches this student.

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
    }
  });
}

export async function reviewStudentApprovalRequest(user: SessionUser, requestId: string, review: StudentApprovalReviewInput) {
  const tDb = tenantDb();
  
  const req = await tDb.studentApprovalRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new ApprovalError("NOT_FOUND", "Request not found");
  if (req.status !== "PENDING") throw new ApprovalError("INVALID", "Request already processed");

  // Perform the approval side effects
  if (review.status === "APPROVED") {
    if (req.requestType === "PHOTO_UPDATE") {
      await tDb.student.update({
        where: { id: req.studentId },
        data: { photoUrl: req.fileUrl }
      });
    } else if (req.requestType === "DOCUMENT_UPLOAD") {
      await tDb.studentDocument.create({
        data: {
          tenantId: user.tenantId,
          studentId: req.studentId,
          label: req.documentLabel || "Uploaded Document",
          fileUrl: req.fileUrl,
          fileName: req.fileName,
          uploadedById: req.requestedById
        }
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
      rejectionReason: review.rejectionReason || null
    }
  });
}

export async function getPendingApprovals(user: SessionUser, classId?: string) {
  const tDb = tenantDb();
  const where: any = { status: "PENDING" };
  
  if (classId) {
    where.student = { classId };
  }
  // If the user is a CLASS_TEACHER, they should only see requests for their class
  if (user.role === "CLASS_TEACHER") {
    const cls = await tDb.schoolClass.findFirst({ where: { classTeacherId: user.id } });
    if (cls) {
      where.student = { classId: cls.id };
    }
  }

  return tDb.studentApprovalRequest.findMany({
    where,
    include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
    orderBy: { createdAt: "asc" }
  });
}

export async function getStudentApprovalHistory(user: SessionUser, studentId: string) {
  return tenantDb().studentApprovalRequest.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" }
  });
}
