/**
 * B.17 Transport — Zod validation.
 */
import { z } from "zod";
import { normalizeKePhone } from "@/lib/validations/auth";

const kePhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeKePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Kenyan phone (07XX...)." });
      return z.NEVER;
    }
    return n;
  });

export const routeSchema = z.object({
  name: z.string().trim().min(2, "Name the route.").max(80),
  stops: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  termFeeKes: z.coerce.number().int().min(0).max(1_000_000).default(0),
  vehicleId: z.string().min(1).optional(),
  driverId: z.string().min(1).optional(),
});
export type RouteInput = z.infer<typeof routeSchema>;

export const driverSchema = z.object({
  fullName: z.string().trim().min(3, "Driver's full name.").max(100),
  phone: kePhone,
  licenseNo: z.string().trim().min(3, "DL number.").max(40),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nationalId: z.string().trim().max(20).optional(),
});
export type DriverInput = z.infer<typeof driverSchema>;

export const vehicleSchema = z.object({
  regNo: z.string().trim().min(4, "Registration, e.g. KCB 123A.").max(20).transform((v) => v.toUpperCase()),
  make: z.string().trim().max(60).optional(),
  capacity: z.coerce.number().int().min(1).max(200).default(33),
  insuranceExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  inspectionExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

export const maintenanceSchema = z.object({
  vehicleId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["SERVICE", "REPAIR", "TYRES", "INSPECTION", "OTHER"]),
  description: z.string().trim().min(3).max(500),
  costKes: z.coerce.number().int().min(0).max(10_000_000).default(0),
  odometerKm: z.coerce.number().int().min(0).optional(),
  garage: z.string().trim().max(100).optional(),
});
export type MaintenanceInput = z.infer<typeof maintenanceSchema>;

export const fuelSchema = z.object({
  vehicleId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  litres: z.coerce.number().positive("Litres must be positive.").max(1000),
  costKes: z.coerce.number().int().min(1).max(1_000_000),
  odometerKm: z.coerce.number().int().min(0).optional(),
  station: z.string().trim().max(100).optional(),
});
export type FuelInput = z.infer<typeof fuelSchema>;

export const assignSchema = z.object({
  routeId: z.string().min(1, "Pick the route."),
  studentId: z.string().min(1, "Pick the student."),
  pickupStop: z.string().trim().max(80).optional(),
});
export type AssignInput = z.infer<typeof assignSchema>;

export const transportInvoiceSchema = z.object({
  routeId: z.string().min(1),
  year: z.coerce.number().int().min(2020).max(2100),
  term: z.coerce.number().int().min(1).max(3),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type TransportInvoiceInput = z.infer<typeof transportInvoiceSchema>;
