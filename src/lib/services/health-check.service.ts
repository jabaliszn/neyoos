/**
 * G.30 — NEYO Health Check service.
 * SUPER_ADMIN company-wide churn dashboard compiling usage statistics across all schools.
 */
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";

export async function getCompanyHealthCheck(user: SessionUser) {
  if (user.role !== "SUPER_ADMIN") throw new Error("Unauthorized.");

  const tenants = await db.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  });

  const results = [];

  for (const t of tenants) {
    // 1) logins count (sessions created in the last 30 days)
    const loginsCount = await db.session.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
        user: { tenantId: t.id },
      },
    });

    // 2) SMS spend (total sms sent this term)
    const smsCounter = await db.usageCounter.findFirst({
      where: { tenantId: t.id, metric: "smsPerTerm" },
      orderBy: { periodKey: "desc" },
    });
    const smsCount = smsCounter?.used ?? 0;

    // 3) fees collected (sum of reconciled paid payments)
    const feesCollectedSum = await db.payment.aggregate({
      _sum: { amount: true },
      where: { tenantId: t.id, status: "PAID" },
    });
    const feesCollected = feesCollectedSum._sum.amount ?? 0;

    // 4) module adoption (count of enabled modules)
    const modulesEnabled = await db.tenantModule.count({
      where: { tenantId: t.id, enabled: true },
    });

    // 5) calculate churn-risk score
    let risk = "LOW";
    if (loginsCount < 5 || feesCollected === 0) {
      risk = "HIGH";
    } else if (loginsCount < 15) {
      risk = "MEDIUM";
    }

    results.push({
      id: t.id,
      name: t.name,
      slug: t.slug,
      loginsCount,
      smsCount,
      feesCollected,
      modulesEnabled,
      risk,
      createdAt: t.createdAt.toISOString().slice(0, 10),
    });
  }

  return results;
}
