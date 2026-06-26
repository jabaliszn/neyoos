/**
 * Recycle Bin service (Feature G.6).
 * Lists soft-deleted records, restores them, or purges them permanently.
 * Uses the raw db client (must see deletedAt rows). Tenant-checked explicitly.
 * Every action is audited.
 */
import { db } from "@/lib/db";

export class RecycleError extends Error {
  constructor(public code: "NOT_FOUND" | "UNSUPPORTED", message: string) {
    super(message);
    this.name = "RecycleError";
  }
}

export interface DeletedItem {
  kind: string; // "payment" ...
  id: string;
  label: string;
  detail: string;
  deletedAt: string;
}

/** List everything currently in the bin for a tenant. */
export async function listDeleted(tenantId: string): Promise<DeletedItem[]> {
  const payments = await db.payment.findMany({
    where: { tenantId, NOT: { deletedAt: null } },
    orderBy: { deletedAt: "desc" },
    take: 100,
  });

  return payments.map((p) => ({
    kind: "payment",
    id: p.id,
    label: `${p.accountRef ?? "Payment"} — KES ${p.amount.toLocaleString("en-KE")}`,
    detail: `${p.status}${p.mpesaRef ? " · " + p.mpesaRef : ""}`,
    deletedAt: p.deletedAt!.toISOString(),
  }));
}

async function audit(
  tenantId: string,
  actor: { id: string; fullName: string },
  action: string,
  kind: string,
  id: string
) {
  await db.auditLog.create({
    data: {
      tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action,
      entityType: kind,
      entityId: id,
    },
  });
}

/** Restore a soft-deleted record (tenant-checked). */
export async function restore(
  tenantId: string,
  actor: { id: string; fullName: string },
  kind: string,
  id: string
) {
  if (kind === "payment") {
    const res = await db.payment.updateMany({
      where: { id, tenantId, NOT: { deletedAt: null } },
      data: { deletedAt: null, deletedById: null },
    });
    if (res.count === 0) throw new RecycleError("NOT_FOUND", "Item not found in bin.");
    await audit(tenantId, actor, "recycle.restored", kind, id);
    return;
  }
  throw new RecycleError("UNSUPPORTED", "This item type can't be restored.");
}

/** Permanently delete a soft-deleted record (tenant-checked). */
export async function purge(
  tenantId: string,
  actor: { id: string; fullName: string },
  kind: string,
  id: string
) {
  if (kind === "payment") {
    const existing = await db.payment.findFirst({
      where: { id, tenantId, NOT: { deletedAt: null } },
    });
    if (!existing) throw new RecycleError("NOT_FOUND", "Item not found in bin.");
    await db.payment.delete({ where: { id } });
    await audit(tenantId, actor, "recycle.purged", kind, id);
    return;
  }
  throw new RecycleError("UNSUPPORTED", "This item type can't be purged.");
}
