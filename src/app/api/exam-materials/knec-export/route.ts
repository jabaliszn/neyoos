import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import {
  listBatches,
  createBatch,
  aggregateBatch,
  exportBatch,
  KnecExportError,
} from "@/lib/services/knec-export.service";

export const dynamic = "force-dynamic";

/**
 * K.16 — KNEC document aggregation/export.
 *
 * GET  ?batchId=...        → aggregate completeness report for one batch.
 * GET                      → list batches.
 * POST { action:"create" } → create a batch (target class + required labels).
 * POST { action:"export" } → build + store the export manifest, mark EXPORTED.
 */

const createSchema = z.object({
  action: z.literal("create"),
  name: z.string().trim().min(2).max(120),
  targetClassId: z.string().trim().optional().nullable(),
  documentLabels: z.array(z.string().trim().min(1).max(120)).min(1).max(40),
});

const exportSchema = z.object({
  action: z.literal("export"),
  batchId: z.string().min(1),
  force: z.boolean().optional().default(false),
});

function mapErr(error: unknown) {
  if (error instanceof KnecExportError) {
    const statusMap = { NOT_FOUND: 404, INVALID: 400, INCOMPLETE: 409 } as const;
    return fail(error.code, error.message, statusMap[error.code]);
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("exam.view");
    const batchId = req.nextUrl.searchParams.get("batchId");
    if (batchId) {
      return ok({ report: await aggregateBatch(user, batchId) });
    }
    return ok({ batches: await listBatches(user) });
  } catch (error) {
    return mapErr(error) ?? handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("exam.manage");
    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["create", "export"]) }).parse(body).action;
    if (action === "create") {
      const input = createSchema.parse(body);
      return ok(await createBatch(user, input), 201);
    }
    const input = exportSchema.parse(body);
    return ok(await exportBatch(user, input.batchId, input.force));
  } catch (error) {
    if ((error as any).name === "ZodError") return fail("INVALID", (error as any).errors[0].message, 400);
    return mapErr(error) ?? handleError(error);
  }
}
