/**
 * Storage service (Feature A.9).
 * - Tenant-isolated keys: tenants/<tenantId>/<category>/<uuid>.<ext>
 * - Presigned direct-browser upload (R2 in prod, local PUT endpoint in dev).
 * - Server-side image processing: resize + EXIF strip (sharp) for privacy.
 * - Records every file in StoredFile (tenant-owned).
 */
import crypto from "crypto";
import path from "path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { encryptBufferForTenant, decryptBufferForTenant } from "@/lib/services/encryption.service";
import { STORAGE_CONFIGURED } from "@/lib/storage/provider";
import { R2Provider } from "@/lib/storage/r2-provider";
import { LocalProvider } from "@/lib/storage/local-provider";

const provider = STORAGE_CONFIGURED ? new R2Provider() : new LocalProvider();

export class StorageError extends Error {
  constructor(public code: "TOO_LARGE" | "BAD_TYPE" | "NOT_FOUND", message: string) {
    super(message);
    this.name = "StorageError";
  }
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  // B.13 LMS notes: Word documents (PDF, DOC per checklist).
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extFor(contentType: string, fileName: string): string {
  const fromName = path.extname(fileName).toLowerCase();
  if (fromName) return fromName;
  return contentType === "image/png"
    ? ".png"
    : contentType === "image/webp"
      ? ".webp"
      : contentType === "application/pdf"
        ? ".pdf"
        : contentType === "application/msword"
          ? ".doc"
          : contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ? ".docx"
            : ".jpg";
}

/** Build a tenant-isolated object key. */
export function buildKey(
  tenantId: string,
  category: string,
  contentType: string,
  fileName: string
): string {
  const id = crypto.randomBytes(12).toString("hex");
  return `tenants/${tenantId}/${category}/${id}${extFor(contentType, fileName)}`;
}

async function providerNameForTenant(tenantId: string) {
  const row = await db.tenantStorageProvider.findUnique({ where: { tenantId } }).catch(() => null);
  return row?.provider ?? provider.key.toUpperCase();
}

/** Step 1: presign a direct-browser upload. */
export async function presignUpload(
  tenantId: string,
  input: { fileName: string; contentType: string; category?: string }
) {
  if (!ALLOWED.has(input.contentType)) {
    throw new StorageError("BAD_TYPE", "Only images (JPG/PNG/WebP) and PDF are allowed.");
  }
  const category = input.category ?? "general";
  const key = buildKey(tenantId, category, input.contentType, input.fileName);
  const presign = await provider.presignUpload(key, input.contentType);
  return { ...presign, category };
}

/** Step 2: record a file in the DB after the browser uploaded it. */
export async function recordFile(
  tenantId: string,
  uploadedById: string,
  input: {
    key: string;
    fileName: string;
    contentType: string;
    size: number;
    category?: string;
  }
) {
  if (input.size > MAX_BYTES) {
    await provider.deleteObject(input.key);
    throw new StorageError("TOO_LARGE", "Files must be 10MB or smaller.");
  }
  return db.storedFile.create({
    data: {
      tenantId,
      key: input.key,
      url: provider.publicUrl(input.key),
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.size,
      category: input.category ?? "general",
      provider: provider.key.toUpperCase(),
      encrypted: false,
      uploadedById,
    },
  });
}

/**
 * Server-side upload for IMAGES with resize + EXIF strip (privacy).
 * Used for avatars/photos where we want a normalized, metadata-free image.
 */
export async function uploadProcessedImage(
  tenantId: string,
  uploadedById: string,
  input: { buffer: Buffer; fileName: string; contentType: string; category?: string; maxDim?: number }
) {
  if (!IMAGE_TYPES.has(input.contentType)) {
    throw new StorageError("BAD_TYPE", "Only image files can be processed.");
  }
  if (input.buffer.length > MAX_BYTES) {
    throw new StorageError("TOO_LARGE", "Image must be 10MB or smaller.");
  }

  const maxDim = input.maxDim ?? 1200;
  // resize (fit inside maxDim) + re-encode to JPEG. Re-encoding DROPS EXIF,
  // and we don't call withMetadata(), so no metadata is carried over.
  const processed = await sharp(input.buffer)
    .rotate() // apply orientation BEFORE stripping, so the image looks right
    .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const category = input.category ?? "image";
  return uploadEncryptedFile(tenantId, uploadedById, {
    buffer: processed,
    fileName: input.fileName.replace(/\.[^.]+$/, "") + ".jpg",
    contentType: "image/jpeg",
    category,
  });
}


/** Server-side encrypted upload for documents/images. Plaintext never leaves NEYO. */
export async function uploadEncryptedFile(
  tenantId: string,
  uploadedById: string,
  input: { buffer: Buffer; fileName: string; contentType: string; category?: string }
) {
  if (!ALLOWED.has(input.contentType)) {
    throw new StorageError("BAD_TYPE", "Only images (JPG/PNG/WebP), PDF, DOC and DOCX are allowed.");
  }
  if (input.buffer.length > MAX_BYTES) {
    throw new StorageError("TOO_LARGE", "Files must be 10MB or smaller.");
  }
  const category = input.category ?? "general";
  const key = buildKey(tenantId, category, input.contentType, input.fileName);
  const encrypted = await encryptBufferForTenant(tenantId, input.buffer);
  const { url } = await provider.putObject(key, encrypted.encrypted, "application/octet-stream");
  const providerName = await providerNameForTenant(tenantId);
  return db.storedFile.create({
    data: {
      tenantId,
      key,
      url,
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.buffer.length,
      category,
      provider: providerName,
      providerObjectId: key,
      encrypted: true,
      encryptionMode: encrypted.encryptionMode,
      checksumSha256: encrypted.checksumSha256,
      wrappedKeyRef: encrypted.wrappedKeyRef,
      uploadedById,
    },
  });
}

/** Dev-only: accept a raw PUT body and store it (local provider path). */
export async function devPut(key: string, body: Buffer, contentType: string) {
  await provider.putObject(key, body, contentType);
}

/**
 * Store a SERVER-GENERATED artifact (e.g. a KNEC export manifest, K.16).
 * Unlike user uploads this is not type-restricted to images/PDF — it is produced
 * by NEYO itself. The bytes are encrypted with the tenant key and recorded in
 * StoredFile so the Storage Vault still owns them. Returns the stored file row.
 */
export async function storeGeneratedArtifact(
  tenantId: string,
  uploadedById: string,
  input: { buffer: Buffer; fileName: string; contentType: string; category?: string }
) {
  if (input.buffer.length > MAX_BYTES) {
    throw new StorageError("TOO_LARGE", "Generated artifact exceeds 10MB.");
  }
  const category = input.category ?? "generated";
  const key = buildKey(tenantId, category, input.contentType, input.fileName);
  const encrypted = await encryptBufferForTenant(tenantId, input.buffer);
  const { url } = await provider.putObject(key, encrypted.encrypted, "application/octet-stream");
  const providerName = await providerNameForTenant(tenantId);
  return db.storedFile.create({
    data: {
      tenantId,
      key,
      url,
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.buffer.length,
      category,
      provider: providerName,
      providerObjectId: key,
      encrypted: true,
      encryptionMode: encrypted.encryptionMode,
      checksumSha256: encrypted.checksumSha256,
      wrappedKeyRef: encrypted.wrappedKeyRef,
      uploadedById,
    },
  });
}

/** Read an object's bytes (serving). */
export async function readObject(key: string) {
  const obj = await provider.getObject(key);
  if (!obj) throw new StorageError("NOT_FOUND", "File not found.");
  const file = await db.storedFile.findUnique({ where: { key }, select: { tenantId: true, encrypted: true, contentType: true } }).catch(() => null);
  if (file?.encrypted) {
    const body = await decryptBufferForTenant(file.tenantId, obj.body);
    return { body, contentType: file.contentType };
  }
  return obj;
}

/** Delete a file (DB + storage), tenant-checked. */
export async function deleteFile(tenantId: string, fileId: string) {
  const file = await db.storedFile.findFirst({ where: { id: fileId, tenantId } });
  if (!file) throw new StorageError("NOT_FOUND", "File not found.");
  await provider.deleteObject(file.key);
  await db.storedFile.delete({ where: { id: file.id } });
}

export const STORAGE_BACKEND = provider.key;
