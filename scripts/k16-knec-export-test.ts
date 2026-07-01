/**
 * K.16 full-stack test — KNEC Document Aggregation & Export.
 *
 * Proves the REAL workflow end-to-end against the live SQLite DB:
 *  1. Create a batch targeting a class with required document labels.
 *  2. Aggregate: students missing labels are flagged incomplete.
 *  3. Export is BLOCKED while candidates are incomplete (INCOMPLETE 409).
 *  4. Add the missing StudentDocuments -> aggregate now shows complete.
 *  5. Export succeeds -> a real encrypted manifest artifact is stored,
 *     exportUrl is set, batch status flips to EXPORTED, and the manifest
 *     content lists every candidate with their document URLs.
 *
 * Cleans up everything it creates.
 */
import { PrismaClient } from "@prisma/client";
import {
  createBatch,
  aggregateBatch,
  exportBatch,
  KnecExportError,
} from "../src/lib/services/knec-export.service";
import { readObject } from "../src/lib/services/storage.service";

const db = new PrismaClient();

function su(u: any, tenantId: string) {
  return {
    id: u.id, tenantId, neyoLoginId: u.neyoLoginId ?? u.id, fullName: u.fullName,
    phone: u.phone ?? null, email: u.email ?? null, role: u.role, secondaryRole: u.secondaryRole ?? null,
    language: u.language ?? "en",
  } as any;
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; console.log(`  \u2717 ${name}`); }
}

async function main() {
  const t = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!t) throw new Error("tenant not found");
  const tid = t.id;

  const principalU = await db.user.findFirst({ where: { tenantId: tid, role: "PRINCIPAL" } });
  if (!principalU) throw new Error("principal not found");
  const principal = su(principalU, tid);

  // Pick a class with students.
  const cls = await db.schoolClass.findFirst({
    where: { tenantId: tid, students: { some: { status: "ACTIVE" } } },
  });
  if (!cls) throw new Error("no class with active students");
  const students = await db.student.findMany({ where: { tenantId: tid, classId: cls.id, status: "ACTIVE" }, take: 3 });
  if (students.length < 1) throw new Error("no students in class");

  const REQUIRED = ["Birth Certificate", "KNEC Registration Form"];

  console.log(`K.16 — KNEC aggregation for ${cls.level} ${cls.stream ?? ""} (${students.length} candidates)\n`);

  const createdDocIds: string[] = [];
  let batchId = "";
  let storedKey: string | null = null;

  try {
    // 1) Create batch
    const batch = await createBatch(principal, { name: "TEST KNEC Batch", targetClassId: cls.id, documentLabels: REQUIRED });
    batchId = batch.id;
    check("Batch created with required labels", batch.documentLabels.length === 2 && batch.status === "DRAFT");

    // 2) Aggregate before any docs -> all incomplete
    const agg1 = await aggregateBatch(principal, batchId);
    check("Aggregation lists all candidates in the class", agg1.totalStudents === students.length);
    check("All candidates incomplete before uploads", agg1.completeStudents === 0 && agg1.incompleteStudents === students.length);

    // 3) Export blocked while incomplete
    let blocked = false;
    try { await exportBatch(principal, batchId, false); }
    catch (e) { blocked = e instanceof KnecExportError && e.code === "INCOMPLETE"; }
    check("Export blocked while candidates are incomplete", blocked);

    // 4) Add the required documents for every candidate
    for (const s of students) {
      for (const label of REQUIRED) {
        const d = await db.studentDocument.create({
          data: {
            tenantId: tid, studentId: s.id, label,
            fileUrl: `https://files.neyo.test/k16/${s.id}-${label.replace(/\s+/g, "_")}.pdf`,
            fileName: `${label}.pdf`,
          },
        });
        createdDocIds.push(d.id);
      }
    }
    const agg2 = await aggregateBatch(principal, batchId);
    check("All candidates complete after uploads", agg2.completeStudents === students.length && agg2.incompleteStudents === 0);

    // 5) Export succeeds
    const exported = await exportBatch(principal, batchId, false);
    check("Batch status flips to EXPORTED", exported.status === "EXPORTED");
    check("Export produced a manifest URL", !!exported.exportUrl);

    // Read the stored manifest back and verify content.
    const stored = await db.storedFile.findUnique({ where: { id: exported.storedFileId } });
    storedKey = stored?.key ?? null;
    const obj = await readObject(stored!.key);
    const manifest = JSON.parse(obj.body.toString("utf8"));
    check("Manifest is NEYO-KNEC-AGGREGATE-V1", manifest.format === "NEYO-KNEC-AGGREGATE-V1");
    check("Manifest lists every candidate", Array.isArray(manifest.candidates) && manifest.candidates.length === students.length);
    const everyDocPresent = manifest.candidates.every((c: any) => c.documents.every((d: any) => d.present && d.fileUrl));
    check("Every candidate has all required document URLs in the manifest", everyDocPresent);
  } finally {
    // cleanup
    if (batchId) await db.knecExportBatch.delete({ where: { id: batchId } }).catch(() => {});
    for (const id of createdDocIds) await db.studentDocument.delete({ where: { id } }).catch(() => {});
    if (storedKey) {
      const f = await db.storedFile.findUnique({ where: { key: storedKey } }).catch(() => null);
      if (f) await db.storedFile.delete({ where: { id: f.id } }).catch(() => {});
    }
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log("  \u2705 K.16 all green");
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
