import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { nextTenantId } from "@/lib/services/identity.service";

/**
 * B.25 — Procurement: purchase request → quotation comparison → PO →
 * approval workflow per threshold → delivery tracking → 3-WAY MATCH
 * (PO total vs goods received vs supplier invoice).
 *
 * Permission model: inventory.manage raises requests/quotes/deliveries
 * (bursar territory). APPROVAL above the tenant threshold = LEADERSHIP
 * (tenant.manage_settings holders: owner/principal) — checked in the API.
 */

export class ProcurementError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "FORBIDDEN" | "STATE", message: string) {
    super(message);
  }
}

async function audit(user: SessionUser, action: string, entityId: string, metadata: Record<string, unknown>) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType: "purchaseOrder", entityId, metadata: JSON.stringify(metadata),
    },
  });
}

export async function createRequest(
  user: SessionUser,
  input: { title: string; details?: string; neededBy?: string }
) {
  return withTenant(user.tenantId, async () => {
    const row = await db.purchaseRequest.create({
      data: {
        tenantId: user.tenantId, title: input.title.trim(), details: input.details?.trim() || null,
        neededBy: input.neededBy || null, requestedById: user.id, requestedByName: user.fullName,
      },
    });
    await audit(user, "procurement.request_created", row.id, { title: input.title });
    return row;
  });
}

export async function addQuote(
  user: SessionUser,
  input: { requestId: string; supplierId: string; amountKes: number; note?: string }
) {
  return withTenant(user.tenantId, async () => {
    const req = await tenantDb().purchaseRequest.findUnique({ where: { id: input.requestId } });
    if (!req) throw new ProcurementError("NOT_FOUND", "Purchase request not found.");
    if (req.status !== "OPEN") throw new ProcurementError("STATE", "This request is closed.");
    if (input.amountKes <= 0) throw new ProcurementError("INVALID", "Quote amount must be above zero.");
    const supplier = await tenantDb().supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new ProcurementError("NOT_FOUND", "Supplier not found — add them first.");
    const row = await db.purchaseQuote.create({
      data: {
        tenantId: user.tenantId, requestId: req.id, supplierId: supplier.id,
        supplierName: supplier.name, amountKes: input.amountKes, note: input.note?.trim() || null,
      },
    });
    await audit(user, "procurement.quote_added", req.id, { supplier: supplier.name, amountKes: input.amountKes });
    return row;
  });
}

/**
 * Turn the winning quote into a PO. Threshold rule:
 * total > Tenant.poApprovalThresholdKes => PENDING_APPROVAL (leadership),
 * otherwise auto-APPROVED so small purchases never block on the principal.
 */
export async function createOrderFromQuote(user: SessionUser, quoteId: string) {
  return withTenant(user.tenantId, async () => {
    const quote = await tenantDb().purchaseQuote.findUnique({ where: { id: quoteId } });
    if (!quote) throw new ProcurementError("NOT_FOUND", "Quote not found.");
    const req = await tenantDb().purchaseRequest.findUnique({ where: { id: quote.requestId } });
    if (!req || req.status !== "OPEN") throw new ProcurementError("STATE", "This request is closed.");

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const needsApproval = quote.amountKes > tenant.poApprovalThresholdKes;
    const poNo = await nextTenantId(user.tenantId, "PURCHASE_ORDER");

    const po = await db.purchaseOrder.create({
      data: {
        tenantId: user.tenantId, poNo, requestId: req.id, quoteId: quote.id,
        supplierId: quote.supplierId, supplierName: quote.supplierName,
        title: req.title, totalKes: quote.amountKes,
        status: needsApproval ? "PENDING_APPROVAL" : "APPROVED",
        ...(needsApproval ? {} : { approvedById: user.id, approvedByName: `${user.fullName} (under threshold)`, approvedAt: new Date() }),
        createdById: user.id, createdByName: user.fullName,
      },
    });
    await tenantDb().purchaseRequest.update({ where: { id: req.id }, data: { status: "ORDERED" } });
    await audit(user, "procurement.po_created", po.id, {
      poNo, supplier: quote.supplierName, totalKes: quote.amountKes,
      needsApproval, thresholdKes: tenant.poApprovalThresholdKes,
    });
    return { ...po, needsApproval };
  });
}

/** Leadership approves a pending PO. Creator cannot approve their own. */
export async function approveOrder(user: SessionUser, poId: string) {
  return withTenant(user.tenantId, async () => {
    const po = await tenantDb().purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new ProcurementError("NOT_FOUND", "Purchase order not found.");
    if (po.status !== "PENDING_APPROVAL") throw new ProcurementError("STATE", "This order is not waiting for approval.");
    if (po.createdById === user.id)
      throw new ProcurementError("FORBIDDEN", "You raised this order — a different leader must approve it.");
    const row = await tenantDb().purchaseOrder.update({
      where: { id: poId },
      data: { status: "APPROVED", approvedById: user.id, approvedByName: user.fullName, approvedAt: new Date() },
    });
    await audit(user, "procurement.po_approved", poId, { poNo: po.poNo, totalKes: po.totalKes });
    return row;
  });
}

export async function markSent(user: SessionUser, poId: string) {
  return withTenant(user.tenantId, async () => {
    const po = await tenantDb().purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new ProcurementError("NOT_FOUND", "Purchase order not found.");
    if (po.status !== "APPROVED") throw new ProcurementError("STATE", "Only approved orders can be sent.");
    const row = await tenantDb().purchaseOrder.update({ where: { id: poId }, data: { status: "SENT" } });
    await audit(user, "procurement.po_sent", poId, { poNo: po.poNo });
    return row;
  });
}

/** Goods received note — what actually arrived and its value. */
export async function recordDelivery(
  user: SessionUser,
  input: { poId: string; deliveredValueKes: number; note?: string }
) {
  return withTenant(user.tenantId, async () => {
    const po = await tenantDb().purchaseOrder.findUnique({ where: { id: input.poId } });
    if (!po) throw new ProcurementError("NOT_FOUND", "Purchase order not found.");
    if (po.status !== "SENT") throw new ProcurementError("STATE", "Record delivery after the order is sent.");
    if (input.deliveredValueKes < 0) throw new ProcurementError("INVALID", "Delivered value cannot be negative.");
    const row = await tenantDb().purchaseOrder.update({
      where: { id: input.poId },
      data: { status: "DELIVERED", deliveredAt: new Date(), deliveredValueKes: input.deliveredValueKes, deliveredNote: input.note?.trim() || null },
    });
    await audit(user, "procurement.po_delivered", input.poId, { poNo: po.poNo, deliveredValueKes: input.deliveredValueKes });
    return row;
  });
}

/**
 * 3-WAY MATCH: PO total vs goods received vs supplier invoice.
 * All three equal => matchOk. Any difference => flagged with a human note
 * (never silently accepted — that's how schools get eaten).
 */
export async function threeWayMatch(
  user: SessionUser,
  input: { poId: string; supplierInvoiceNo: string; supplierInvoiceKes: number }
) {
  return withTenant(user.tenantId, async () => {
    const po = await tenantDb().purchaseOrder.findUnique({ where: { id: input.poId } });
    if (!po) throw new ProcurementError("NOT_FOUND", "Purchase order not found.");
    if (po.status !== "DELIVERED") throw new ProcurementError("STATE", "Match after delivery is recorded.");
    if (input.supplierInvoiceKes <= 0) throw new ProcurementError("INVALID", "Invoice amount must be above zero.");

    const delivered = po.deliveredValueKes ?? 0;
    const problems: string[] = [];
    if (delivered !== po.totalKes)
      problems.push(`Goods received KES ${delivered.toLocaleString()} ≠ PO KES ${po.totalKes.toLocaleString()}`);
    if (input.supplierInvoiceKes !== po.totalKes)
      problems.push(`Invoice KES ${input.supplierInvoiceKes.toLocaleString()} ≠ PO KES ${po.totalKes.toLocaleString()}`);
    if (input.supplierInvoiceKes !== delivered)
      problems.push(`Invoice KES ${input.supplierInvoiceKes.toLocaleString()} ≠ received KES ${delivered.toLocaleString()}`);
    const matchOk = problems.length === 0;

    const row = await tenantDb().purchaseOrder.update({
      where: { id: input.poId },
      data: {
        status: "MATCHED", matchedAt: new Date(), matchOk,
        supplierInvoiceNo: input.supplierInvoiceNo.trim(), supplierInvoiceKes: input.supplierInvoiceKes,
        matchNote: matchOk ? "PO, delivery and invoice all agree." : problems.join(" · "),
      },
    });
    await audit(user, "procurement.po_matched", input.poId, { poNo: po.poNo, matchOk, problems });
    return row;
  });
}

export async function cancelOrder(user: SessionUser, poId: string) {
  return withTenant(user.tenantId, async () => {
    const po = await tenantDb().purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new ProcurementError("NOT_FOUND", "Purchase order not found.");
    if (["MATCHED", "CANCELLED"].includes(po.status)) throw new ProcurementError("STATE", "This order is closed.");
    const row = await tenantDb().purchaseOrder.update({ where: { id: poId }, data: { status: "CANCELLED" } });
    if (po.requestId) await tenantDb().purchaseRequest.updateMany({ where: { id: po.requestId, status: "ORDERED" }, data: { status: "OPEN" } });
    await audit(user, "procurement.po_cancelled", poId, { poNo: po.poNo });
    return row;
  });
}

/** Board: open requests w/ quotes (cheapest highlighted) + orders pipeline. */
export async function procurementBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const requests = await tenantDb().purchaseRequest.findMany({
      where: { status: { in: ["OPEN", "ORDERED"] } },
      orderBy: { createdAt: "desc" },
      include: { quotes: { orderBy: { amountKes: "asc" } } },
      take: 30,
    });
    const orders = await tenantDb().purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return {
      thresholdKes: tenant.poApprovalThresholdKes,
      requests: requests.map((r) => ({
        ...r,
        cheapestQuoteId: r.quotes[0]?.id ?? null,
      })),
      orders,
    };
  });
}
