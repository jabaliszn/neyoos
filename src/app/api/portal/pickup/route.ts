/**
 * I.4 Parent-initiated safe pickup self-service.
 * Parents manage permanent pickup people and one-time alternate pickup codes for
 * their own children only. Gate verification remains in /api/security.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { normalizeKePhone } from "@/lib/validations/auth";
import {
  parentPickupBoard,
  parentAddPickupPerson,
  parentRemovePickupPerson,
  parentCreateAltPickup,
  parentCancelAltPickup,
} from "@/lib/services/parent-portal.service";

export const dynamic = "force-dynamic";

const phoneSchema = z.string().trim().min(7).max(20).transform((value, ctx) => {
  const phone = normalizeKePhone(value);
  if (!phone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use a valid Kenyan phone number." });
    return z.NEVER;
  }
  return phone;
});

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const studentId = req.nextUrl.searchParams.get("studentId") || "";
    return ok(await parentPickupBoard(user, studentId));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const body = await req.json().catch(() => ({}));
    const { action } = z.object({ action: z.enum(["addPickup", "removePickup", "createAltPickup", "cancelAltPickup"]) }).parse(body);

    if (action === "addPickup") {
      const input = z.object({
        studentId: z.string().min(1),
        fullName: z.string().trim().min(3).max(100),
        relationship: z.string().trim().min(2).max(60),
        phone: phoneSchema,
        nationalId: z.string().trim().min(4).max(20),
      }).parse(body);
      return ok(await parentAddPickupPerson(user, input), 201);
    }

    if (action === "removePickup") {
      const { personId } = z.object({ personId: z.string().min(1) }).parse(body);
      return ok(await parentRemovePickupPerson(user, personId));
    }

    if (action === "createAltPickup") {
      const input = z.object({
        studentId: z.string().min(1),
        pickerName: z.string().trim().min(3).max(100),
        pickerPhone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
        relationship: z.string().trim().max(60).optional().or(z.literal("").transform(() => undefined)),
        screenshotUrl: z.string().trim().max(500).optional(),
        screenshotName: z.string().trim().max(200).optional(),
        validHours: z.coerce.number().int().min(1).max(72).optional(),
      }).parse(body);
      return ok(await parentCreateAltPickup(user, input), 201);
    }

    const { id } = z.object({ id: z.string().min(1) }).parse(body);
    return ok(await parentCancelAltPickup(user, id));
  } catch (e) {
    return handleError(e);
  }
}
