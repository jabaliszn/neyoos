import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import type { EntranceExamPaperInput } from "@/lib/validations/entrance-exam";

export class EntranceExamPaperError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "EntranceExamPaperError";
  }
}

function classLabel(cls: { level: string; stream: string | null }) {
  return [cls.level, cls.stream].filter(Boolean).join(" ");
}

async function audit(user: SessionUser, action: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action,
      entityType: "entranceExamPaper",
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

export async function listEntranceExamPapers(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().entranceExamPaper.findMany({
      orderBy: [{ classLabel: "asc" }, { createdAt: "desc" }],
    });
  });
}

export async function saveEntranceExamPaper(user: SessionUser, input: EntranceExamPaperInput) {
  return withTenant(user.tenantId, async () => {
    const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.classId } });
    if (!cls || cls.archived) {
      throw new EntranceExamPaperError("NOT_FOUND", "Class not found. Create the class first, then upload its entrance paper.");
    }

    const label = classLabel(cls);
    const row = await db.entranceExamPaper.upsert({
      where: { tenantId_classId: { tenantId: user.tenantId, classId: cls.id } },
      create: {
        tenantId: user.tenantId,
        classId: cls.id,
        classLevel: cls.level,
        classLabel: label,
        title: input.title,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        hardcopyLocation: input.hardcopyLocation,
        uploadedById: user.id,
        uploadedBy: user.fullName,
      },
      update: {
        classLevel: cls.level,
        classLabel: label,
        title: input.title,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        hardcopyLocation: input.hardcopyLocation,
        uploadedById: user.id,
        uploadedBy: user.fullName,
      },
    });

    await audit(user, "admissions.entrance_exam_vaulted", row.id, {
      classId: cls.id,
      classLabel: label,
      title: input.title,
      fileName: input.fileName,
      hardcopyLocation: input.hardcopyLocation,
    });

    return row;
  });
}

export async function markEntranceExamPaperPrinted(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const paper = await tenantDb().entranceExamPaper.findUnique({ where: { id } });
    if (!paper) throw new EntranceExamPaperError("NOT_FOUND", "Entrance exam paper not found.");

    const updated = await db.entranceExamPaper.update({
      where: { id: paper.id },
      data: {
        printCount: { increment: 1 },
        lastPrintedAt: new Date(),
      },
    });

    await audit(user, "admissions.entrance_exam_printed", paper.id, {
      classId: paper.classId,
      classLabel: paper.classLabel,
      title: paper.title,
      printCount: updated.printCount,
    });

    return updated;
  });
}
