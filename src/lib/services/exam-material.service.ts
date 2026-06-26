import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class ExamMaterialError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID", message: string) {
    super(message);
    this.name = "ExamMaterialError";
  }
}

export const EXAM_MATERIAL_TYPES = ["APPLICATION", "MATERIALS", "KNEC_REGISTRATION", "CENTER_LOGISTICS", "OTHER"] as const;
export const EXAM_MATERIAL_STATUSES = ["PLANNED", "ASSEMBLING", "READY", "SUBMITTED", "COLLECTED"] as const;

function parseChecklist(value?: string | string[] | null) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((x) => x.trim()).filter(Boolean).slice(0, 40);
  return value.split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean).slice(0, 40);
}

function safeJson(value: string | null) {
  if (!value) return [] as string[];
  try { return JSON.parse(value) as string[]; } catch { return []; }
}

async function audit(user: SessionUser, action: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action,
      entityType: "examMaterialRecord",
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

export async function listExamMaterialRecords(user: SessionUser, q?: { status?: string }) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().examMaterialRecord.findMany({
      where: q?.status ? { status: q.status } : {},
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return rows.map((r) => ({ ...r, checklist: safeJson(r.checklistJson) }));
  });
}

export async function createExamMaterialRecord(user: SessionUser, input: {
  examName: string;
  materialType: string;
  title: string;
  examDate?: string | null;
  deadline?: string | null;
  status?: string;
  checklist?: string | string[];
  hardcopyLocation: string;
  fileUrl?: string | null;
  fileName?: string | null;
  notes?: string | null;
}) {
  return withTenant(user.tenantId, async () => {
    const materialType = EXAM_MATERIAL_TYPES.includes(input.materialType as any) ? input.materialType : "OTHER";
    const status = input.status && EXAM_MATERIAL_STATUSES.includes(input.status as any) ? input.status : "PLANNED";
    const checklist = parseChecklist(input.checklist);
    const row = await db.examMaterialRecord.create({
      data: {
        tenantId: user.tenantId,
        examName: input.examName.trim(),
        materialType,
        title: input.title.trim(),
        examDate: input.examDate || null,
        deadline: input.deadline || null,
        status,
        checklistJson: checklist.length ? JSON.stringify(checklist) : null,
        hardcopyLocation: input.hardcopyLocation.trim(),
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
        notes: input.notes?.trim() || null,
        createdById: user.id,
        createdByName: user.fullName,
      },
    });
    await audit(user, "exam.material_record_created", row.id, { examName: row.examName, materialType, status });
    return { ...row, checklist };
  });
}

export async function updateExamMaterialStatus(user: SessionUser, id: string, status: string) {
  return withTenant(user.tenantId, async () => {
    if (!EXAM_MATERIAL_STATUSES.includes(status as any)) throw new ExamMaterialError("INVALID", "Invalid exam material status.");
    const found = await tenantDb().examMaterialRecord.findUnique({ where: { id } });
    if (!found) throw new ExamMaterialError("NOT_FOUND", "Exam material record not found.");
    const row = await tenantDb().examMaterialRecord.update({ where: { id }, data: { status } });
    await audit(user, "exam.material_record_status_updated", id, { from: found.status, to: status });
    return { ...row, checklist: safeJson(row.checklistJson) };
  });
}
