import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { upsertNeyoContract, updateNeyoContractStatus, publicContract, signPublicContract, deleteNeyoContract } from "../src/lib/services/neyo-contract.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260624152000_i48_contract_signing/migration.sql"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/neyo-contract.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const publicRoute = readFileSync(join(process.cwd(), "src/app/api/contracts/sign/[token]/route.ts"), "utf8");
  const publicPage = readFileSync(join(process.cwd(), "src/app/contracts/sign/[token]/page.tsx"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");

  assert(schema.includes("model NeyoContract"), "Database has company-level NeyoContract model");
  assert(migration.includes("CREATE TABLE \"NeyoContract\""), "Migration creates NeyoContract table");
  assert(service.includes("signPublicContract") && service.includes("platform.contract_signed"), "Service supports public e-sign and audit logging");
  assert(api.includes("upsert_contract") && api.includes("listNeyoContracts"), "Founder Ops API exposes contract management actions/data");
  assert(publicRoute.includes("publicContractSignSchema") && publicPage.includes("PublicContractSignClient"), "Public signing API/page exist");
  assert(ui.includes("Contract Signing Management") && ui.includes("Save Contract") && ui.includes("Copy link"), "Business Operations UI has contract board and signing link controls");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");
  const tenant = await db.tenant.findFirst();

  const contract = await upsertNeyoContract(actor!, {
    title: "NEYO School OS Subscription Agreement",
    schoolName: tenant?.name || "Achieng Academy",
    tenantId: tenant?.id || "",
    contactName: "Wanjiru Mwangi",
    contactRole: "Director",
    contactEmail: "wanjiru@example.com",
    contactPhone: "+254700111222",
    templateKey: "SCHOOL_ONBOARDING",
    body: "NEYO School OS agreement body. SMS is bought separately as a top-up and data is preserved during grace enforcement.",
    status: "DRAFT",
    notes: "Founder-created test contract.",
  });
  assert(contract.publicToken.startsWith("ctr_"), "Contract gets a secure public signing token");

  const sent = await updateNeyoContractStatus(actor!, { id: contract.id, status: "SENT", notes: "Sent to director." });
  assert(sent.status === "SENT" && sent.sentAt, "Contract can be marked sent with sentAt timestamp");

  const publicView = await publicContract(contract.publicToken);
  assert(publicView?.id === contract.id, "Public signing token loads the contract");

  const signed = await signPublicContract(contract.publicToken, { signedByName: "Wanjiru Mwangi", signedByRole: "Director", signatureText: "Wanjiru Mwangi", accepted: true }, "127.0.0.1");
  assert(signed.status === "SIGNED" && signed.signedAt && signed.signatureText === "Wanjiru Mwangi", "Public signer records typed signature and signed timestamp");

  const audits = await db.auditLog.findMany({ where: { entityType: "NeyoContract", entityId: contract.id } });
  assert(audits.some((a) => a.action === "platform.contract_created") && audits.some((a) => a.action === "platform.contract_signed"), "Contract create/sign actions are audit logged");

  await db.neyoContract.delete({ where: { id: contract.id } });
  console.log("\nI.48 Contract Signing checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
