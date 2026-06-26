/**
 * G.13 — "Mzazi Card" validation.
 * The public balance lookup is privacy-gated: a guardian must enter their phone
 * number (the one on record) before any fee balance is shown. No login.
 */
import { z } from "zod";

export const mzaziLookupSchema = z.object({
  phone: z.string().trim().min(7).max(20), // normalised server-side via normalizeKePhone
});

export const classBatchSchema = z.object({
  classId: z.string().min(1),
});

export type MzaziLookupInput = z.infer<typeof mzaziLookupSchema>;
