/**
 * B.25 Procurement API.
 * GET  /api/procurement — board (inventory.view)
 * POST /api/procurement {action: request|quote|order|approve|send|deliver|match|cancel}
 *   - approve = LEADERSHIP ONLY (tenant.manage_settings) — the threshold gate.
 *   - everything else = inventory.manage (bursar territory).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  createRequest, addQuote, createOrderFromQuote, approveOrder,
  markSent, recordDelivery, threeWayMatch, cancelOrder, procurementBoard,
} from "@/lib/services/procurement.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("inventory.view");
    return ok(await procurementBoard(user));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = z.object({
      action: z.enum(["request", "quote", "order", "approve", "send", "deliver", "match", "cancel"]),
    }).parse(body).action;

    // Approval is the leadership gate — separate permission from the rest.
    if (action === "approve") {
      const user = await requirePermission("tenant.manage_settings");
      const { poId } = z.object({ poId: z.string().min(1) }).parse(body);
      return ok(await approveOrder(user, poId));
    }

    const user = await requirePermission("inventory.manage");
    if (action === "request") {
      const input = z.object({
        title: z.string().trim().min(3).max(120),
        details: z.string().trim().max(500).optional(),
        neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }).parse(body);
      return ok(await createRequest(user, input), 201);
    }
    if (action === "quote") {
      const input = z.object({
        requestId: z.string().min(1),
        supplierId: z.string().min(1),
        amountKes: z.coerce.number().int().min(1),
        note: z.string().trim().max(200).optional(),
      }).parse(body);
      return ok(await addQuote(user, input), 201);
    }
    if (action === "order") {
      const { quoteId } = z.object({ quoteId: z.string().min(1) }).parse(body);
      return ok(await createOrderFromQuote(user, quoteId), 201);
    }
    if (action === "send") {
      const { poId } = z.object({ poId: z.string().min(1) }).parse(body);
      return ok(await markSent(user, poId));
    }
    if (action === "deliver") {
      const input = z.object({
        poId: z.string().min(1),
        deliveredValueKes: z.coerce.number().int().min(0),
        note: z.string().trim().max(300).optional(),
      }).parse(body);
      return ok(await recordDelivery(user, input));
    }
    if (action === "match") {
      const input = z.object({
        poId: z.string().min(1),
        supplierInvoiceNo: z.string().trim().min(1).max(60),
        supplierInvoiceKes: z.coerce.number().int().min(1),
      }).parse(body);
      return ok(await threeWayMatch(user, input));
    }
    const { poId } = z.object({ poId: z.string().min(1) }).parse(body);
    return ok(await cancelOrder(user, poId));
  } catch (e) {
    return handleError(e);
  }
}
