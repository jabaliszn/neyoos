import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const khTenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!khTenant) throw new Error("Tenant not found");

  // Temporarily downgrade Karibu High to Free Karibu (which lacks Advanced Analytics)
  await db.subscription.update({
    where: { tenantId: khTenant.id },
    data: { planKey: "free_karibu" }
  });

  const { requirePremiumFeature, TierGatingError } = await import("../src/lib/services/tier-gating.service");

  try {
    await requirePremiumFeature(khTenant.id, "advanced_analytics");
    throw new Error("Should have thrown TierGatingError!");
  } catch (error) {
    if (error instanceof TierGatingError) {
      console.log("✓ J.23 DB Seeded Tier Guard successfully blocked free tier from Advanced Analytics.");
    } else {
      throw error;
    }
  }

  // Upgrade back to Elite to unlock it
  await db.subscription.update({
    where: { tenantId: khTenant.id },
    data: { planKey: "elite" }
  });

  await requirePremiumFeature(khTenant.id, "advanced_analytics");
  console.log("✓ J.23 DB Seeded Tier Guard successfully permitted Elite tier.");
}

main().catch(console.error).finally(() => db.$disconnect());
