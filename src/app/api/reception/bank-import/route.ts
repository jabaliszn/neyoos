import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";
import { recordWalkInPayment } from "@/lib/services/reception.service";

export const dynamic = "force-dynamic";

const rowSchema = z.object({
  ref: z.string().trim().min(1),
  amount: z.coerce.number().int().min(1),
  phone: z.string().trim().default("0700000000"),
  accountRef: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => obj[h] = cells[i] ?? "");
    return {
      ref: obj.ref || obj.reference || obj["bank ref"] || obj["transaction ref"],
      amount: obj.amount || obj["amount kes"] || obj.kes,
      phone: obj.phone || obj.mobile || "0700000000",
      accountRef: obj.accountref || obj["account ref"] || obj.invoice || obj.admission,
      description: obj.description || "Bank statement import",
    };
  });
}

async function findInvoice(tenantId: string, accountRef?: string | null) {
  if (!accountRef) return null;
  const ref = accountRef.trim();
  const invoice = await db.invoice.findFirst({ where: { tenantId, invoiceNo: ref } });
  if (invoice) return invoice;
  const student = await db.student.findFirst({ where: { tenantId, OR: [{ admissionNo: ref }, { legacyAdmissionNo: ref }] }, select: { id: true } });
  if (!student) return null;
  return db.invoice.findFirst({ where: { tenantId, studentId: student.id, status: { in: ["UNPAID", "PARTIAL"] } }, orderBy: { dueDate: "asc" } });
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("reception.operate", "finance.record_payment");
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows : parseCsv(String(body.csv || ""));
    let imported = 0, duplicates = 0, reconciled = 0;
    const details: unknown[] = [];
    for (const raw of rows) {
      const row = rowSchema.parse(raw);
      const dup = await db.payment.findUnique({ where: { mpesaRef: row.ref } });
      if (dup) { duplicates++; continue; }
      const inv = await findInvoice(user.tenantId, row.accountRef);
      const payment = await recordWalkInPayment(user.tenantId, { amount: row.amount, phone: row.phone, method: "bank", accountRef: row.accountRef, mpesaRef: row.ref, description: row.description }, { id: user.id, name: user.fullName });
      imported++;
      if (inv) {
        await db.payment.update({ where: { id: payment.id }, data: { invoiceId: inv.id } });
        const { onPaymentPaid } = await import("@/lib/services/finance.service");
        await onPaymentPaid(payment.id);
        reconciled++;
      }
      details.push({ ref: row.ref, paymentId: payment.id, invoiceId: inv?.id ?? null });
    }
    return ok({ imported, duplicates, reconciled, details });
  } catch (e) { return handleError(e); }
}
