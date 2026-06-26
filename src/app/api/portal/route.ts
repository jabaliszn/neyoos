/**
 * B.10 Parent Portal API.
 * GET  ?view=children | ?view=child&id=
 * POST {action:"stk", invoiceId, phone, amountKes?} — pay own child's fees.
 * Permission: portal.parent (PARENT role; leadership also passes via SUPER).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { kePhone } from "@/lib/validations/reception";
import { myChildren, childDetail, parentStk } from "@/lib/services/parent-portal.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const sp = req.nextUrl.searchParams;
    if (sp.get("view") === "child") {
      const id = sp.get("id");
      if (!id) return fail("MISSING", "id required.", 400);
      return ok(await childDetail(user, id));
    }
    return ok({ children: await myChildren(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("portal.parent");
    const input = z.object({
      action: z.literal("stk"),
      invoiceId: z.string().min(1),
      phone: kePhone,
      amountKes: z.coerce.number().int().min(1).optional(),
    }).parse(await req.json());
    return ok(await parentStk(user, input.invoiceId, input.phone, input.amountKes));
  } catch (e) {
    return handleError(e);
  }
}
