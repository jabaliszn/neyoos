/**
 * B.8 Payroll — Kenyan statutory mathematics + run management.
 *
 * Rates (2024/25 statutes, public):
 * - PAYE bands (monthly): 10% to 24,000 · 25% to 32,333 · 30% to 500,000 ·
 *   32.5% to 800,000 · 35% above. Personal relief KES 2,400/month.
 * - SHIF (SHA): 2.75% of gross, minimum KES 300.
 * - NSSF (Tier I+II, employee 6%): pensionable capped at 72,000 =>
 *   Tier I = 6% of first 8,000 (480), Tier II = 6% of 8,001–72,000 (max 3,840).
 * - Affordable Housing Levy: 1.5% of gross (employee).
 * EDIT POINT: update the constants below when KRA/SHA/NSSF gazette new rates.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class PayrollError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "EMPTY" | "LOCKED", message: string) {
    super(message);
    this.name = "PayrollError";
  }
}

// ---------------------------------------------------------------------------
// Statutory calculator (pure functions — unit-testable)
// ---------------------------------------------------------------------------

const PAYE_BANDS: [number, number][] = [
  // [upper bound of band (monthly KES), rate]
  [24000, 0.10],
  [32333, 0.25],
  [500000, 0.30],
  [800000, 0.325],
  [Infinity, 0.35],
];
const PERSONAL_RELIEF = 2400;
const SHIF_RATE = 0.0275;
const SHIF_MIN = 300;
const NSSF_TIER1_CAP = 8000;
const NSSF_TIER2_CAP = 72000;
const NSSF_RATE = 0.06;
const HOUSING_LEVY_RATE = 0.015;

export function nssfEmployee(gross: number): number {
  const tier1 = Math.min(gross, NSSF_TIER1_CAP) * NSSF_RATE;
  const tier2 = Math.max(0, Math.min(gross, NSSF_TIER2_CAP) - NSSF_TIER1_CAP) * NSSF_RATE;
  return Math.round(tier1 + tier2);
}

export function shifContribution(gross: number): number {
  return Math.max(SHIF_MIN, Math.round(gross * SHIF_RATE));
}

export function housingLevy(gross: number): number {
  return Math.round(gross * HOUSING_LEVY_RATE);
}

/** PAYE on taxable income (gross - NSSF - SHIF - AHL are deductible 2025). */
export function payeTax(taxable: number): number {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of PAYE_BANDS) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return Math.max(0, Math.round(tax - PERSONAL_RELIEF));
}

export interface GrossToNet {
  grossKes: number; payeKes: number; shifKes: number; nssfKes: number;
  housingLevyKes: number; netStatutoryKes: number;
}

export function grossToNet(gross: number): GrossToNet {
  const nssf = nssfEmployee(gross);
  const shif = shifContribution(gross);
  const ahl = housingLevy(gross);
  const taxable = gross - nssf - shif - ahl; // post-2025 deductibility
  const paye = payeTax(taxable);
  return {
    grossKes: gross, payeKes: paye, shifKes: shif, nssfKes: nssf,
    housingLevyKes: ahl, netStatutoryKes: gross - paye - shif - nssf - ahl,
  };
}

// ---------------------------------------------------------------------------
// Salary setup
// ---------------------------------------------------------------------------

export async function listSalaries(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const staff = await tenantDb().user.findMany({
      where: { isActive: true, role: { notIn: ["PARENT", "STUDENT", "SUPER_ADMIN"] } },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    });
    const salaries = await tenantDb().staffSalary.findMany();
    const sMap = new Map(salaries.map((s) => [s.userId, s]));
    return staff.map((u) => {
      const s = sMap.get(u.id);
      const gross = s ? s.basicKes + s.houseAllowanceKes + s.transportAllowanceKes + s.otherAllowanceKes : 0;
      return {
        userId: u.id, name: u.fullName, role: u.role,
        basicKes: s?.basicKes ?? 0,
        houseAllowanceKes: s?.houseAllowanceKes ?? 0,
        transportAllowanceKes: s?.transportAllowanceKes ?? 0,
        otherAllowanceKes: s?.otherAllowanceKes ?? 0,
        saccoKes: s?.saccoKes ?? 0,
        loanKes: s?.loanKes ?? 0,
        grossKes: gross,
        configured: Boolean(s),
      };
    });
  });
}

export async function setSalary(user: SessionUser, input: { userId: string; basicKes: number; houseAllowanceKes: number; transportAllowanceKes: number; otherAllowanceKes: number; saccoKes: number; loanKes: number }) {
  return withTenant(user.tenantId, async () => {
    const target = await tenantDb().user.findUnique({ where: { id: input.userId } });
    if (!target) throw new PayrollError("NOT_FOUND", "Staff member not found.");
    const row = await db.staffSalary.upsert({
      where: { userId: input.userId },
      create: { tenantId: user.tenantId, ...input },
      update: { ...input },
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "payroll.salary_set", entityType: "staffSalary", entityId: row.id,
        metadata: JSON.stringify({ userId: input.userId, basicKes: input.basicKes }),
      },
    });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Payroll runs
// ---------------------------------------------------------------------------

export async function listRuns(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const runs = await tenantDb().payrollRun.findMany({
      orderBy: { period: "desc" },
      include: { payslips: true },
    });
    return runs.map((r) => ({
      id: r.id, period: r.period, status: r.status,
      staffCount: r.payslips.length,
      grossKes: r.payslips.reduce((a, p) => a + p.grossKes, 0),
      netKes: r.payslips.reduce((a, p) => a + p.netKes, 0),
      payeKes: r.payslips.reduce((a, p) => a + p.payeKes, 0),
      createdByName: r.createdByName, approvedAt: r.approvedAt,
    }));
  });
}

/** Run payroll for a month: gross→net for every configured salary.
 *  overtime: userId -> KES approved for this period (B.8.8). */
export async function runPayroll(user: SessionUser, period: string, overtime: Record<string, number> = {}) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().payrollRun.findFirst({ where: { period } });
    if (existing) throw new PayrollError("DUPLICATE", `Payroll for ${period} already exists.`);
    const salaries = await tenantDb().staffSalary.findMany();
    if (salaries.length === 0) throw new PayrollError("EMPTY", "No staff salaries configured yet.");
    const users = await tenantDb().user.findMany({
      where: { id: { in: salaries.map((s) => s.userId) }, isActive: true },
      select: { id: true, fullName: true, role: true },
    });
    const uMap = new Map(users.map((u) => [u.id, u]));

    const run = await tenantDb().payrollRun.create({
      data: { period, createdById: user.id, createdByName: user.fullName } as never,
    });

    for (const s of salaries) {
      const u = uMap.get(s.userId);
      if (!u) continue;
      const allowances = s.houseAllowanceKes + s.transportAllowanceKes + s.otherAllowanceKes;
      const ot = Math.max(0, Math.round(overtime[s.userId] ?? 0));
      const gross = s.basicKes + allowances + ot;
      const calc = grossToNet(gross);
      const net = calc.netStatutoryKes - s.saccoKes - s.loanKes;
      await db.payslip.create({
        data: {
          runId: run.id, userId: s.userId, userName: u.fullName, role: u.role,
          basicKes: s.basicKes, allowancesKes: allowances, overtimeKes: ot,
          grossKes: gross, payeKes: calc.payeKes, shifKes: calc.shifKes,
          nssfKes: calc.nssfKes, housingLevyKes: calc.housingLevyKes,
          saccoKes: s.saccoKes, loanKes: s.loanKes, netKes: net,
        },
      });
    }
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "payroll.run_created", entityType: "payrollRun", entityId: run.id,
        metadata: JSON.stringify({ period, staff: salaries.length }),
      },
    });
    return { runId: run.id, staff: salaries.length };
  });
}

export async function approveRun(user: SessionUser, runId: string) {
  return withTenant(user.tenantId, async () => {
    const run = await tenantDb().payrollRun.findUnique({ where: { id: runId } });
    if (!run) throw new PayrollError("NOT_FOUND", "Run not found.");
    if (run.status === "APPROVED") throw new PayrollError("LOCKED", "This run is already approved.");
    await tenantDb().payrollRun.update({ where: { id: runId }, data: { status: "APPROVED", approvedAt: new Date() } });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "payroll.run_approved", entityType: "payrollRun", entityId: runId,
        metadata: JSON.stringify({ period: run.period }),
      },
    });
    return { id: runId, status: "APPROVED" };
  });
}

export async function runDetail(user: SessionUser, runId: string) {
  return withTenant(user.tenantId, async () => {
    const run = await tenantDb().payrollRun.findUnique({ where: { id: runId }, include: { payslips: { orderBy: { userName: "asc" } } } });
    if (!run) throw new PayrollError("NOT_FOUND", "Run not found.");
    return run;
  });
}
