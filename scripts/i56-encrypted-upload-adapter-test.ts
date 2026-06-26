import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { uploadEncryptedFile, readObject } from "../src/lib/services/storage.service";
import { ensureTenantDek } from "../src/lib/services/encryption.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const encryption = readFileSync(join(process.cwd(), "src/lib/services/encryption.service.ts"), "utf8");
  const storage = readFileSync(join(process.cwd(), "src/lib/services/storage.service.ts"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/files/encrypted/route.ts"), "utf8");
  const imageRoute = readFileSync(join(process.cwd(), "src/app/api/files/image/route.ts"), "utf8");
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

  assert(encryption.includes("encryptBufferForTenant") && encryption.includes("aes-256-gcm"), "Encryption service supports AES-256-GCM binary file encryption");
  assert(storage.includes("uploadEncryptedFile") && storage.includes("decryptBufferForTenant") && storage.includes("checksumSha256"), "Storage service has encrypted upload and decrypt-on-read adapter");
  assert(route.includes("/api/files/encrypted") || route.includes("server-side encrypted upload"), "Encrypted upload API route exists");
  assert(imageRoute.includes("uploadProcessedImage"), "Image upload route uses storage service; processed images are now encrypted by service");
  assert(schema.includes("encrypted    Boolean") && schema.includes("wrappedKeyRef"), "StoredFile schema tracks encrypted upload metadata");

  const user = await db.user.findFirst({ where: { role: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } } }) || await db.user.findFirst();
  assert(user, "Test user exists");
  await ensureTenantDek(user!.tenantId);

  const plaintext = Buffer.from("NEYO encrypted file adapter test — student document", "utf8");
  const file = await uploadEncryptedFile(user!.tenantId, user!.id, { buffer: plaintext, fileName: "encrypted-test.pdf", contentType: "application/pdf", category: "i56-test" });
  try {
    assert(file.encrypted === true && file.encryptionMode === "AES_256_GCM_ENVELOPE" && file.wrappedKeyRef === "tenant-dek:v1", "Uploaded file row records encryption metadata");
    assert(Boolean(file.checksumSha256) && file.size === plaintext.length, "Uploaded file row records plaintext checksum and original size");
    const served = await readObject(file.key);
    assert(served.contentType === "application/pdf" && served.body.equals(plaintext), "readObject decrypts encrypted blobs back to original bytes");

    const rawOnProvider = readFileSync(join(process.cwd(), ".uploads", file.key));
    assert(!rawOnProvider.includes(plaintext), "Provider storage contains encrypted blob, not plaintext file content");
  } finally {
    await db.storedFile.deleteMany({ where: { id: file.id } });
  }

  console.log("\nI.56 Encrypted Upload Adapter test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
