/**
 * H.2 Customized Printing Limits.
 * GET  /api/print-limits          -> { printLimitPerDay, canManage, pending[] }
 * POST /api/print-limits {action} -> set_limit | request | decide
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  printApprovalBoard,
  setPrintLimit,
  requestPrintApproval,
  decidePrintApproval,
} from "@/lib/services/print-limits.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await printApprovalBoard(user));
  } catch (e) {
    return handleError(e);
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_limit"), perDay: z.coerce.number().int().min(0).max(1000) }),
  z.object({
    action: z.literal("request"),
    docKind: z.string().min(1).max(40),
    docRef: z.string().max(120).optional(),
    reason: z.string().max(300).optional(),
  }),
  z.object({ action: z.literal("decide"), requestId: z.string().min(1), approve: z.boolean() }),
]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
    if (body.action === "set_limit") {
      return ok(await setPrintLimit(user, body.perDay));
    }
    if (body.action === "request") {
      return ok(await requestPrintApproval(user, { docKind: body.docKind, docRef: body.docRef, reason: body.reason }));
    }
    return ok(await decidePrintApproval(user, body.requestId, body.approve));
  } catch (e) {
    return handleError(e);
  }
}
