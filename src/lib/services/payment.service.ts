/**
 * Payment routing service (Feature A.6).
 * - Stores per-tenant Daraja credentials ENCRYPTED with the tenant DEK (A.2.7).
 * - Picks the provider (Daraja if configured, else dev mock).
 * - Initiates STK push, processes webhooks idempotently, queries status,
 *   and reconciles. mpesaRef is globally unique (no duplicate postings).
 */
import { db } from "@/lib/db";
import { encryptForTenant, decryptForTenant } from "@/lib/services/encryption.service";
import { DarajaProvider } from "@/lib/payments/daraja-provider";
import { MockProvider } from "@/lib/payments/mock-provider";
import type { PaymentProvider, ProviderCredentials } from "@/lib/payments/provider";

const daraja = new DarajaProvider();
const mock = new MockProvider();

export class PaymentError extends Error {
  constructor(
    public code: "NOT_CONFIGURED" | "STK_FAILED" | "NOT_FOUND" | "DUPLICATE",
    message: string
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

// --- Credentials ---

export interface SaveCredsInput {
  shortcode: string;
  environment: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
}

/** Save (encrypted) Daraja credentials for a tenant. */
export async function savePaymentCredentials(
  tenantId: string,
  input: SaveCredsInput
): Promise<void> {
  const [ck, cs, pk] = await Promise.all([
    encryptForTenant(tenantId, input.consumerKey),
    encryptForTenant(tenantId, input.consumerSecret),
    encryptForTenant(tenantId, input.passkey),
  ]);
  await db.paymentCredential.upsert({
    where: { tenantId },
    update: {
      provider: "mpesa_daraja",
      shortcode: input.shortcode,
      environment: input.environment,
      consumerKeyEnc: ck,
      consumerSecretEnc: cs,
      passkeyEnc: pk,
      isActive: true,
    },
    create: {
      tenantId,
      provider: "mpesa_daraja",
      shortcode: input.shortcode,
      environment: input.environment,
      consumerKeyEnc: ck,
      consumerSecretEnc: cs,
      passkeyEnc: pk,
      isActive: true,
    },
  });
}

/** Non-secret status of a tenant's payment config (for the settings UI). */
export async function getPaymentConfigStatus(tenantId: string) {
  const c = await db.paymentCredential.findUnique({ where: { tenantId } });
  return {
    configured: Boolean(c?.isActive),
    provider: c?.provider ?? "mpesa_daraja",
    shortcode: c?.shortcode ?? null,
    environment: c?.environment ?? "sandbox",
  };
}

/** Resolve + decrypt a tenant's credentials, or null if not configured. */
async function resolveCredentials(
  tenantId: string
): Promise<ProviderCredentials | null> {
  const c = await db.paymentCredential.findUnique({ where: { tenantId } });
  if (
    !c ||
    !c.isActive ||
    !c.consumerKeyEnc ||
    !c.consumerSecretEnc ||
    !c.passkeyEnc ||
    !c.shortcode
  ) {
    return null;
  }
  const [consumerKey, consumerSecret, passkey] = await Promise.all([
    decryptForTenant(tenantId, c.consumerKeyEnc),
    decryptForTenant(tenantId, c.consumerSecretEnc),
    decryptForTenant(tenantId, c.passkeyEnc),
  ]);
  return {
    shortcode: c.shortcode,
    environment: (c.environment as "sandbox" | "production") ?? "sandbox",
    consumerKey,
    consumerSecret,
    passkey,
  };
}

/** Pick provider: real Daraja if creds exist; dev mock otherwise. */
async function pickProvider(
  tenantId: string
): Promise<{ provider: PaymentProvider; creds: ProviderCredentials }> {
  const creds = await resolveCredentials(tenantId);
  if (creds) return { provider: daraja, creds };

  // Dev fallback so the flow is testable without real creds.
  if (process.env.NODE_ENV !== "production") {
    return {
      provider: mock,
      creds: {
        shortcode: "174379",
        environment: "sandbox",
        consumerKey: "mock",
        consumerSecret: "mock",
        passkey: "mock",
      },
    };
  }
  throw new PaymentError(
    "NOT_CONFIGURED",
    "This school hasn't set up M-Pesa payments yet."
  );
}

// --- STK push ---

export interface InitiateStkInput {
  amount: number;
  phone: string;
  accountRef: string;
  description: string;
}

export async function initiateStkPush(
  tenantId: string,
  input: InitiateStkInput
) {
  const { provider, creds } = await pickProvider(tenantId);

  const payment = await db.payment.create({
    data: {
      tenantId,
      provider: provider.key,
      amount: input.amount,
      phone: input.phone,
      accountRef: input.accountRef,
      description: input.description,
      status: "PENDING",
    },
  });

  const result = await provider.stkPush(creds, input);
  if (!result.ok || !result.checkoutRequestId) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", resultDesc: result.message },
    });
    throw new PaymentError("STK_FAILED", result.message);
  }

  await db.payment.update({
    where: { id: payment.id },
    data: { checkoutRequestId: result.checkoutRequestId },
  });

  return { paymentId: payment.id, checkoutRequestId: result.checkoutRequestId };
}

/**
 * Process a provider callback IDEMPOTENTLY.
 * - Correlates by checkoutRequestId.
 * - Refuses to double-post the same mpesaRef (globally-unique constraint + guard).
 */
export async function handleCallback(
  providerKey: string,
  body: unknown
): Promise<{ matched: boolean; status?: string }> {
  const provider = providerKey === "mock" ? mock : daraja;
  const parsed = provider.parseCallback(body);

  if (!parsed.checkoutRequestId) return { matched: false };

  const payment = await db.payment.findUnique({
    where: { checkoutRequestId: parsed.checkoutRequestId },
  });
  if (!payment) return { matched: false };

  // Idempotency: if already finalized, do nothing.
  if (payment.status === "PAID" || payment.status === "FAILED") {
    return { matched: true, status: payment.status };
  }

  // Guard against a duplicate mpesaRef arriving on a different payment.
  if (parsed.mpesaRef) {
    const dup = await db.payment.findUnique({
      where: { mpesaRef: parsed.mpesaRef },
    });
    if (dup && dup.id !== payment.id) {
      throw new PaymentError("DUPLICATE", "This M-Pesa reference is already recorded.");
    }
  }

  const updated = await db.payment.update({
    where: { id: payment.id },
    data: {
      status: parsed.status,
      mpesaRef: parsed.status === "PAID" ? parsed.mpesaRef : null,
      resultCode: parsed.resultCode,
      resultDesc: parsed.resultDesc,
      rawCallback: JSON.stringify(body),
      paidAt: parsed.status === "PAID" ? new Date() : null,
    },
  });

  await db.auditLog.create({
    data: {
      tenantId: payment.tenantId,
      actorName: "M-Pesa",
      action: parsed.status === "PAID" ? "payment.received" : "payment.failed",
      entityType: "Payment",
      entityId: payment.id,
      metadata: JSON.stringify({ mpesaRef: parsed.mpesaRef, amount: payment.amount }),
    },
  });

  // B.7/I.75: apply invoice-linked payments to the fee ledger + receipt SMS.
  // If a raw Paybill payment arrives with accountRef = either NEYO admission no
  // OR the school's own legacy admission no, match it carefully to the oldest
  // open invoice for that learner before running the invoice hook.
  if (parsed.status === "PAID") {
    if (!updated.invoiceId && updated.accountRef) {
      const ref = updated.accountRef.trim();
      const student = await db.student.findFirst({
        where: {
          tenantId: updated.tenantId,
          deletedAt: null,
          OR: [{ admissionNo: ref }, { legacyAdmissionNo: ref }],
        },
        select: { id: true },
      });
      if (student) {
        const invoice = await db.invoice.findFirst({
          where: { tenantId: updated.tenantId, studentId: student.id, status: { in: ["UNPAID", "PARTIAL"] } },
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        });
        if (invoice) {
          await db.payment.update({ where: { id: updated.id }, data: { invoiceId: invoice.id } });
          updated.invoiceId = invoice.id;
        }
      }
    }
    // SaaS Subscription Automated Reactivation
    if (payment.description?.startsWith("SaaS Subscription")) {
      await db.subscription.update({
        where: { tenantId: payment.tenantId },
        data: {
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 120 * 24 * 3600_000), // Extends subscription for 4 months (one full term)
          graceEndsAt: null,
        },
      }).catch(() => null);
    }

    const { onPaymentPaid } = await import("@/lib/services/finance.service");
    await onPaymentPaid(payment.id).catch(() => null); // ledger hook must not break the webhook
  }

  return { matched: true, status: updated.status };
}

/** Daraja Transaction Status Query (A.6) — poll a pending payment. */
export async function queryPaymentStatus(tenantId: string, paymentId: string) {
  const payment = await db.payment.findFirst({
    where: { id: paymentId, tenantId },
  });
  if (!payment) throw new PaymentError("NOT_FOUND", "Payment not found.");
  if (payment.status !== "PENDING" || !payment.checkoutRequestId) {
    return { status: payment.status, mpesaRef: payment.mpesaRef };
  }

  const { provider, creds } = await pickProvider(tenantId);
  const result = await provider.queryStatus(creds, payment.checkoutRequestId);

  if (result.status !== "PENDING") {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: result.status,
        mpesaRef: result.status === "PAID" ? result.mpesaRef ?? null : null,
        resultCode: result.resultCode,
        resultDesc: result.resultDesc,
        paidAt: result.status === "PAID" ? new Date() : null,
      },
    });
  }
  return { status: result.status, mpesaRef: result.mpesaRef };
}

/** Reconciliation snapshot for a tenant (A.6 Paybill reconciliation). */
export async function reconcile(tenantId: string) {
  const [paid, pending, failed, total] = await Promise.all([
    db.payment.aggregate({
      where: { tenantId, status: "PAID" },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.count({ where: { tenantId, status: "PENDING" } }),
    db.payment.count({ where: { tenantId, status: "FAILED" } }),
    db.payment.count({ where: { tenantId } }),
  ]);
  return {
    totalPayments: total,
    paidCount: paid._count,
    paidAmount: paid._sum.amount ?? 0,
    pendingCount: pending,
    failedCount: failed,
  };
}

/** List recent payments for a tenant (for the finance list + export). */
export async function listPayments(tenantId: string, limit = 100) {
  const rows = await db.payment.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((p) => ({
    id: p.id,
    payer: p.accountRef ?? "—",
    phone: p.phone,
    amount: p.amount,
    description: p.description ?? "",
    status: p.status,
    mpesaRef: p.mpesaRef ?? "",
    date: p.createdAt.toISOString(),
  }));
}
