/**
 * B.3 Attendance — validation (Chunk 2).
 * WHO: attendance.record = TEACHER/CLASS_TEACHER (own classes via row-scoping)
 *      + leadership. attendance.view = those plus PARENT/STUDENT (own rows).
 */
import { z } from "zod";

export const ATTENDANCE_STATUSES = ["P", "A", "L", "E"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  P: "Present",
  A: "Absent",
  L: "Late",
  E: "Excused",
};

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

/** Mark (or re-mark) a whole class register in one request — idempotent. */
export const markRegisterSchema = z.object({
  classId: z.string().min(1),
  date: dateYmd,
  marks: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(ATTENDANCE_STATUSES),
        note: z.string().trim().max(200).optional().or(z.literal("")),
      })
    )
    .min(1)
    .max(200),
  /** Queue absentee SMS to guardians (quota-checked, deduped per day). */
  notifyAbsent: z.boolean().default(false),
  /**
   * H.2 Principal Master Attendance Override: when true, a PRINCIPAL/SCHOOL_OWNER
   * is deliberately taking over a class register as the school master. The server
   * verifies the role and audits the action as an explicit override.
   */
  masterOverride: z.boolean().optional(),
});
export type MarkRegisterInput = z.infer<typeof markRegisterSchema>;

export const registerQuerySchema = z.object({
  classId: z.string().min(1),
  date: dateYmd,
});

export const historyQuerySchema = z.object({
  studentId: z.string().optional(),
  classId: z.string().optional(),
  from: dateYmd.optional(),
  to: dateYmd.optional(),
});
