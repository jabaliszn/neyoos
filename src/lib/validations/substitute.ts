/**
 * T.12 (founder-requested 2026-07-07) — real, date-scoped substitute-teacher
 * coverage validation. Founder's own confirmed answers baked in here:
 *  - substitutes are PROPOSED, never fully automatic — a human must confirm.
 *  - a genuinely unfillable slot is recorded honestly as UNFILLED, never a
 *    fabricated substitute name.
 *  - the original teacher's slots are restored only when a human explicitly
 *    marks them back (never a same-day automatic reversion).
 */
import { z } from "zod";

export const generateSubstituteProposalsSchema = z.object({
  leaveRequestId: z.string().min(1),
});

export const decideSubstituteSchema = z.object({
  substituteAssignmentId: z.string().min(1),
  approve: z.boolean(),
  declineReason: z.string().trim().max(300).optional(),
});

/** A human may swap in a different real teacher than the one auto-suggested,
 * before or instead of confirming the system's own pick. */
export const reassignSubstituteSchema = z.object({
  substituteAssignmentId: z.string().min(1),
  substituteTeacherId: z.string().min(1),
});

/** Founder's own confirmed answer: restoration is a real, explicit human
 * action — never an automatic same-day reversion — to correctly cover a
 * teacher returning early or a leave that gets extended. */
export const revertSubstituteSchema = z.object({
  substituteAssignmentId: z.string().min(1),
});
