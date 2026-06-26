import { z } from "zod";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const timeHm = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

export const examTimetableCreateSchema = z.object({
  action: z.literal("create"),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  examName: z.string().trim().min(2).max(120),
  examDate: dateYmd,
  startTime: timeHm,
  endTime: timeHm,
  venue: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
}).refine((v) => v.endTime > v.startTime, { message: "End time must be after start time." });

export const examTimetableDeleteSchema = z.object({
  action: z.literal("delete"),
  id: z.string().min(1),
});

export const examTimetableActionSchema = z.union([examTimetableCreateSchema, examTimetableDeleteSchema]);
export type ExamTimetableCreateInput = z.infer<typeof examTimetableCreateSchema>;
