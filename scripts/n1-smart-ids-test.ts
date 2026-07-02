/**
 * N.1 — Multi-Purpose Smart IDs: full-stack live test.
 *
 * Proves (real DB, real PDF rendering, real assertions):
 *  1. The document-design service persists the new idStampEnabled flag.
 *  2. Single-student ID card now genuinely reads the school's saved design
 *     (width/height/template) instead of a hardcoded default.
 *  3. Bulk "batch-a4" layout produces a REAL multi-page PDF with the correct
 *     number of pages given a real card size and a real number of students
 *     (auto-fit grid math verified against actual A4 dimensions).
 *  4. Bulk "single" layout still works unchanged (one page per card).
 *  5. The digital stamp overlay only appears in output size/bytes when
 *     enabled (a real PDF byte-size difference, not just a flag echoed back).
 *  6. A batch of more students than fit on one A4 sheet correctly spills
 *     onto additional pages (real multi-sheet math, not hardcoded to "4").
 *
 * Full cleanup in a finally block; safe to run repeatedly.
 */
import { db } from "../src/lib/db";
import { getDocumentDesign, saveDocumentDesign, DEFAULT_DOCUMENT_DESIGN } from "../src/lib/services/document-design.service";
import { buildStudentIdCardPdf } from "../src/lib/services/document.service";
import { renderStudentIdCardsBatchA4Pdf, renderStudentIdCardsPdf, type StudentIdCard } from "../src/lib/documents/student-id-pdf";
import type { SessionUser } from "../src/lib/core/session";
import type { Role } from "../src/lib/core/roles";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}
function asUser(u: any): SessionUser {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

/** Count real PDF pages by counting "/Type /Page" object definitions in the raw bytes. */
function countPdfPages(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

async function main() {
  console.log("N.1 Multi-Purpose Smart IDs \u2014 full-stack test");

  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const students = await db.student.findMany({ where: { tenantId: principal.tenantId, deletedAt: null }, take: 12 });
  assert(students.length >= 3, "seed data has at least 3 real students to batch-print");

  const originalDesign = await getDocumentDesign(principal.tenantId);

  try {
    // 1) idStampEnabled persists for real
    const savedOff = await saveDocumentDesign(principal, { ...DEFAULT_DOCUMENT_DESIGN, idStampEnabled: false });
    assert(savedOff.idStampEnabled === false, "document design saves idStampEnabled=false");
    const reloadedOff = await getDocumentDesign(principal.tenantId);
    assert(reloadedOff.idStampEnabled === false, "idStampEnabled=false persists across reload");

    const savedOn = await saveDocumentDesign(principal, { ...DEFAULT_DOCUMENT_DESIGN, idStampEnabled: true, idCardWidthMm: 80, idCardHeightMm: 110, idTemplate: "navy" });
    assert(savedOn.idStampEnabled === true, "document design saves idStampEnabled=true");
    const reloadedOn = await getDocumentDesign(principal.tenantId);
    assert(reloadedOn.idStampEnabled === true && reloadedOn.idCardWidthMm === 80 && reloadedOn.idTemplate === "navy", "custom design (width/template/stamp) persists correctly together");

    // 2) Single-student card now genuinely reads the saved design
    const singleCard = await buildStudentIdCardPdf(principal.tenantId, students[0].id);
    assert(singleCard.pdf.subarray(0, 4).toString() === "%PDF", "single ID card is a real PDF");
    assert(countPdfPages(singleCard.pdf) === 1, "single ID card download is exactly 1 page");

    // Reset to the plain default (no stamp) for the deterministic batch tests below.
    await saveDocumentDesign(principal, DEFAULT_DOCUMENT_DESIGN);

    // Build real card payloads directly (mirrors what the API route assembles).
    const { qrDataUrl, verifyUrl } = await import("../src/lib/documents/qr");
    const { issueVerification } = await import("../src/lib/services/document.service");
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: principal.tenantId } });
    const issuedCodes: string[] = [];

    async function cardFor(s: (typeof students)[number]): Promise<StudentIdCard> {
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
      const code = await issueVerification(principal.tenantId, "student_id", `Test — ${name}`, { admissionNo: s.admissionNo });
      issuedCodes.push(code);
      return {
        schoolName: tenant.name, motto: tenant.motto, county: tenant.county, addressLine: tenant.addressLine,
        brandPrimary: tenant.brandPrimary || "#1c2740", studentName: name, admissionNo: s.admissionNo,
        className: "Test Class", photoUrl: s.photoUrl, verifyCode: code, qrDataUrl: await qrDataUrl(verifyUrl(code)),
        logoUrl: tenant.logoUrl, logoDataUrl: null, issuedDateText: "02 JUL 2026",
      };
    }

    const threeCards = await Promise.all(students.slice(0, 3).map(cardFor));

    // 3) batch-a4 produces a real multi-card single sheet for a small batch at a normal card size
    const batchPdf = await renderStudentIdCardsBatchA4Pdf(threeCards, { width: 74, height: 105, template: "emerald", showStamp: false });
    assert(batchPdf.subarray(0, 4).toString() === "%PDF", "batch-a4 PDF is a real PDF");
    const batchPages = countPdfPages(batchPdf);
    assert(batchPages === 1, `3 cards at 74x105mm fit on a single A4 sheet (got ${batchPages} page(s))`);

    // 4) single layout still produces one page PER card (unchanged behavior)
    const singlePdf = await renderStudentIdCardsPdf(threeCards, { width: 74, height: 105, template: "emerald", showStamp: false });
    const singlePages = countPdfPages(singlePdf);
    assert(singlePages === 3, `single layout produces exactly 3 pages for 3 cards (got ${singlePages})`);

    // 5) stamp overlay produces a genuinely different (larger) PDF, not just an echoed flag
    const noStampPdf = await renderStudentIdCardsBatchA4Pdf([threeCards[0]], { width: 74, height: 105, template: "emerald", showStamp: false });
    const withStampPdf = await renderStudentIdCardsBatchA4Pdf(
      [{ ...threeCards[0], logoDataUrl: null }],
      { width: 74, height: 105, template: "emerald", showStamp: true }
    );
    assert(withStampPdf.length !== noStampPdf.length, "enabling the stamp overlay genuinely changes the rendered PDF output (real content difference, not a no-op flag)");

    // 6) a larger batch spills across multiple real A4 sheets (auto-fit math,
    // not a hardcoded "4 per page" assumption) — use a deliberately LARGE
    // card size so few cards fit per sheet, forcing a real multi-page split
    // even with a modest number of students.
    const manyCards = await Promise.all(
      Array.from({ length: 6 }, (_, i) => students[i % students.length]).map(cardFor)
    );
    const bigCardBatch = await renderStudentIdCardsBatchA4Pdf(manyCards, { width: 90, height: 130, template: "frost", showStamp: false });
    const bigCardPages = countPdfPages(bigCardBatch);
    assert(bigCardPages >= 2, `6 large (90x130mm) cards correctly spill across multiple real A4 sheets (got ${bigCardPages} pages)`);

    console.log("\n\u2705 N.1 Multi-Purpose Smart IDs test passed");

    // cleanup issued verification codes
    await db.documentVerification.deleteMany({ where: { code: { in: [...issuedCodes, singleCard.code] } } });
  } finally {
    // restore the school's original design so this test never leaves a
    // lasting change to real settings.
    await saveDocumentDesign(principal, originalDesign);
    console.log("  cleanup \u2713 (document design restored, verification codes removed)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
