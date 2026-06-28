import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  const term = await db.academicTerm.findFirst({ where: { tenantId: khTenant.id, current: true } });
  if (!term) throw new Error("Term not found");

  // Force close the Marks Portal so we can compute
  const portal = await db.marksPortal.findFirst({ where: { tenantId: khTenant.id, termId: term.id } });
  if (!portal) throw new Error("Marks portal not found");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await db.marksPortal.update({
    where: { id: portal.id },
    data: { closeDate: yesterday }
  });

  console.log("Portal forcibly closed. Triggering Background Computation...");

  const { triggerTermComputation } = await import("../src/lib/services/computation-engine.service");
  
  // This fires asynchronously
  const res = await triggerTermComputation(khTenant.id, portal.id);
  console.log("Computation Status:", res.status);

  // Wait 3 seconds to let background job simulate
  await new Promise(r => setTimeout(r, 3000));

  const check = await db.marksPortal.findUnique({ where: { id: portal.id } });
  console.log("Post-wait DB Status:", check?.status, "Progress:", check?.computationProgress + "%");

  // Wait another 3 seconds for it to hit 100% and PENDING_RELEASE
  await new Promise(r => setTimeout(r, 3000));
  
  const finalCheck = await db.marksPortal.findUnique({ where: { id: portal.id } });
  console.log("Final DB Status:", finalCheck?.status, "Progress:", finalCheck?.computationProgress + "%");

  if (finalCheck?.status !== "PENDING_RELEASE") {
    throw new Error("Background computation did not complete successfully.");
  }

  // Joint Release
  const principal = await db.user.findFirst({ where: { tenantId: khTenant.id, role: "PRINCIPAL" } });
  const { releaseTermResults } = await import("../src/lib/services/computation-engine.service");

  await releaseTermResults(khTenant.id, portal.id, principal!.id);
  console.log("✓ K.7 & K.8 Principal Joint-Released results successfully.");

  const verify = await db.marksPortal.findUnique({ where: { id: portal.id } });
  if (verify?.status !== "RELEASED") throw new Error("Release failed.");

  console.log("✓ PART K (Computation Engine) Full-Stack Verification Passed.");
}

main().catch(console.error).finally(() => db.$disconnect());
