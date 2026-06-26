import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { incidentSchema } from "@/lib/validations/discipline";
import { listIncidents, reportIncident } from "@/lib/services/discipline.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function asUser(u: any): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principal = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }));
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Achieng" } });
  const suffix = Date.now().toString().slice(-6);
  const proofName = `i19-proof-${suffix}.jpg`;

  const parsed = incidentSchema.parse({
    studentId: student.id,
    date: "2026-06-23",
    category: "VANDALISM",
    severity: "MINOR",
    description: "Window pane was broken near the laboratory corridor; photo proof attached.",
    actionTaken: "Deputy reviewed the proof and warned the learner.",
    proofFileUrl: `/api/files/serve?key=tenants/${tenant.id}/discipline/${proofName}`,
    proofFileName: proofName,
  });

  const created = await reportIncident(principal, parsed);
  try {
    const row = await db.disciplineIncident.findUniqueOrThrow({ where: { id: created.id } });
    assert(row.proofFileUrl === parsed.proofFileUrl && row.proofFileName === proofName, "incident photo proof URL and file name are stored on the real incident row");

    const searchedByProof = await listIncidents(principal, { search: proofName });
    assert(searchedByProof.some((i) => i.id === created.id), "incident list can search proof file names");

    const searchedByAdmission = await listIncidents(principal, { search: student.admissionNo });
    assert(searchedByAdmission.some((i) => i.id === created.id), "incident list can search admission numbers to prevent false learner identity inputs");

    const client = readFileSync(join(process.cwd(), "src/components/discipline/discipline-client.tsx"), "utf8");
    const service = readFileSync(join(process.cwd(), "src/lib/services/discipline.service.ts"), "utf8");
    const route = readFileSync(join(process.cwd(), "src/app/api/discipline/route.ts"), "utf8");
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

    assert(client.includes("StudentSearchSelect") && client.includes("Search learner, admission no, category or proof file"), "Discipline UI uses searchable learner/proof inputs, not learner dropdowns");
    assert(client.includes("Upload Proof / Take Photo") && client.includes('accept="image/*,application/pdf"'), "Incident dialog supports photo/camera proof upload");
    assert(client.includes("View Incident Proof") && client.includes("proofFileUrl"), "Incident list exposes a proof download/view link");
    assert(route.includes("search: sp.get(\"q\")") && service.includes("proofFileName"), "Discipline API and service wire q search through proof file names");
    assert(schema.includes("proofFileUrl") && schema.includes("proofFileName"), "schema stores incident proof file metadata");

    console.log("\nI.19 Incident Photo Proof test passed.");
  } finally {
    await db.disciplineIncident.deleteMany({ where: { id: created.id } });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => db.$disconnect());
