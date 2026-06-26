import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const fileUpload = readFileSync(join(process.cwd(), "src/components/ui/file-upload.tsx"), "utf8");
  const encryptedRoute = readFileSync(join(process.cwd(), "src/app/api/files/encrypted/route.ts"), "utf8");
  const storage = readFileSync(join(process.cwd(), "src/lib/services/storage.service.ts"), "utf8");

  assert(fileUpload.includes("/api/files/encrypted"), "Reusable FileUpload posts to encrypted upload endpoint");
  assert(!fileUpload.includes("/api/files/presign") && !fileUpload.includes("/api/files/confirm") && !fileUpload.includes("uploadUrl"), "Reusable FileUpload no longer uses direct presign/PUT/confirm flow");
  assert(fileUpload.includes("FormData") && fileUpload.includes("category"), "Reusable FileUpload sends multipart file and category through NEYO first");
  assert(fileUpload.includes("encrypted") && fileUpload.includes("Network problem during encrypted upload"), "Upload UI exposes encrypted upload result and error copy");
  assert(encryptedRoute.includes("uploadEncryptedFile") && encryptedRoute.includes("multipart"), "Encrypted file route stores uploads through encrypted storage service");
  assert(storage.includes("uploadEncryptedFile") && storage.includes("encryptBufferForTenant") && storage.includes("readObject") && storage.includes("decryptBufferForTenant"), "Storage service encrypts before provider and decrypts on read");

  console.log("\nI.56 Direct Upload Migration test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
