/**
 * R.4 — Multi-School Parent Accounts.
 * A parent with real children at TWO different NEYO schools can link their
 * two separate accounts (never automatic — the founder's explicit choice —
 * verified by a fresh OTP to their own phone each time) and then switch
 * between them with one click, without ever merging the underlying tenant-
 * scoped accounts.
 */
import { z } from "zod";
import { kePhone } from "@/lib/validations/reception";

/** Step 1 — the parent enters the OTHER school's phone-registered account
 *  they want to link (their own phone number at that other school). We send
 *  a fresh OTP to that phone; nothing is linked yet. */
export const startLinkSchema = z.object({
  phone: kePhone,
});
export type StartLinkInput = z.infer<typeof startLinkSchema>;

/** Step 2 — the parent enters the 6-digit code we just sent to that phone. */
export const confirmLinkSchema = z.object({
  phone: kePhone,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});
export type ConfirmLinkInput = z.infer<typeof confirmLinkSchema>;

/** Switch the active session to one of the parent's already-linked accounts. */
export const switchSchoolSchema = z.object({
  targetUserId: z.string().min(1),
});
export type SwitchSchoolInput = z.infer<typeof switchSchoolSchema>;

/** Unlink a previously-linked school account (either side can remove it). */
export const unlinkSchoolSchema = z.object({
  targetUserId: z.string().min(1),
});
export type UnlinkSchoolInput = z.infer<typeof unlinkSchoolSchema>;
