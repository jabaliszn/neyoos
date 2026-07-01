/**
 * Zod validation for School Profile & Branding (G.9).
 */
import { z } from "zod";

const hex = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use a 6-digit hex colour, e.g. #1f9d5f");

export const joiningRequirementSchema = z.object({
  label: z.string().trim().min(1).max(80),
  category: z.enum(["uniform", "books", "supplies", "fees", "documents", "other"]).default("other"),
  quantity: z.string().trim().max(20).optional(),
  mandatory: z.boolean().default(true),
});
export type JoiningRequirement = z.infer<typeof joiningRequirementSchema>;

export const socialLinksSchema = z.object({
  website: z.string().trim().url().optional().or(z.literal("")),
  facebook: z.string().trim().url().optional().or(z.literal("")),
  instagram: z.string().trim().url().optional().or(z.literal("")),
  tiktok: z.string().trim().url().optional().or(z.literal("")),
  youtube: z.string().trim().url().optional().or(z.literal("")),
});

export const schoolProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  motto: z.string().trim().max(160).optional().or(z.literal("")),
  vision: z.string().trim().max(600).optional().or(z.literal("")),
  mission: z.string().trim().max(600).optional().or(z.literal("")),
  about: z.string().trim().max(1500).optional().or(z.literal("")),
  county: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  addressLine: z.string().trim().max(160).optional().or(z.literal("")),
  logoUrl: z.string().trim().max(500).optional().or(z.literal("")),
  brandPrimary: hex.optional().or(z.literal("")),
  brandAccent: hex.optional().or(z.literal("")),
  socialLinks: socialLinksSchema.optional(),
  joiningRequirements: z.array(joiningRequirementSchema).max(60).optional(),
  // G.17 geofence for GPS clock-in. null/undefined = leave as is; lat+lng
  // both empty strings = turn the geofence OFF.
  gpsLat: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
  gpsLng: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
  gpsRadiusM: z.coerce.number().int().min(50).max(5000).optional().or(z.literal("")),
  educationLevelsOffered: z.array(z.enum(["ECDE", "PRIMARY", "JUNIOR_SCHOOL", "SENIOR_SCHOOL"])) .max(4).optional(),
  // G.21: DAY-only schools don't see hostel/boarding features.
  schoolType: z.enum(["DAY", "BOARDING", "DAY_AND_BOARDING"]).optional(),
  // G.24 uniform supplier/tailor (orders are relayed to them).
  uniformSupplierName: z.string().trim().max(120).optional().or(z.literal("")),
  uniformSupplierPhone: z.string().trim().max(20).optional().or(z.literal("")),
});
export type SchoolProfileInput = z.infer<typeof schoolProfileSchema>;
