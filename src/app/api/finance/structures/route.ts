/**
 * B.7 fee structures. GET (finance.view) · POST create (finance.manage_structure)
 * · POST {batch:true, structureId, dueDate} -> auto-batch invoice the level.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { feeStructureSchema, batchInvoiceSchema } from "@/lib/validations/finance";
import { listStructures, createStructure, batchInvoice } from "@/lib/services/finance.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("finance.view");
    return ok({ structures: await listStructures(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.batch) {
      const user = await requirePermission("finance.create_invoice");
      const { structureId, dueDate } = batchInvoiceSchema.parse(body);
      return ok(await batchInvoice(user, structureId, dueDate));
    }
    const user = await requirePermission("finance.manage_structure");
    return ok(await createStructure(user, feeStructureSchema.parse(body)));
  } catch (e) {
    return handleError(e);
  }
}
