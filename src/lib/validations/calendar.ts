/**
 * Zod validation for the Calendar feature (A.17).
 * Chunk 2: input contracts for calendar events.
 */
import { z } from "zod";
import { ROLES } from "@/lib/core/roles";

export const EVENT_TYPES = [
  "event",
  "meeting",
  "exam",
  "holiday",
  "sports",
  "deadline",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// B.25 recurring events — a safe, practical RRULE subset.
export const RECURRENCES = ["WEEKLY", "MONTHLY"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM time.");

// Audience: "all" (whole school) or one of the 16 roles.
const audience = z.enum(["all", ...ROLES] as [string, ...string[]]);

const eventFields = z.object({
  title: z.string().trim().min(2, "Give the event a title.").max(120),
  description: z.string().trim().max(500).optional(),
  date: isoDate,
  endDate: isoDate.optional(),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
  location: z.string().trim().max(120).optional(),
  type: z.enum(EVENT_TYPES).default("event"),
  audience: audience.default("all"),
  notify: z.boolean().default(false), // A.17.5: send invites to the audience
  recurrence: z.enum(RECURRENCES).optional(), // B.25: WEEKLY | MONTHLY | (omitted = one-off)
  recurUntil: isoDate.optional(), // last day the series may occur (inclusive)
});

const withRefinements = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine((v: any) => !v.endDate || v.endDate >= v.date, {
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    })
    .refine((v: any) => !(v.startTime && v.endTime) || v.endTime > v.startTime, {
      message: "End time must be after start time.",
      path: ["endTime"],
    })
    .refine((v: any) => !v.recurUntil || !v.date || v.recurUntil >= v.date, {
      message: "“Repeat until” must be on or after the start date.",
      path: ["recurUntil"],
    })
    .refine((v: any) => !v.recurUntil || v.recurrence, {
      message: "Choose how the event repeats first.",
      path: ["recurrence"],
    });

export const createEventSchema = withRefinements(eventFields);
export type CreateEventInput = z.infer<typeof createEventSchema>;

// Update: all fields optional; refinements re-applied for the cross-field rules.
export const updateEventSchema = withRefinements(eventFields.partial());
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const calendarPrefsSchema = z.object({
  showReligiousHolidays: z.boolean(),
});
