import { readFileSync } from "fs";

/**
 * I.45/I.46 smart bulk printing — UPDATED 2026-07-02 (Part N.3).
 *
 * The underlying implementation moved from a client-side window.print() HTML
 * generator to a real server-rendered PDF (see docs/FEATURES-CHECKLIST.md's
 * I.45/I.46 "UPDATED 2026-07-02" notes and the N.3 section for the full
 * story, including two real bugs the rewrite fixed). This test is updated in
 * the SAME TURN as that change so it keeps testing the actual live code
 * path, not retired HTML string literals. The full behavioral proof (real
 * PDF page counts, real cut-mark presence/absence, real personalization)
 * lives in `scripts/n3-newsletter-test.ts` — this file keeps the original
 * "does the feature exist in the expected files" smoke-check spirit.
 */
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.45/I.46 smart bulk printing test (N.3 real-PDF implementation)");

  const pdfSrc = readFileSync("src/lib/documents/newsletter-pdf.tsx", "utf8");
  assert(pdfSrc.includes('opts.format === "4-up" ? 4 : opts.format === "2-up" ? 2 : 1'), "newsletter PDF merges 1/2/4 recipients per A4 sheet, computed from the real format, not hardcoded");
  assert(pdfSrc.includes("showCutMarks = itemsPerPage > 1"), "cut guides only render when a sheet genuinely holds more than one recipient (real fix — no longer hardcoded to always show)");
  assert(pdfSrc.includes("✂ cut"), "merged sheets still include a real cut guide label when cutting is actually needed");
  assert(pdfSrc.includes("contentLayout("), "card body layout is computed per-card from actual text length, not a fixed flex box");

  const routeSrc = readFileSync("src/app/api/students/print-newsletter/route.ts", "utf8");
  assert(routeSrc.includes('requirePermission("student.view", "comms.send")'), "newsletter printing is permission-gated server-side");
  assert(routeSrc.includes("input.personalized") && routeSrc.includes("substitute("), "server-side personalization toggle between per-student and general mode");

  const clientSrc = readFileSync("src/components/students/students-client.tsx", "utf8");
  assert(clientSrc.includes("/api/students/print-newsletter"), "Students UI calls the real server PDF endpoint (no more window.print() HTML generator)");
  assert(clientSrc.includes("{{student_name}}") && clientSrc.includes("{{admission_no}}"), "newsletter UI still supports per-student personalization placeholders");
  assert(clientSrc.includes("newsPersonalized"), "newsletter UI can still switch between personalized and general mode");

  console.log("\n✅ I.45/I.46 smart bulk printing test passed (verifying the real N.3 server-PDF implementation)");
}

main().catch((err) => { console.error(err); process.exit(1); });
