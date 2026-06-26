/**
 * B.25 Supplier Management API (suppliers are stores territory).
 * GET  /api/suppliers — directory w/ contract expiry flags (inventory.view)
 * POST /api/suppliers {action: add|rate|archive|contract} (inventory.manage)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  createSupplier, rateSupplier, archiveSupplier, addContract, supplierDirectory,
  SUPPLIER_CATEGORIES,
} from "@/lib/services/supplier.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("inventory.view");
    return ok({ suppliers: await supplierDirectory(user), categories: SUPPLIER_CATEGORIES });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("inventory.manage");
    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["add", "rate", "archive", "contract"]) }).parse(body).action;

    if (action === "add") {
      const input = z.object({
        name: z.string().trim().min(2).max(80),
        category: z.enum(SUPPLIER_CATEGORIES),
        phone: z.string().trim().max(20).optional(),
        email: z.string().trim().email().max(120).optional().or(z.literal("")),
        contact: z.string().trim().max(80).optional(),
        kraPin: z.string().trim().max(20).optional(),
        notes: z.string().trim().max(300).optional(),
      }).parse(body);
      return ok(await createSupplier(user, { ...input, email: input.email || undefined }), 201);
    }
    if (action === "rate") {
      const { supplierId, rating } = z.object({ supplierId: z.string().min(1), rating: z.coerce.number().int().min(1).max(5) }).parse(body);
      return ok(await rateSupplier(user, supplierId, rating));
    }
    if (action === "archive") {
      const { supplierId } = z.object({ supplierId: z.string().min(1) }).parse(body);
      return ok(await archiveSupplier(user, supplierId));
    }
    const input = z.object({
      supplierId: z.string().min(1),
      title: z.string().trim().min(3).max(120),
      startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      valueKes: z.coerce.number().int().min(0),
      note: z.string().trim().max(300).optional(),
    }).parse(body);
    return ok(await addContract(user, input), 201);
  } catch (e) {
    return handleError(e);
  }
}
