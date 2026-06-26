/**
 * Master Key-Encryption-Key handling (Feature A.2.7).
 *
 * The KEK encrypts ("wraps") each tenant's Data-Encryption-Key (DEK).
 * DEV: KEK is a 32-byte base64 value in env NEYO_MASTER_KEK.
 * PROD: store/derive the KEK in a real KMS (AWS KMS / Cloudflare / Vault) and
 *       have getKek() fetch it there — the rest of the code is unchanged.
 *
 * Algorithm: AES-256-GCM (authenticated encryption).
 */
import crypto from "crypto";

const ALGO = "aes-256-gcm";

/** Load + validate the 32-byte master KEK. Fails loudly if misconfigured. */
export function getKek(): Buffer {
  const raw = process.env.NEYO_MASTER_KEK;
  if (!raw) {
    throw new Error(
      "NEYO_MASTER_KEK is not set. Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `NEYO_MASTER_KEK must decode to 32 bytes (got ${key.length}). It should be base64 of 32 random bytes.`
    );
  }
  return key;
}

export interface WrappedKey {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
}

/** Wrap a DEK with a SPECIFIC key (used by rotation). */
export function wrapWithKeyExplicit(dek: Buffer, kek: Buffer): WrappedKey {
  const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
  const cipher = crypto.createCipheriv(ALGO, kek, iv);
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/** Unwrap a DEK with a SPECIFIC key (used by rotation). */
export function unwrapWithKeyExplicit(wrapped: WrappedKey, kek: Buffer): Buffer {
  const decipher = crypto.createDecipheriv(
    ALGO,
    kek,
    Buffer.from(wrapped.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(wrapped.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(wrapped.ciphertext, "base64")),
    decipher.final(),
  ]);
}

/** Encrypt (wrap) a raw DEK with the current master KEK. */
export function wrapWithKek(dek: Buffer): WrappedKey {
  return wrapWithKeyExplicit(dek, getKek());
}

/** Decrypt (unwrap) a DEK with the current master KEK. */
export function unwrapWithKek(wrapped: WrappedKey): Buffer {
  return unwrapWithKeyExplicit(wrapped, getKek());
}
