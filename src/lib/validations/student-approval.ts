import { z } from "zod";

export const studentApprovalRequestSchema = z.object({
  studentId: z.string().cuid(),
  requestType: z.enum(["PHOTO_UPDATE", "DOCUMENT_UPLOAD"]),
  documentLabel: z.string().max(100).optional().nullable(),
  fileUrl: z.string().url(),
  fileName: z.string().max(200).optional().nullable(),
});

export const studentApprovalReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(500).optional().nullable(),
});

export type StudentApprovalRequestInput = z.infer<typeof studentApprovalRequestSchema>;
export type StudentApprovalReviewInput = z.infer<typeof studentApprovalReviewSchema>;
