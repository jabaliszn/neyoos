/**
 * N.3 — Dynamic Newsletter Printing (validation).
 *
 * Replaces the old client-only window.print() HTML generator with a real
 * server-rendered PDF request contract. Kept deliberately small — this is a
 * bulk-print utility, not a new domain model, so no new Prisma table exists
 * (confirmed during the Part N audit: none was needed).
 */
import { z } from "zod";

export const NEWSLETTER_FORMATS = ["1-up", "2-up", "4-up"] as const;
export type NewsletterFormat = (typeof NEWSLETTER_FORMATS)[number];

export const printNewsletterSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "Select at least one student.").max(1000),
  title: z.string().trim().min(1, "Give the newsletter a title.").max(120),
  body: z.string().trim().min(1, "Write the newsletter body.").max(4000),
  personalized: z.boolean().default(true),
  format: z.enum(NEWSLETTER_FORMATS).default("2-up"),
  signOffLabel: z.string().trim().min(1).max(80).default("Administration"),
});
export type PrintNewsletterInput = z.infer<typeof printNewsletterSchema>;
