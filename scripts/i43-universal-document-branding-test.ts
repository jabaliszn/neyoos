import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const docFiles = [
    "admission-letter-pdf.tsx",
    "cbc-report-pdf.tsx",
    "invoice-pdf.tsx",
    "mwalimu-pack-pdf.tsx",
    "mzazi-card-pdf.tsx",
    "payslip-pdf.tsx",
    "receipt-pdf.tsx",
    "report-card-pdf.tsx",
    "student-id-pdf.tsx",
    "transcript-pdf.tsx",
    "transfer-letter-pdf.tsx",
  ];
  for (const file of docFiles) {
    const source = readFileSync(join(process.cwd(), "src/lib/documents", file), "utf8");
    assert(source.includes("Powered by NEYO"), `${file} includes Powered by NEYO trademark`);
  }
  for (const file of ["admission-letter-pdf.tsx", "cbc-report-pdf.tsx", "invoice-pdf.tsx", "payslip-pdf.tsx", "receipt-pdf.tsx", "report-card-pdf.tsx", "student-id-pdf.tsx", "transcript-pdf.tsx", "transfer-letter-pdf.tsx"]) {
    const source = readFileSync(join(process.cwd(), "src/lib/documents", file), "utf8");
    assert(/logo(DataUrl|Url)?/.test(source) && source.includes("<Image"), `${file} supports school logo rendering`);
  }
  const documentService = readFileSync(join(process.cwd(), "src/lib/services/document.service.ts"), "utf8");
  const admissionService = readFileSync(join(process.cwd(), "src/lib/services/admission.service.ts"), "utf8");
  const payslipRoute = readFileSync(join(process.cwd(), "src/app/api/payroll/payslip/[id]/route.ts"), "utf8");
  const timetableUi = readFileSync(join(process.cwd(), "src/components/academics/academics-client.tsx"), "utf8");
  assert(documentService.includes("logoUrl: tenant.logoUrl") || documentService.includes("logoDataUrl"), "document service passes school logo data into generated documents");
  assert(admissionService.includes("logoUrl: tenant.logoUrl"), "admission letters receive the school logo");
  assert(payslipRoute.includes("logoUrl: tenant.logoUrl"), "payslips receive the school logo");
  assert(timetableUi.includes("tenantLogoUrl") && timetableUi.includes("h-6 w-6 object-contain"), "A4 timetable print pack uses a small logo so it does not consume space");
  console.log("\nI.43 Universal Document Branding test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
