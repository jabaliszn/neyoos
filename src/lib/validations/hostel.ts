/**
 * B.16 Hostel — Zod validation.
 */
import { z } from "zod";

export const hostelSchema = z.object({
  name: z.string().trim().min(2, "Name the hostel.").max(80),
  gender: z.enum(["BOYS", "GIRLS", "MIXED"]),
  masterId: z.string().min(1).optional(),
  boardingFeeKes: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
export type HostelInput = z.infer<typeof hostelSchema>;

export const roomSchema = z.object({
  hostelId: z.string().min(1, "Pick the hostel."),
  name: z.string().trim().min(1, "Name the room.").max(40),
  capacity: z.coerce.number().int().min(1, "At least 1 bed.").max(100),
});
export type RoomInput = z.infer<typeof roomSchema>;

export const allocateSchema = z.object({
  roomId: z.string().min(1, "Pick the room."),
  studentId: z.string().min(1, "Pick the student."),
  bedNo: z.coerce.number().int().min(1).optional(), // omit = first free bed
});
export type AllocateInput = z.infer<typeof allocateSchema>;

export const curfewSchema = z.object({
  hostelId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  marks: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["IN", "OUT", "LEAVE"]),
        note: z.string().trim().max(300).optional(),
      })
    )
    .min(1),
});
export type CurfewInput = z.infer<typeof curfewSchema>;

export const hostelInvoiceSchema = z.object({
  hostelId: z.string().min(1),
  year: z.coerce.number().int().min(2020).max(2100),
  term: z.coerce.number().int().min(1).max(3),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type HostelInvoiceInput = z.infer<typeof hostelInvoiceSchema>;
