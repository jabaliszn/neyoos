import { z } from "zod";

export const CAREER_AREAS = [
  "Engineering & Technology",
  "Medicine & Healthcare",
  "Agriculture & Environmental",
  "Business & Economics",
  "ICT & Computer Science",
  "Creative Arts & Design",
  "Sports & Athletics",
  "Education & Training",
  "Law & Public Service",
  "Other"
] as const;

export const RECORD_TYPES = ["STUDENT_INTEREST", "TEACHER_RECOMMENDATION", "PARENT_CONVERSATION"] as const;

export const careerDiscoverySchema = z.object({
  studentId: z.string().cuid(),
  recordType: z.enum(RECORD_TYPES),
  careerArea: z.enum(CAREER_AREAS).optional().nullable(),
  notes: z.string().min(2, "Notes are required").max(1000),
});

export type CareerDiscoveryInput = z.infer<typeof careerDiscoverySchema>;
