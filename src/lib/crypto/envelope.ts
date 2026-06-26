/**
 * Field-level encryption with a tenant DEK (Feature A.2.7).
 * AES-256-GCM. The output is a single self-describing string so callers store
 * just one column:  v1:<iv>:<tag>:<ciphertext>  (all base64).
 */
import crypto from "crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "v1";

/** Generate a fresh 32-byte DEK. */
export function generateDek(): Buffer {
  return crypto.randomBytes(32);
}

/** Encrypt a UTF-8 string with a DEK -> compact string. */
export function encryptWithDek(dek: Buffer, plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, dek, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

/** Decrypt a string produced by encryptWithDek. */
export function decryptWithDek(dek: Buffer, encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Malformed ciphertext.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv(
    ALGO,
    dek,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
