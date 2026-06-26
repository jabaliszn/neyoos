import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { createExamMaterialRecord, listExamMaterialRecords, updateExamMaterialStatus } from "@/lib/services/exam-material.service";

export const dynamic = "force-dynamic";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));

const createSchema = z.object({
  action: z.literal("create"),
  examName: z.string().trim().min(2).max(120),
  materialType: z.enum(["APPLICATION", "MATERIALS", "KNEC_REGISTRATION", "CENTER_LOGISTICS", "OTHER"]),
  title: z.string().trim().min(2).max(160),
  examDate: dateYmd,
  deadline: dateYmd,
  status: z.enum(["PLANNED", "ASSEMBLING", "READY", "SUBMITTED", "COLLECTED"]).default("PLANNED"),
  checklist: z.union([z.string().max(2000), z.array(z.string().max(120)).max(40)]).optional(),
  hardcopyLocation: z.string().trim().min(3, "State the physical file/material location.").max(160),
  fileUrl: z.string().trim().max(500).optional(),
  fileName: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const statusSchema = z.object({
  action: z.literal("status"),
  id: z.string().min(1),
  status: z.enum(["PLANNED", "ASSEMBLING", "READY", "SUBMITTED", "COLLECTED"]),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("exam.view");
    return ok({ records: await listExamMaterialRecords(user, { status: req.nextUrl.searchParams.get("status") ?? undefined }) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("exam.manage");
    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["create", "status"]) }).parse(body).action;
    if (action === "status") {
      const input = statusSchema.parse(body);
      return ok(await updateExamMaterialStatus(user, input.id, input.status));
    }
    const input = createSchema.parse(body);
    return ok(await createExamMaterialRecord(user, input), 201);
  } catch (error) {
    return handleError(error);
  }
}
