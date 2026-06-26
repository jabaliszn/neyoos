import crypto from "crypto";
import { db } from "@/lib/db";
import { getKek } from "@/lib/crypto/kek";

const ALGO = "aes-256-gcm";

function maskSecret(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "";
  if (cleaned.includes("-----BEGIN")) return "•••• private key stored";
  if (cleaned.length <= 8) return "••••";
  return `${cleaned.slice(0, 4)}••••${cleaned.slice(-4)}`;
}

export async function saveCompanySecret(input: { key: string; provider: string; label: string; value: string; updatedBy: string }) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKek(), iv);
  const ciphertext = Buffer.concat([cipher.update(input.value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return db.neyoIntegrationSecret.upsert({
    where: { key: input.key },
    create: { key: input.key, provider: input.provider, label: input.label, ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64"), masked: maskSecret(input.value), updatedBy: input.updatedBy },
    update: { provider: input.provider, label: input.label, ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64"), masked: maskSecret(input.value), updatedBy: input.updatedBy },
  });
}

export async function readCompanySecret(key: string) {
  const row = await db.neyoIntegrationSecret.findUnique({ where: { key } });
  if (!row) return null;
  const decipher = crypto.createDecipheriv(ALGO, getKek(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export async function secretStatus(key: string) {
  const row = await db.neyoIntegrationSecret.findUnique({ where: { key }, select: { key: true, provider: true, label: true, masked: true, updatedAt: true, updatedBy: true } });
  return row;
}
