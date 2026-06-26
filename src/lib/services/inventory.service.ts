/**
 * B.18 Inventory / Stores — multiple stores, categorised stock items,
 * IN/OUT/ADJUST movements (full audit trail), reorder alerts, batch + expiry
 * tracking for perishables, a separate fixed-asset register, and SALES TO
 * STUDENTS that land DIRECTLY on the student's B.7 invoice
 * (FOUNDER RULE 2026-06-12: "ALL SERVICES SHOULD BE CONNECTED TO THE
 * INVOICES OF THE STUDENTS").
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";

export class InventoryError extends Error {
  constructor(
    public code: "NOT_FOUND" | "DUPLICATE" | "INSUFFICIENT" | "INVALID",
    message: string
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType, entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

const fullName = (s: { firstName: string; middleName: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

function nairobiToday(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

const EXPIRY_WARN_DAYS = 30;

function daysUntil(date: string): number {
  return Math.ceil((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${nairobiToday()}T00:00:00Z`).getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Stores + items
// ---------------------------------------------------------------------------

export async function listStores(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const stores = await tenantDb().store.findMany({
      where: { archived: false },
      include: { items: { where: { archived: false } } },
      orderBy: { name: "asc" },
    });
    return stores.map((s) => ({
      id: s.id, name: s.name, location: s.location,
      items: s.items.length,
      lowStock: s.items.filter((i) => i.reorderLevel > 0 && i.qty <= i.reorderLevel).length,
    }));
  });
}

export async function createStore(user: SessionUser, input: { name: string; location?: string }) {
  return withTenant(user.tenantId, async () => {
    const dup = await tenantDb().store.findFirst({ where: { name: input.name, archived: false } });
    if (dup) throw new InventoryError("DUPLICATE", "A store with that name already exists.");
    const s = await db.store.create({
      data: { tenantId: user.tenantId, name: input.name, location: input.location ?? null },
    });
    await audit(user, "inventory.store_created", "store", s.id, { name: input.name });
    return s;
  });
}

export async function listItems(user: SessionUser, q: { storeId?: string; lowOnly?: boolean } = {}) {
  return withTenant(user.tenantId, async () => {
    const items = await tenantDb().stockItem.findMany({
      where: { archived: false, ...(q.storeId ? { storeId: q.storeId } : {}) },
      include: { store: true, batches: { where: { qty: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    const today = nairobiToday();
    const rows = items.map((i) => {
      const expiring = i.batches.filter((b) => b.expiryDate && daysUntil(b.expiryDate) <= EXPIRY_WARN_DAYS);
      const expired = i.batches.filter((b) => b.expiryDate && b.expiryDate < today);
      return {
        id: i.id, name: i.name, category: i.category, unit: i.unit,
        storeId: i.storeId, storeName: i.store.name,
        qty: i.qty, reorderLevel: i.reorderLevel,
        low: i.reorderLevel > 0 && i.qty <= i.reorderLevel,
        sellPriceKes: i.sellPriceKes, trackExpiry: i.trackExpiry,
        batches: i.batches.map((b) => ({
          id: b.id, batchNo: b.batchNo, qty: b.qty, expiryDate: b.expiryDate,
          expiring: Boolean(b.expiryDate && daysUntil(b.expiryDate) <= EXPIRY_WARN_DAYS),
          expired: Boolean(b.expiryDate && b.expiryDate < today),
        })),
        expiringBatches: expiring.length,
        expiredBatches: expired.length,
      };
    });
    return q.lowOnly ? rows.filter((r) => r.low) : rows;
  });
}

export async function createItem(
  user: SessionUser,
  input: { storeId: string; name: string; category: string; unit: string; reorderLevel: number; sellPriceKes?: number; trackExpiry?: boolean }
) {
  return withTenant(user.tenantId, async () => {
    const store = await tenantDb().store.findUnique({ where: { id: input.storeId } });
    if (!store) throw new InventoryError("NOT_FOUND", "Store not found.");
    const dup = await tenantDb().stockItem.findFirst({ where: { storeId: input.storeId, name: input.name, archived: false } });
    if (dup) throw new InventoryError("DUPLICATE", `${store.name} already has "${input.name}".`);
    const item = await db.stockItem.create({
      data: {
        tenantId: user.tenantId, storeId: input.storeId, name: input.name,
        category: input.category, unit: input.unit, reorderLevel: input.reorderLevel,
        sellPriceKes: input.sellPriceKes ?? null, trackExpiry: Boolean(input.trackExpiry),
      },
    });
    await audit(user, "inventory.item_created", "stockItem", item.id, { store: store.name, name: input.name });
    return item;
  });
}

// ---------------------------------------------------------------------------
// Movements: IN / OUT / SALE
// ---------------------------------------------------------------------------

export async function stockIn(
  user: SessionUser,
  input: { itemId: string; qty: number; reason?: string; batchNo?: string; expiryDate?: string }
) {
  return withTenant(user.tenantId, async () => {
    const item = await tenantDb().stockItem.findUnique({ where: { id: input.itemId } });
    if (!item) throw new InventoryError("NOT_FOUND", "Item not found.");
    if (item.trackExpiry && !input.batchNo)
      throw new InventoryError("INVALID", `${item.name} tracks batches — enter the batch number (and expiry).`);

    await tenantDb().stockItem.update({ where: { id: item.id }, data: { qty: { increment: input.qty } } });
    if (input.batchNo) {
      await db.stockBatch.create({
        data: {
          tenantId: user.tenantId, itemId: item.id, batchNo: input.batchNo,
          qty: input.qty, expiryDate: input.expiryDate ?? null,
        },
      });
    }
    const mv = await db.stockMovement.create({
      data: {
        tenantId: user.tenantId, itemId: item.id, type: "IN", qty: input.qty,
        reason: input.reason ?? null, byId: user.id, byName: user.fullName,
      },
    });
    await audit(user, "inventory.stock_in", "stockMovement", mv.id, { item: item.name, qty: input.qty });
    return mv;
  });
}

export async function stockOut(user: SessionUser, input: { itemId: string; qty: number; reason: string }) {
  return withTenant(user.tenantId, async () => {
    const item = await tenantDb().stockItem.findUnique({ where: { id: input.itemId } });
    if (!item) throw new InventoryError("NOT_FOUND", "Item not found.");
    if (item.qty < input.qty)
      throw new InventoryError("INSUFFICIENT", `Only ${item.qty} ${item.unit} of ${item.name} in stock.`);

    await tenantDb().stockItem.update({ where: { id: item.id }, data: { qty: { decrement: input.qty } } });
    // FIFO-deplete batches for perishables.
    if (item.trackExpiry) {
      let remaining = input.qty;
      const batches = await tenantDb().stockBatch.findMany({
        where: { itemId: item.id, qty: { gt: 0 } },
        orderBy: { expiryDate: "asc" },
      });
      for (const b of batches) {
        if (remaining <= 0) break;
        const take = Math.min(b.qty, remaining);
        await tenantDb().stockBatch.update({ where: { id: b.id }, data: { qty: { decrement: take } } });
        remaining -= take;
      }
    }
    const mv = await db.stockMovement.create({
      data: {
        tenantId: user.tenantId, itemId: item.id, type: "OUT", qty: input.qty,
        reason: input.reason, byId: user.id, byName: user.fullName,
      },
    });
    await audit(user, "inventory.stock_out", "stockMovement", mv.id, { item: item.name, qty: input.qty, reason: input.reason });

    const after = await tenantDb().stockItem.findUnique({ where: { id: item.id } });
    return {
      id: mv.id,
      qtyLeft: after?.qty ?? 0,
      lowStock: Boolean(after && after.reorderLevel > 0 && after.qty <= after.reorderLevel),
    };
  });
}

/**
 * SELL to a student (uniform, exercise books...) — FOUNDER RULE: the sale is
 * billed straight onto the student's B.7 invoice. One invoice per sale, so
 * it shows on the family portal + can be paid via M-Pesa STK like any fee.
 */
export async function sellToStudent(user: SessionUser, input: { itemId: string; studentId: string; qty: number }) {
  return withTenant(user.tenantId, async () => {
    const item = await tenantDb().stockItem.findUnique({ where: { id: input.itemId } });
    if (!item) throw new InventoryError("NOT_FOUND", "Item not found.");
    if (!item.sellPriceKes) throw new InventoryError("INVALID", `${item.name} has no selling price — set one to sell it.`);
    if (item.qty < input.qty)
      throw new InventoryError("INSUFFICIENT", `Only ${item.qty} ${item.unit} of ${item.name} in stock.`);

    const student = await tenantDb().student.findFirst({ where: { id: input.studentId, status: "ACTIVE", deletedAt: null } });
    if (!student) throw new InventoryError("NOT_FOUND", "Student not found (or not active).");

    const totalKes = Math.round(item.sellPriceKes * input.qty);
    const now = new Date(Date.now() + 3 * 3600_000);
    const year = now.getUTCFullYear();
    const term = await tenantDb().academicTerm.findFirst({ where: { current: true } });

    // The invoice (B.7) — due in 14 days, payable like any other fee.
    const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
    const due = new Date(now.getTime() + 14 * 24 * 3600_000).toISOString().slice(0, 10);
    const invoice = await db.invoice.create({
      data: {
        tenantId: user.tenantId, invoiceNo, studentId: student.id,
        description: `${item.name} × ${input.qty} (school store)`,
        totalKes, dueDate: due, status: "UNPAID",
        year, term: term?.term ?? 1,
      },
    });

    // The stock side.
    await tenantDb().stockItem.update({ where: { id: item.id }, data: { qty: { decrement: input.qty } } });
    const mv = await db.stockMovement.create({
      data: {
        tenantId: user.tenantId, itemId: item.id, type: "SALE", qty: input.qty,
        reason: "Sold to student", studentId: student.id, studentName: fullName(student),
        invoiceId: invoice.id, byId: user.id, byName: user.fullName,
      },
    });
    await audit(user, "inventory.sold", "stockMovement", mv.id, {
      item: item.name, qty: input.qty, student: fullName(student), invoiceNo, totalKes,
    });
    return { movementId: mv.id, invoiceId: invoice.id, invoiceNo, totalKes, studentName: fullName(student) };
  });
}

/** Movement history for an item (the audit trail). */
export async function itemMovements(user: SessionUser, itemId: string) {
  return withTenant(user.tenantId, async () => {
    const item = await tenantDb().stockItem.findUnique({ where: { id: itemId }, include: { store: true } });
    if (!item) throw new InventoryError("NOT_FOUND", "Item not found.");
    const movements = await tenantDb().stockMovement.findMany({
      where: { itemId }, orderBy: { createdAt: "desc" }, take: 50,
    });
    return {
      item: { id: item.id, name: item.name, unit: item.unit, qty: item.qty, storeName: item.store.name },
      movements,
    };
  });
}

/** Reorder alerts + expiring batches — the "what needs attention" panel. */
export async function alerts(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const items = await listItems(user);
    return {
      lowStock: items.filter((i) => i.low).map((i) => ({ id: i.id, name: i.name, storeName: i.storeName, qty: i.qty, reorderLevel: i.reorderLevel, unit: i.unit })),
      expiring: items.flatMap((i) =>
        i.batches.filter((b) => b.expiring && !b.expired).map((b) => ({ itemId: i.id, item: i.name, batchNo: b.batchNo, qty: b.qty, expiryDate: b.expiryDate!, unit: i.unit }))
      ),
      expired: items.flatMap((i) =>
        i.batches.filter((b) => b.expired).map((b) => ({ itemId: i.id, item: i.name, batchNo: b.batchNo, qty: b.qty, expiryDate: b.expiryDate!, unit: i.unit }))
      ),
    };
  });
}

// ---------------------------------------------------------------------------
// Assets (separate register)
// ---------------------------------------------------------------------------

export async function listAssets(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().asset.findMany({ where: { archived: false }, orderBy: { tag: "asc" } });
  });
}

export async function addAsset(
  user: SessionUser,
  input: { name: string; category: string; location?: string; custodian?: string; acquiredOn?: string; valueKes: number }
) {
  return withTenant(user.tenantId, async () => {
    const count = await tenantDb().asset.count();
    const tag = `AST${count + 1}`;
    const a = await db.asset.create({
      data: {
        tenantId: user.tenantId, tag, name: input.name, category: input.category,
        location: input.location ?? null, custodian: input.custodian ?? null,
        acquiredOn: input.acquiredOn ?? null, valueKes: input.valueKes,
      },
    });
    await audit(user, "inventory.asset_added", "asset", a.id, { tag, name: input.name, valueKes: input.valueKes });
    return a;
  });
}

// ---------------------------------------------------------------------------
// B.25 School Assets — depreciation auto-calc + maintenance schedule/log.
// ---------------------------------------------------------------------------

/** Straight-line book value from acquisition date + %/year. Floor 0. */
export function bookValueKes(asset: { valueKes: number; acquiredOn: string | null; depreciationPctPerYear: number }, today = new Date(Date.now() + 3 * 3600_000)): number {
  if (!asset.acquiredOn || asset.depreciationPctPerYear <= 0) return asset.valueKes;
  const years = Math.max(0, (today.getTime() - new Date(`${asset.acquiredOn}T00:00:00Z`).getTime()) / (365.25 * 86_400_000));
  const depreciated = asset.valueKes * (1 - (asset.depreciationPctPerYear / 100) * years);
  return Math.max(0, Math.round(depreciated));
}

/** Update the B.25 fields on an asset (depreciation %, next service, custodian...). */
export async function updateAsset(
  user: SessionUser,
  assetId: string,
  input: { depreciationPctPerYear?: number; nextMaintenanceOn?: string | null; custodian?: string | null; location?: string | null; condition?: string; acquiredOn?: string | null; valueKes?: number }
) {
  return withTenant(user.tenantId, async () => {
    const asset = await tenantDb().asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new InventoryError("NOT_FOUND", "Asset not found.");
    if (input.depreciationPctPerYear !== undefined && (input.depreciationPctPerYear < 0 || input.depreciationPctPerYear > 100))
      throw new InventoryError("INVALID", "Depreciation must be 0–100% per year.");
    const row = await tenantDb().asset.update({ where: { id: assetId }, data: input });
    await audit(user, "inventory.asset_updated", "asset", assetId, { tag: asset.tag, ...input });
    return row;
  });
}

/** Log a service/repair; optionally set the next planned date in one go. */
export async function logAssetMaintenance(
  user: SessionUser,
  input: { assetId: string; date: string; kind: string; costKes: number; note?: string; nextMaintenanceOn?: string }
) {
  return withTenant(user.tenantId, async () => {
    const asset = await tenantDb().asset.findUnique({ where: { id: input.assetId } });
    if (!asset) throw new InventoryError("NOT_FOUND", "Asset not found.");
    if (input.costKes < 0) throw new InventoryError("INVALID", "Cost cannot be negative.");
    const row = await db.assetMaintenance.create({
      data: {
        tenantId: user.tenantId, assetId: asset.id, date: input.date,
        kind: input.kind, costKes: input.costKes, note: input.note ?? null, byName: user.fullName,
      },
    });
    if (input.nextMaintenanceOn !== undefined) {
      await tenantDb().asset.update({ where: { id: asset.id }, data: { nextMaintenanceOn: input.nextMaintenanceOn || null } });
    }
    await audit(user, "inventory.asset_maintained", "asset", asset.id, { tag: asset.tag, kind: input.kind, costKes: input.costKes });
    return row;
  });
}

/** Asset register w/ computed book values + maintenance due flags + history. */
export async function assetRegister(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 33 * 86_400_000).toISOString().slice(0, 10); // 30d + EAT margin
    const assets = await tenantDb().asset.findMany({ where: { archived: false }, orderBy: { tag: "asc" } });
    const logs = await tenantDb().assetMaintenance.findMany({
      where: { assetId: { in: assets.map((a) => a.id) } },
      orderBy: { date: "desc" },
    });
    return assets.map((a) => {
      const mine = logs.filter((l) => l.assetId === a.id);
      return {
        ...a,
        bookValueKes: bookValueKes(a),
        maintenanceDue: !!a.nextMaintenanceOn && a.nextMaintenanceOn <= today,
        maintenanceSoon: !!a.nextMaintenanceOn && a.nextMaintenanceOn > today && a.nextMaintenanceOn <= soon,
        maintenanceCostKes: mine.reduce((s, l) => s + l.costKes, 0),
        history: mine.slice(0, 10),
      };
    });
  });
}
