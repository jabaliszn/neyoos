import { db } from "@/lib/db";
import { MockProvider } from "@/lib/payments/mock-provider";
import { DarajaProvider } from "@/lib/payments/daraja-provider";
import type { PaymentProvider, ProviderCredentials } from "@/lib/payments/provider";
import { appBaseUrl } from "@/lib/notifications/email";
import { getPlanFromCatalog } from "@/lib/services/pricing-catalog.service";
import { readCompanySecret, secretStatus } from "@/lib/services/company-secret.service";
import { DEFAULT_PLAN_KEY } from "@/lib/core/plans";

const TERM_DAYS = 120;
const mock = new MockProvider();
const daraja = new DarajaProvider();

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

async function secretOrEnv(key: string, envName: string) {
  return (await readCompanySecret(key)) || process.env[envName] || "";
}

async function centralCreds(): Promise<ProviderCredentials | null> {
  const shortcode = await secretOrEnv("central_daraja_shortcode", "NEYO_MPESA_SHORTCODE");
  const environmentRaw = (await secretOrEnv("central_daraja_environment", "NEYO_MPESA_ENVIRONMENT")) || "sandbox";
  const consumerKey = await secretOrEnv("central_daraja_consumer_key", "NEYO_DARAJA_CONSUMER_KEY");
  const consumerSecret = await secretOrEnv("central_daraja_consumer_secret", "NEYO_DARAJA_CONSUMER_SECRET");
  const passkey = await secretOrEnv("central_daraja_passkey", "NEYO_DARAJA_PASSKEY");
  if (!shortcode || !consumerKey || !consumerSecret || !passkey) return null;
  return {
    shortcode,
    environment: environmentRaw === "production" ? "production" : "sandbox",
    consumerKey,
    consumerSecret,
    passkey,
  };
}

async function centralGateway(): Promise<{ provider: PaymentProvider; creds: ProviderCredentials; live: boolean; source: "neyo_ops_vault" | "env" | "dev_mock" }> {
  const creds = await centralCreds();
  if (creds) {
    const vaultConfigured = Boolean(await secretStatus("central_daraja_consumer_key"));
    return { provider: daraja, creds, live: true, source: vaultConfigured ? "neyo_ops_vault" : "env" };
  }
  if (process.env.NODE_ENV !== "production") {
    return { provider: mock, creds: { shortcode: "174379", environment: "sandbox", consumerKey: "mock", consumerSecret: "mock", passkey: "mock" }, live: false, source: "dev_mock" };
  }
  throw new Error("NEYO central Daraja credentials are not configured in NEYO Ops.");
}

export async function getCentralBillingGatewayStatus() {
  const statuses = await Promise.all([
    secretStatus("central_daraja_shortcode"),
    secretStatus("central_daraja_environment"),
    secretStatus("central_daraja_consumer_key"),
    secretStatus("central_daraja_consumer_secret"),
    secretStatus("central_daraja_passkey"),
  ]);
  const configured = statuses.filter(Boolean).length;
  return {
    provider: "CENTRAL_DARAJA",
    configured,
    required: 5,
    liveReady: configured >= 4,
    source: configured > 0 ? "neyo_ops_vault" : process.env.NEYO_DARAJA_CONSUMER_KEY ? "env" : "dev_mock",
    callbackUrl: `${appBaseUrl()}/api/billing/central-callback`,
    masked: statuses.map((s) => s?.masked || null),
  };
}

export function centralAccountRef(slug: string) {
  return `NEYO-${slug.toUpperCase()}`.slice(0, 20);
}

export async function subscriptionRenewalAmount(tenantId: string) {
  const sub = await db.subscription.findUnique({ where: { tenantId } });
  if (sub?.grandfatheredPrice && sub.grandfatheredPrice > 0) return sub.grandfatheredPrice;
  const plan = await getPlanFromCatalog(sub?.planKey || DEFAULT_PLAN_KEY);
  return plan?.pricePerTerm && plan.pricePerTerm > 0 ? plan.pricePerTerm : 15000;
}

async function ensureSubscriptionForCentralPayment(tenantId: string) {
  const existing = await db.subscription.findUnique({ where: { tenantId } });
  if (existing) return existing;
  const plan = await getPlanFromCatalog(DEFAULT_PLAN_KEY);
  return db.subscription.create({
    data: {
      tenantId,
      planKey: plan?.key || DEFAULT_PLAN_KEY,
      status: "GRACE",
      grandfatheredPrice: plan?.pricePerTerm || 0,
      currentPeriodEnd: new Date(),
    },
  });
}

export async function initiateCentralSubscriptionStk(input: { tenantId: string; phone: string }) {
  const tenant = await db.tenant.findUnique({ where: { id: input.tenantId }, include: { subscription: true } });
  if (!tenant) throw new Error("School tenant not found.");
  const sub = await ensureSubscriptionForCentralPayment(tenant.id);
  const amount = await subscriptionRenewalAmount(tenant.id);
  const accountRef = centralAccountRef(tenant.slug);
  const periodStart = new Date();
  const periodEnd = addDays(periodStart, TERM_DAYS);

  const payment = await db.subscriptionPayment.create({
    data: {
      subscriptionId: sub.id,
      tenantId: tenant.id,
      amount,
      status: "PENDING",
      method: "central_mpesa_stk",
      phone: input.phone,
      accountRef,
      periodStart,
      periodEnd,
    },
  });

  const gateway = await centralGateway();
  const result = await gateway.provider.stkPush(gateway.creds, {
    amount,
    phone: input.phone,
    accountRef,
    description: `NEYO Subscription ${tenant.name}`.slice(0, 60),
    callbackUrl: `${appBaseUrl()}/api/billing/central-callback`,
  });
  if (!result.ok || !result.checkoutRequestId) {
    await db.subscriptionPayment.update({ where: { id: payment.id }, data: { status: "FAILED", resultDesc: result.message } });
    throw new Error(result.message || "Could not start central subscription payment.");
  }

  const updated = await db.subscriptionPayment.update({ where: { id: payment.id }, data: { checkoutRequestId: result.checkoutRequestId } });
  await db.auditLog.create({ data: { tenantId: tenant.id, actorName: "NEYO Billing", action: "billing.central_stk_started", entityType: "SubscriptionPayment", entityId: updated.id, metadata: JSON.stringify({ amount, accountRef, checkoutRequestId: result.checkoutRequestId, centralized: true, provider: gateway.provider.key, source: gateway.source, live: gateway.live }) } });
  return { payment: updated, checkoutRequestId: result.checkoutRequestId, amount, accountRef };
}

async function activateSubscriptionFromPayment(paymentId: string, mpesaRef: string | null, raw: unknown, resultCode = "0", resultDesc = "Success") {
  const payment = await db.subscriptionPayment.findUnique({ where: { id: paymentId }, include: { subscription: true } });
  if (!payment) return { matched: false };
  if (payment.status === "PAID") return { matched: true, status: "PAID", tenantId: payment.tenantId };

  if (mpesaRef) {
    const duplicate = await db.subscriptionPayment.findUnique({ where: { mpesaRef } });
    if (duplicate && duplicate.id !== payment.id) throw new Error("This M-Pesa reference is already recorded.");
  }

  const now = new Date();
  const periodEnd = addDays(now, TERM_DAYS);
  await db.$transaction([
    db.subscriptionPayment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: now, mpesaRef, resultCode, resultDesc, rawCallback: JSON.stringify(raw), periodStart: now, periodEnd } }),
    db.subscription.update({ where: { id: payment.subscriptionId }, data: { status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd, graceEndsAt: null } }),
  ]);
  await db.auditLog.create({ data: { tenantId: payment.tenantId, actorName: "NEYO Central M-Pesa", action: "billing.central_payment_reconnected", entityType: "SubscriptionPayment", entityId: payment.id, metadata: JSON.stringify({ mpesaRef, amount: payment.amount, centralized: true, reconnected: true }) } });
  return { matched: true, status: "PAID", tenantId: payment.tenantId };
}

function parseCentralCallback(body: unknown) {
  const b = body as any;
  if (b?.Body?.stkCallback) return daraja.parseCallback(body);
  return {
    checkoutRequestId: b?.checkoutRequestId || b?.CheckoutRequestID || null,
    status: (b?.success !== false && b?.ResultCode !== 1 && b?.resultCode !== "1" ? "PAID" : "FAILED") as "PAID" | "FAILED",
    mpesaRef: b?.mpesaRef || b?.MpesaReceiptNumber || b?.TransID || `CENTRAL${Date.now()}`,
    resultCode: String(b?.resultCode || b?.ResultCode || (b?.success === false ? "1" : "0")),
    resultDesc: b?.resultDesc || b?.ResultDesc || (b?.success === false ? "Failed" : "Success"),
  };
}

export async function handleCentralSubscriptionCallback(body: unknown) {
  const parsed = parseCentralCallback(body);
  if (parsed.status !== "PAID") {
    if (parsed.checkoutRequestId) {
      await db.subscriptionPayment.updateMany({ where: { checkoutRequestId: parsed.checkoutRequestId, status: "PENDING" }, data: { status: "FAILED", resultCode: parsed.resultCode, resultDesc: parsed.resultDesc, rawCallback: JSON.stringify(body) } });
    }
    return { matched: Boolean(parsed.checkoutRequestId), status: "FAILED" };
  }

  if (parsed.checkoutRequestId) {
    const payment = await db.subscriptionPayment.findUnique({ where: { checkoutRequestId: parsed.checkoutRequestId } });
    if (payment) return activateSubscriptionFromPayment(payment.id, parsed.mpesaRef, body, parsed.resultCode || "0", parsed.resultDesc || "Success");
  }

  const b = body as any;
  const rawRef = String(b?.accountRef || b?.BillRefNumber || b?.AccountReference || "").trim().toUpperCase();
  const slug = rawRef.replace(/^NEYO-/, "").toLowerCase();
  if (!slug) return { matched: false };
  const tenant = await db.tenant.findFirst({ where: { slug } });
  if (!tenant) return { matched: false };
  const sub = await ensureSubscriptionForCentralPayment(tenant.id);
  const amount = Number(b?.amount || b?.TransAmount || (await subscriptionRenewalAmount(tenant.id)));
  const now = new Date();
  const existing = parsed.mpesaRef ? await db.subscriptionPayment.findUnique({ where: { mpesaRef: parsed.mpesaRef } }).catch(() => null) : null;
  if (existing) return activateSubscriptionFromPayment(existing.id, parsed.mpesaRef, body, parsed.resultCode || "0", parsed.resultDesc || "Success");
  const created = await db.subscriptionPayment.create({ data: { subscriptionId: sub.id, tenantId: tenant.id, amount, status: "PENDING", method: "central_mpesa_c2b", phone: b?.phone || b?.MSISDN || null, accountRef: centralAccountRef(tenant.slug), periodStart: now, periodEnd: addDays(now, TERM_DAYS) } });
  return activateSubscriptionFromPayment(created.id, parsed.mpesaRef, body, parsed.resultCode || "0", parsed.resultDesc || "Success");
}
