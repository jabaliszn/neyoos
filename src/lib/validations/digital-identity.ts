import { z } from "zod";

export const DIGITAL_IDENTITY_MODULES = [
  "ACADEMIC",
  "ATTENDANCE",
  "DISCIPLINE",
  "PORTFOLIO",
  "MEDICAL",
  "TALENT",
  "COMPETENCY"
] as const;

export const transferPassportRequestSchema = z.object({
  studentId: z.string().cuid(),
  destinationTenantId: z.string().cuid().optional().nullable(),
  destinationEmail: z.string().email().optional().nullable(),
  includedModules: z.array(z.enum(DIGITAL_IDENTITY_MODULES)).min(1, "Must select at least one module to transfer."),
  consentBy: z.string().min(2, "Name of the consenting parent/guardian is required."),
});

export type TransferPassportRequestInput = z.infer<typeof transferPassportRequestSchema>;
