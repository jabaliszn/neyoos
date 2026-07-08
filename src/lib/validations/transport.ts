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

// T.8 (founder-requested 2026-07-06) — real, separate shifts under one
// route, each with its own vehicle/driver/time window/seat cap/fee.
export const shiftSchema = z.object({
  routeId: z.string().min(1, "Pick the route."),
  name: z.string().trim().min(1, "Name the shift, e.g. Morning.").max(40),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM, e.g. 06:30.").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM, e.g. 07:15.").optional(),
  vehicleId: z.string().min(1).optional(),
  driverId: z.string().min(1).optional(),
  seatCapOverride: z.coerce.number().int().min(1).max(200).optional(),
  termFeeKesOverride: z.coerce.number().int().min(0).max(1_000_000).optional(),
});
export type ShiftInput = z.infer<typeof shiftSchema>;

export const assignSchema = z.object({
  routeId: z.string().min(1, "Pick the route."),
  studentId: z.string().min(1, "Pick the student."),
  shiftId: z.string().min(1).optional(), // T.8 — a route with real shifts requires one; a route with none (legacy shape) ignores this
  pickupStop: z.string().trim().max(80).optional(),
});
export type AssignInput = z.infer<typeof assignSchema>;

/** T.8 — real, automatic seat allocation at enrollment time. The founder's
 * own confirmed tie-break rule: the caller/parent picks a preferred route,
 * the system only validates + auto-picks a real shift with a free seat on
 * that route (never silently re-routes a student to a DIFFERENT route the
 * caller didn't ask for). */
export const autoAllocateSchema = z.object({
  studentId: z.string().min(1, "Pick the student."),
  routeId: z.string().min(1, "Pick the route."),
  pickupStop: z.string().trim().max(80).optional(),
});
export type AutoAllocateInput = z.infer<typeof autoAllocateSchema>;

/** T.8 — a real, school-configurable effective seat cap independent of the
 * vehicle's own physical capacity ("a school can customize the seats
 * number to their liking too"). */
export const setSeatCapSchema = z.object({
  shiftId: z.string().min(1),
  seatCapOverride: z.coerce.number().int().min(1).max(200).nullable(),
});
export type SetSeatCapInput = z.infer<typeof setSeatCapSchema>;

/** T.8 — a real parent-portal-initiated route/shift change request. */
export const createRouteChangeRequestSchema = z.object({
  studentId: z.string().min(1),
  requestedRouteId: z.string().min(1, "Pick the new route."),
  requestedShiftId: z.string().min(1).optional(),
  requestedPickupStop: z.string().trim().max(80).optional(),
  reason: z.string().trim().max(500).optional(),
});
export type CreateRouteChangeRequestInput = z.infer<typeof createRouteChangeRequestSchema>;

export const decideRouteChangeRequestSchema = z.object({
  approve: z.boolean(),
  declineReason: z.string().trim().max(500).optional(),
});
export type DecideRouteChangeRequestInput = z.infer<typeof decideRouteChangeRequestSchema>;

/** T.8 — founder-resolved: "a school choses what they would like in their
 * system" — the real mid-term billing rule is a school-level setting,
 * never hardcoded platform-wide. */
export const TRANSPORT_MID_TERM_BILLING_RULES = ["PRORATE", "TOPUP", "NEXT_TERM_ONLY"] as const;
export const setTransportSettingsSchema = z.object({
  transportMidTermBillingRule: z.enum(TRANSPORT_MID_TERM_BILLING_RULES).optional(),
  allowParentTransportRequests: z.boolean().optional(),
});
export type SetTransportSettingsInput = z.infer<typeof setTransportSettingsSchema>;

export const transportInvoiceSchema = z.object({
  routeId: z.string().min(1),
  year: z.coerce.number().int().min(2020).max(2100),
  term: z.coerce.number().int().min(1).max(3),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type TransportInvoiceInput = z.infer<typeof transportInvoiceSchema>;
