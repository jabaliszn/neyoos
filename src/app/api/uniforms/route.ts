/**
 * G.24 Uniform catalogue API — shared: families (portal.parent) browse +
 * order for their own children; staff (inventory.manage) see all + deliver.
 * GET  /api/uniforms                — catalogue + my orders (family) / all orders (staff)
 * POST /api/uniforms {action:"order", itemId, studentId, qty, size?}
 * POST /api/uniforms {action:"delivered", orderId}   (staff only)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { ok, handleError, fail } from "@/lib/api/respond";
import { catalogue, placeOrder, listOrders, markDelivered, setSizeStock, sizeBoard } from "@/lib/services/uniform.service";

export const dynamic = "force-dynamic";

function familyOrStaff(role: Role): "family" | "staff" | null {
  if (can(role, "inventory.manage")) return "staff";
  if (can(role, "portal.parent")) return "family";
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const kind = familyOrStaff(user.role as Role);
    if (!kind) return fail("FORBIDDEN", "No access to the uniform catalogue.", 403);
    const [items, orders, sizes] = await Promise.all([
      catalogue(user),
      listOrders(user, kind === "family"),
      sizeBoard(user), // B.25: per-size availability (families see what fits)
    ]);
    return ok({ items, orders, sizes, staff: kind === "staff" });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const kind = familyOrStaff(user.role as Role);
    if (!kind) return fail("FORBIDDEN", "No access to the uniform catalogue.", 403);
    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["order", "delivered", "sizeStock"]) }).parse(body).action;
    if (action === "sizeStock") {
      // B.25: staff set the count held per size (S/M/L/Size 30…).
      if (kind !== "staff") return fail("FORBIDDEN", "Only staff manage size stock.", 403);
      const input = z.object({
        itemId: z.string().min(1),
        size: z.string().trim().min(1).max(20),
        qty: z.coerce.number().int().min(0).max(10000),
      }).parse(body);
      return ok(await setSizeStock(user, input));
    }
    if (action === "order") {
      const input = z.object({
        itemId: z.string().min(1),
        studentId: z.string().min(1),
        qty: z.coerce.number().int().min(1).max(20),
        size: z.string().trim().max(40).optional(),
      }).parse(body);
      return ok(await placeOrder(user, input), 201);
    }
    if (kind !== "staff") return fail("FORBIDDEN", "Only staff mark deliveries.", 403);
    const { orderId } = z.object({ orderId: z.string().min(1) }).parse(body);
    return ok(await markDelivered(user, orderId));
  } catch (e) {
    return handleError(e);
  }
}
