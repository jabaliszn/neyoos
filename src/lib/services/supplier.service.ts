import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { normalizeKePhone } from "@/lib/validations/auth";

/**
 * B.25 — Supplier Management: records + categories + ratings + contracts
 * with expiry alerts (same ≤30-day pattern as B.17 fleet compliance).
 * Permission: inventory.view / inventory.manage (suppliers are stores territory).
 */

export class SupplierError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "INVALID", message: string) {
    super(message);
  }
}

export const SUPPLIER_CATEGORIES = [
  "Food", "Uniform", "Cleaning", "Stationery", "Transport", "Services", "Other",
] as const;

const EXPIRY_WARN_DAYS = 30;

function nairobiToday(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}
function daysUntil(date: string): number {
  return Math.ceil(
    (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${nairobiToday()}T00:00:00Z`).getTime()) / 86_400_000
  );
}

async function audit(user: SessionUser, action: string, entityId: string, metadata: Record<string, unknown>) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType: "supplier", entityId, metadata: JSON.stringify(metadata),
    },
  });
}

export async function createSupplier(
  user: SessionUser,
  input: { name: string; category: string; phone?: string; email?: string; contact?: string; kraPin?: string; notes?: string }
) {
  return withTenant(user.tenantId, async () => {
    const name = input.name.trim();
    const existing = await tenantDb().supplier.findFirst({ where: { name, archived: false } });
    if (existing) throw new SupplierError("DUPLICATE", `${name} is already on the supplier list.`);
    let phone: string | null = null;
    if (input.phone) {
      phone = normalizeKePhone(input.phone);
      if (!phone) throw new SupplierError("INVALID", "Enter a valid Kenyan phone (07.. or +2547..).");
    }
    const row = await db.supplier.create({
      data: {
        tenantId: user.tenantId, name, category: input.category,
        phone, email: input.email?.trim() || null, contact: input.contact?.trim() || null,
        kraPin: input.kraPin?.trim() || null, notes: input.notes?.trim() || null,
      },
    });
    await audit(user, "supplier.created", row.id, { name, category: input.category });
    return row;
  });
}

export async function rateSupplier(user: SessionUser, supplierId: string, rating: number) {
  return withTenant(user.tenantId, async () => {
    if (rating < 1 || rating > 5) throw new SupplierError("INVALID", "Rating is 1 to 5 stars.");
    const sup = await tenantDb().supplier.findUnique({ where: { id: supplierId } });
    if (!sup) throw new SupplierError("NOT_FOUND", "Supplier not found.");
    const row = await tenantDb().supplier.update({ where: { id: supplierId }, data: { rating } });
    await audit(user, "supplier.rated", supplierId, { name: sup.name, rating });
    return row;
  });
}

export async function archiveSupplier(user: SessionUser, supplierId: string) {
  return withTenant(user.tenantId, async () => {
    const sup = await tenantDb().supplier.findUnique({ where: { id: supplierId } });
    if (!sup) throw new SupplierError("NOT_FOUND", "Supplier not found.");
    const row = await tenantDb().supplier.update({ where: { id: supplierId }, data: { archived: true } });
    await audit(user, "supplier.archived", supplierId, { name: sup.name });
    return row;
  });
}

export async function addContract(
  user: SessionUser,
  input: { supplierId: string; title: string; startsOn: string; endsOn: string; valueKes: number; note?: string }
) {
  return withTenant(user.tenantId, async () => {
    const sup = await tenantDb().supplier.findUnique({ where: { id: input.supplierId } });
    if (!sup) throw new SupplierError("NOT_FOUND", "Supplier not found.");
    if (input.endsOn <= input.startsOn) throw new SupplierError("INVALID", "Contract must end after it starts.");
    if (input.valueKes < 0) throw new SupplierError("INVALID", "Value cannot be negative.");
    const row = await db.supplierContract.create({
      data: {
        tenantId: user.tenantId, supplierId: sup.id, title: input.title.trim(),
        startsOn: input.startsOn, endsOn: input.endsOn, valueKes: input.valueKes,
        note: input.note?.trim() || null,
      },
    });
    await audit(user, "supplier.contract_added", sup.id, { supplier: sup.name, title: input.title, endsOn: input.endsOn, valueKes: input.valueKes });
    return row;
  });
}

/** Directory: suppliers + contract status flags (expired / expiring ≤30d / active). */
export async function supplierDirectory(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const today = nairobiToday();
    const suppliers = await tenantDb().supplier.findMany({
      where: { archived: false },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { contracts: { orderBy: { endsOn: "desc" } } },
    });
    return suppliers.map((s) => {
      const contracts = s.contracts.map((c) => ({
        ...c,
        expired: c.endsOn < today,
        expiringSoon: c.endsOn >= today && daysUntil(c.endsOn) <= EXPIRY_WARN_DAYS,
        daysLeft: daysUntil(c.endsOn),
      }));
      const active = contracts.filter((c) => !c.expired);
      return {
        id: s.id, name: s.name, category: s.category, phone: s.phone, email: s.email,
        contact: s.contact, kraPin: s.kraPin, rating: s.rating, notes: s.notes,
        contracts,
        activeContracts: active.length,
        hasExpiring: active.some((c) => c.expiringSoon),
        hasExpired: contracts.some((c) => c.expired),
      };
    });
  });
}
