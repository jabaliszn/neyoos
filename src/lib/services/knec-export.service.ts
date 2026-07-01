/**
 * K.16 — KNEC Document Aggregation & Export.
 *
 * A school registering candidates with KNEC needs to collect a set of required
 * documents (birth certificate, KNEC registration form, passport photo, etc.)
 * for every candidate in a class/stream, confirm who is complete, and produce a
 * single batch export to hand to KNEC.
 *
 * This service builds REAL aggregation on top of:
 *   - KnecExportBatch  (the batch definition: target class + required labels)
 *   - StudentDocument  (the per-student uploaded/approved documents from K.10)
 *
 * Flow:
 *   createBatch()    -> define batch (DRAFT) with target class + required labels
 *   aggregateBatch() -> for every student in the class, check each required label
 *                       against their StudentDocument rows; return completeness
 *   exportBatch()    -> validate (optionally require 100% complete), build a
 *                       structured manifest, store it as an encrypted artifact,
 *                       set exportUrl + status=EXPORTED.
 *
 * No AI / Bundi dependency: this is deterministic, rule-based aggregation.
 */
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { storeGeneratedArtifact } from "@/lib/services/storage.service";
import type { SessionUser } from "@/lib/core/session";

export class KnecExportError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "INCOMPLETE", message: string) {
    super(message);
    this.name = "KnecExportError";
  }
}

function parseLabels(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function listBatches(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().knecExportBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => ({ ...r, documentLabels: parseLabels(r.documentLabels) }));
  });
}

export async function createBatch(
  user: SessionUser,
  input: { name: string; targetClassId?: string | null; documentLabels: string[] }
) {
  return withTenant(user.tenantId, async () => {
    const labels = input.documentLabels.map((l) => l.trim()).filter(Boolean).slice(0, 40);
    if (labels.length === 0) throw new KnecExportError("INVALID", "At least one required document label is needed.");

    if (input.targetClassId) {
      const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.targetClassId } });
      if (!cls) throw new KnecExportError("NOT_FOUND", "Target class not found.");
    }

    const row = await tenantDb().knecExportBatch.create({
      data: {
        tenantId: user.tenantId,
        name: input.name.trim(),
        targetClassId: input.targetClassId || null,
        documentLabels: JSON.stringify(labels),
        createdById: user.id,
        createdByName: user.fullName,
      },
    });
    return { ...row, documentLabels: labels };
  });
}

/**
 * Compute completeness for the batch: for every student in the target class
 * (or all active students if no class), list which required labels are present
 * (matched case-insensitively against StudentDocument.label) and which are missing.
 */
export async function aggregateBatch(user: SessionUser, batchId: string) {
  return withTenant(user.tenantId, async () => {
    const batch = await tenantDb().knecExportBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new KnecExportError("NOT_FOUND", "Batch not found.");
    const required = parseLabels(batch.documentLabels);

    const students = await tenantDb().student.findMany({
      where: {
        ...(batch.targetClassId ? { classId: batch.targetClassId } : {}),
        status: "ACTIVE",
      },
      select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true },
      orderBy: { lastName: "asc" },
    });

    const studentIds = students.map((s) => s.id);
    const docs = studentIds.length
      ? await tenantDb().studentDocument.findMany({
          where: { studentId: { in: studentIds } },
          select: { studentId: true, label: true, fileUrl: true, fileName: true },
        })
      : [];

    const byStudent = new Map<string, { label: string; fileUrl: string; fileName: string | null }[]>();
    for (const d of docs) {
      const list = byStudent.get(d.studentId) ?? [];
      list.push({ label: d.label, fileUrl: d.fileUrl, fileName: d.fileName });
      byStudent.set(d.studentId, list);
    }

    const rows = students.map((s) => {
      const sDocs = byStudent.get(s.id) ?? [];
      const matched: Record<string, { fileUrl: string; fileName: string | null }> = {};
      const missing: string[] = [];
      for (const label of required) {
        const hit = sDocs.find((d) => d.label.trim().toLowerCase() === label.trim().toLowerCase());
        if (hit) matched[label] = { fileUrl: hit.fileUrl, fileName: hit.fileName };
        else missing.push(label);
      }
      return {
        studentId: s.id,
        admissionNo: s.admissionNo,
        name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
        complete: missing.length === 0,
        matched,
        missing,
      };
    });

    const completeCount = rows.filter((r) => r.complete).length;
    return {
      batchId: batch.id,
      name: batch.name,
      targetClassId: batch.targetClassId,
      requiredLabels: required,
      totalStudents: rows.length,
      completeStudents: completeCount,
      incompleteStudents: rows.length - completeCount,
      students: rows,
    };
  });
}

/**
 * Build the export manifest and store it. By default refuses to export if any
 * candidate is missing a required document (KNEC won't accept incomplete files);
 * pass force=true to export a partial batch for review.
 */
export async function exportBatch(user: SessionUser, batchId: string, force = false) {
  // aggregate uses its own withTenant scope
  const agg = await aggregateBatch(user, batchId);

  if (!force && agg.incompleteStudents > 0) {
    throw new KnecExportError(
      "INCOMPLETE",
      `${agg.incompleteStudents} of ${agg.totalStudents} candidates are missing required documents. Resolve or force the export.`
    );
  }

  const manifest = {
    format: "NEYO-KNEC-AGGREGATE-V1",
    generatedAt: new Date().toISOString(),
    batch: { id: agg.batchId, name: agg.name, targetClassId: agg.targetClassId },
    requiredLabels: agg.requiredLabels,
    summary: {
      totalCandidates: agg.totalStudents,
      complete: agg.completeStudents,
      incomplete: agg.incompleteStudents,
    },
    candidates: agg.students.map((s) => ({
      admissionNo: s.admissionNo,
      name: s.name,
      complete: s.complete,
      documents: agg.requiredLabels.map((label) => ({
        label,
        present: Boolean(s.matched[label]),
        fileUrl: s.matched[label]?.fileUrl ?? null,
        fileName: s.matched[label]?.fileName ?? null,
      })),
      missing: s.missing,
    })),
  };

  const buffer = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  const fileName = `knec-export-${agg.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;

  const stored = await storeGeneratedArtifact(user.tenantId, user.id, {
    buffer,
    fileName,
    contentType: "application/json",
    category: "knec-export",
  });

  const updated = await withTenant(user.tenantId, async () =>
    tenantDb().knecExportBatch.update({
      where: { id: batchId },
      data: { status: "EXPORTED", exportUrl: stored.url },
    })
  );

  return {
    ...updated,
    documentLabels: parseLabels(updated.documentLabels),
    exportUrl: stored.url,
    storedFileId: stored.id,
    manifestSummary: manifest.summary,
  };
}
