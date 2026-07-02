import { z } from "zod";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const SERVICE_CATEGORIES = ["ENVIRONMENT", "CHARITY", "SCHOOL_SERVICE", "COMMUNITY", "OTHER"] as const;

export const communityServiceSchema = z.object({
  studentId: z.string().cuid(),
  title: z.string().min(2, "Title is required").max(100),
  category: z.enum(SERVICE_CATEGORIES),
  date: dateYmd,
  hours: z.number().int().min(1, "Must log at least 1 hour").max(100),
  location: z.string().max(100).optional().nullable(),
  supervisorName: z.string().max(100).optional().nullable(),
  supervisorPhone: z.string().max(20).optional().nullable(),
  studentReflection: z.string().max(1000).optional().nullable(),
  proofFileId: z.string().cuid().optional().nullable(),
  competencyId: z.string().cuid().optional().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
});

export const communityServiceDecisionSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
  competencyId: z.string().cuid().optional().nullable(),
});

export type CommunityServiceInput = z.infer<typeof communityServiceSchema>;
export type CommunityServiceDecisionInput = z.infer<typeof communityServiceDecisionSchema>;
