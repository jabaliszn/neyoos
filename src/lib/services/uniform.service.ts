/**
 * G.24 Uniform catalogue (founder 2026-06-12): parents browse uniform items
 * (photos + prices) ON THE FAMILY PORTAL and order directly — the order is
 * billed to the student's invoice (founder invoice rule), the school's
 * supplier/tailor is notified by SMS and delivers AT SCHOOL.
 * Stock truth = B.18 StockItems in the "Uniform" category.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere } from "@/lib/services/student.service";
import { nextTenantId } from "@/lib/services/identity.service";
import { sendSms } from "@/lib/notifications/sms";
import type { SessionUser } from "@/lib/core/session";

export class UniformError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "ALREADY", message: string) {
    super(message);
    this.name = "UniformError";
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

/** The catalogue: sellable Uniform items w/ photos + prices (family-visible). */
export async function catalogue(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const items = await tenantDb().stockItem.findMany({
      where: { archived: false, category: "Uniform", sellPriceKes: { not: null } },
      orderBy: { name: "asc" },
    });
    return items.map((i) => ({
      id: i.id, name: i.name, priceKes: i.sellPriceKes!, unit: i.unit,
      imageUrl: i.imageUrl, inStock: i.qty > 0,
    }));
  });
}

/** Parent places an order for their own child (scopeWhere). Staff can order for any student. */
export async function placeOrder(
  user: SessionUser,
  input: { itemId: string; studentId: string; qty: number; size?: string }
) {
  return withTenant(user.tenantId, async () => {
    const item = await tenantDb().stockItem.findUnique({ where: { id: input.itemId } });
    if (!item || item.category !== "Uniform" || !item.sellPriceKes)
      throw new UniformError("NOT_FOUND", "That item is not in the uniform catalogue.");

    // Row-scoping: parents/students can only order for their own family.
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({
      where: { AND: [scope, { id: input.studentId, status: "ACTIVE", deletedAt: null }] },
    });
    if (!student) throw new UniformError("NOT_FOUND", "Student not found.");

    const totalKes = item.sellPriceKes * input.qty;

    // FOUNDER INVOICE RULE: bill at placement.
    const term = await tenantDb().academicTerm.findFirst({ where: { current: true } });
    const now = new Date(Date.now() + 3 * 3600_000);
    const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
    const due = new Date(now.getTime() + 14 * 24 * 3600_000).toISOString().slice(0, 10);
    const invoice = await db.invoice.create({
      data: {
        tenantId: user.tenantId, invoiceNo, studentId: student.id,
        description: `Uniform order — ${item.name} × ${input.qty}${input.size ? ` (${input.size})` : ""}`,
        totalKes, dueDate: due, status: "UNPAID",
        year: now.getUTCFullYear(), term: term?.term ?? 1,
      },
    });

    const count = await tenantDb().uniformOrder.count();
    const orderNo = `UO${count + 1}`;
    const order = await db.uniformOrder.create({
      data: {
        tenantId: user.tenantId, orderNo, studentId: student.id,
        studentName: fullName(student), admissionNo: student.admissionNo,
        itemId: item.id, itemName: item.name, size: input.size ?? null,
        qty: input.qty, unitKes: item.sellPriceKes, totalKes,
        invoiceId: invoice.id, placedById: user.id,
      },
    });

    // Relay to the supplier/tailor (SMS seam) if the school has set one.
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    let supplierNotified = false;
    if (tenant.uniformSupplierPhone) {
      try {
        await sendSms(
          tenant.uniformSupplierPhone,
          `${tenant.name} uniform order ${orderNo}: ${item.name} × ${input.qty}${input.size ? ` (${input.size})` : ""} for ${fullName(student)} (${student.admissionNo}). Deliver to the school office.`
        );
        supplierNotified = true;
        await tenantDb().uniformOrder.update({ where: { id: order.id }, data: { status: "SENT_TO_SUPPLIER" } });
      } catch { /* stays PLACED; staff can resend */ }
    }

    await audit(user, "uniform.ordered", "uniformOrder", order.id, { orderNo, item: item.name, qty: input.qty, totalKes, invoiceNo, supplierNotified });
    return { orderId: order.id, orderNo, invoiceId: invoice.id, invoiceNo, totalKes, supplierNotified, supplierName: tenant.uniformSupplierName ?? null };
  });
}

/** Family side: my children's orders. Staff side: all orders. */
export async function listOrders(user: SessionUser, mineOnly: boolean) {
  return withTenant(user.tenantId, async () => {
    let where: Record<string, unknown> = {};
    if (mineOnly) {
      const scope = await scopeWhere(user);
      const kids = await tenantDb().student.findMany({ where: scope as never, select: { id: true } });
      where = { studentId: { in: kids.map((k) => k.id) } };
    }
    const orders = await tenantDb().uniformOrder.findMany({ where, orderBy: { placedAt: "desc" }, take: 50 });
    const invoiceIds = orders.map((o) => o.invoiceId);
    const invoices = invoiceIds.length
      ? await tenantDb().invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, status: true } })
      : [];
    const iMap = new Map(invoices.map((i) => [i.id, i.status]));
    return orders.map((o) => ({
      id: o.id, orderNo: o.orderNo, studentName: o.studentName, admissionNo: o.admissionNo,
      itemName: o.itemName, size: o.size, qty: o.qty, totalKes: o.totalKes,
      status: o.status, invoiceStatus: iMap.get(o.invoiceId) ?? "—", placedAt: o.placedAt,
    }));
  });
}

/** Staff: mark an order delivered at school (also depletes stock + SALE movement). */
export async function markDelivered(user: SessionUser, orderId: string) {
  return withTenant(user.tenantId, async () => {
    const order = await tenantDb().uniformOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new UniformError("NOT_FOUND", "Order not found.");
    if (order.status === "DELIVERED") throw new UniformError("ALREADY", "Already delivered.");

    const item = await tenantDb().stockItem.findUnique({ where: { id: order.itemId } });
    if (item && item.qty >= order.qty) {
      await tenantDb().stockItem.update({ where: { id: item.id }, data: { qty: { decrement: order.qty } } });
      // B.25: also deduct the per-size row when the order names a size.
      if (order.size) {
        const sizeRow = await tenantDb().uniformSize.findFirst({
          where: { itemId: item.id, size: order.size },
        });
        if (sizeRow && sizeRow.qty >= order.qty) {
          await tenantDb().uniformSize.update({
            where: { id: sizeRow.id },
            data: { qty: { decrement: order.qty } },
          });
        }
      }
      await db.stockMovement.create({
        data: {
          tenantId: user.tenantId, itemId: item.id, type: "SALE", qty: order.qty,
          reason: `Uniform order ${order.orderNo} delivered`,
          studentId: order.studentId, studentName: order.studentName,
          invoiceId: order.invoiceId, byId: user.id, byName: user.fullName,
        },
      });
    }
    const row = await tenantDb().uniformOrder.update({
      where: { id: orderId }, data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    await audit(user, "uniform.delivered", "uniformOrder", orderId, { orderNo: order.orderNo });
    return row;
  });
}

// ---------------------------------------------------------------------------
// B.25 Uniform Management — per-size stock (UniformSize splits StockItem.qty).
// ---------------------------------------------------------------------------

export const UNIFORM_SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

/** Staff: set/replace the stock count for one size of a uniform item. */
export async function setSizeStock(user: SessionUser, input: { itemId: string; size: string; qty: number }) {
  return withTenant(user.tenantId, async () => {
    const item = await tenantDb().stockItem.findUnique({ where: { id: input.itemId } });
    if (!item || item.category !== "Uniform")
      throw new UniformError("NOT_FOUND", "That item is not in the uniform catalogue.");
    const size = input.size.trim();
    if (!size) throw new UniformError("INVALID", "Size is required (e.g. M, Size 30).");
    if (input.qty < 0) throw new UniformError("INVALID", "Quantity cannot be negative.");

    const row = await db.uniformSize.upsert({
      where: { tenantId_itemId_size: { tenantId: user.tenantId, itemId: item.id, size } },
      create: { tenantId: user.tenantId, itemId: item.id, size, qty: input.qty },
      update: { qty: input.qty },
    });
    // Keep the master StockItem.qty = sum of size rows (one stock truth).
    const sum = await db.uniformSize.aggregate({ _sum: { qty: true }, where: { tenantId: user.tenantId, itemId: item.id } });
    await tenantDb().stockItem.update({ where: { id: item.id }, data: { qty: sum._sum.qty ?? 0 } });
    await audit(user, "uniform.size_stock_set", "uniformSize", row.id, { item: item.name, size, qty: input.qty });
    return row;
  });
}

/** Sizes + stock per uniform item (staff board + family order dialog). */
export async function sizeBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const items = await tenantDb().stockItem.findMany({
      where: { archived: false, category: "Uniform" },
      orderBy: { name: "asc" },
    });
    const sizes = await tenantDb().uniformSize.findMany({
      where: { itemId: { in: items.map((i) => i.id) } },
      orderBy: { size: "asc" },
    });
    return items.map((i) => ({
      id: i.id, name: i.name, priceKes: i.sellPriceKes, imageUrl: i.imageUrl,
      totalQty: i.qty,
      sizes: sizes.filter((s) => s.itemId === i.id).map((s) => ({ id: s.id, size: s.size, qty: s.qty })),
    }));
  });
}
