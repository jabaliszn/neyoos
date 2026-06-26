import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";

const DEFAULT_CONTRACT_BODY = `NEYO School OS Subscription Agreement

This agreement is between NEYO and the school named above.

1. NEYO provides School OS access, support and product updates according to the selected package.
2. School data remains the school's data. NEYO protects it according to the Privacy Policy and Terms.
3. Subscription pricing follows the agreed NEYO package. Existing locked prices remain grandfathered unless NEYO and the school agree otherwise.
4. SMS is purchased separately as an out-of-package top-up and is not included inside the base package.
5. Non-payment follows the published grace-period and suspension policy. Data is preserved; NEYO does not delete school records because of non-payment.
6. The school confirms that the signer is authorized to accept this agreement.

By typing their name and role, the signer accepts this agreement for the school.`;

export const neyoContractSchema = z.object({
  title: z.string().trim().min(3).max(180),
  schoolName: z.string().trim().min(2).max(160),
  tenantId: z.string().trim().max(80).optional().or(z.literal("")),
  contactName: z.string().trim().min(2).max(120),
  contactRole: z.string().trim().max(80).optional().or(z.literal("")),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  templateKey: z.enum(["SCHOOL_ONBOARDING", "RENEWAL", "DATA_PROCESSING", "CUSTOM"]).default("SCHOOL_ONBOARDING"),
  body: z.string().trim().min(20).max(12000).default(DEFAULT_CONTRACT_BODY),
  status: z.enum(["DRAFT", "SENT", "SIGNED", "VOID"]).default("DRAFT"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const neyoContractStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["DRAFT", "SENT", "SIGNED", "VOID"]),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const publicContractSignSchema = z.object({
  signedByName: z.string().trim().min(2).max(120),
  signedByRole: z.string().trim().min(2).max(80),
  signatureText: z.string().trim().min(2).max(120),
  accepted: z.literal(true),
});

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function token() {
  return `ctr_${crypto.randomBytes(18).toString("hex")}`;
}

export function defaultContractBody() {
  return DEFAULT_CONTRACT_BODY;
}

export async function listNeyoContracts(limit = 80) {
  return db.neyoContract.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }], take: limit });
}

export async function upsertNeyoContract(actor: { id: string; fullName: string; tenantId: string }, input: z.infer<typeof neyoContractSchema>, id?: string) {
  const data = neyoContractSchema.parse(input);
  const payload = {
    title: data.title,
    schoolName: data.schoolName,
    tenantId: clean(data.tenantId),
    contactName: data.contactName,
    contactRole: clean(data.contactRole),
    contactEmail: clean(data.contactEmail),
    contactPhone: clean(data.contactPhone),
    templateKey: data.templateKey,
    body: data.body || DEFAULT_CONTRACT_BODY,
    status: data.status,
    sentAt: data.status === "SENT" ? new Date() : undefined,
    notes: clean(data.notes),
  };
  const row = id
    ? await db.neyoContract.update({ where: { id }, data: payload })
    : await db.neyoContract.create({ data: { ...payload, publicToken: token(), createdById: actor.id, createdByName: actor.fullName } });

  await db.auditLog.create({ data: { tenantId: actor.tenantId, actorId: actor.id, actorName: actor.fullName, action: id ? "platform.contract_updated" : "platform.contract_created", entityType: "NeyoContract", entityId: row.id, metadata: JSON.stringify({ title: row.title, schoolName: row.schoolName, status: row.status }) } });
  return row;
}

export async function updateNeyoContractStatus(actor: { id: string; fullName: string; tenantId: string }, input: z.infer<typeof neyoContractStatusSchema>) {
  const data = neyoContractStatusSchema.parse(input);
  const row = await db.neyoContract.update({
    where: { id: data.id },
    data: { status: data.status, sentAt: data.status === "SENT" ? new Date() : undefined, notes: clean(data.notes) ?? undefined },
  });
  await db.auditLog.create({ data: { tenantId: actor.tenantId, actorId: actor.id, actorName: actor.fullName, action: "platform.contract_status_updated", entityType: "NeyoContract", entityId: row.id, metadata: JSON.stringify({ status: row.status }) } });
  return row;
}

export async function publicContract(tokenValue: string) {
  const row = await db.neyoContract.findUnique({ where: { publicToken: tokenValue } });
  if (!row || row.status === "VOID") return null;
  return row;
}

export async function signPublicContract(tokenValue: string, input: z.infer<typeof publicContractSignSchema>, signerIp?: string | null) {
  const data = publicContractSignSchema.parse(input);
  const existing = await publicContract(tokenValue);
  if (!existing) throw new Error("Contract not found or no longer available.");
  if (existing.status === "SIGNED") throw new Error("This contract has already been signed.");
  const row = await db.neyoContract.update({
    where: { publicToken: tokenValue },
    data: { status: "SIGNED", signedAt: new Date(), signedByName: data.signedByName, signedByRole: data.signedByRole, signatureText: data.signatureText, signerIp: signerIp || null },
  });
  const auditTenantId = existing.tenantId || (await db.tenant.findFirst({ select: { id: true } }))?.id;
  if (auditTenantId) {
    await db.auditLog.create({ data: { tenantId: auditTenantId, actorId: null, actorName: data.signedByName, action: "platform.contract_signed", entityType: "NeyoContract", entityId: row.id, metadata: JSON.stringify({ schoolName: row.schoolName, signedByRole: row.signedByRole }) } });
  }
  return row;
}

export async function deleteNeyoContract(actor: { id: string; fullName: string; tenantId: string }, id: string) {
  const row = await db.neyoContract.delete({ where: { id } });
  await db.auditLog.create({ data: { tenantId: actor.tenantId, actorId: actor.id, actorName: actor.fullName, action: "platform.contract_deleted", entityType: "NeyoContract", entityId: row.id, metadata: JSON.stringify({ title: row.title, schoolName: row.schoolName }) } });
  return { success: true };
}
