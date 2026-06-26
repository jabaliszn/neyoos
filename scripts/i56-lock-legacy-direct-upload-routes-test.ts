import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const fileUpload = readFileSync(join(process.cwd(), "src/components/ui/file-upload.tsx"), "utf8");
  const presign = readFileSync(join(process.cwd(), "src/app/api/files/presign/route.ts"), "utf8");
  const confirm = readFileSync(join(process.cwd(), "src/app/api/files/confirm/route.ts"), "utf8");
  const devPut = readFileSync(join(process.cwd(), "src/app/api/files/dev-put/route.ts"), "utf8");

  assert(fileUpload.includes("/api/files/encrypted") && !fileUpload.includes("/api/files/presign"), "Reusable upload UI uses encrypted endpoint, not legacy presign");
  for (const [name, source] of [["presign", presign], ["confirm", confirm], ["dev-put", devPut]] as const) {
    assert(source.includes("LEGACY") && source.includes("/api/files/encrypted"), `${name} route documents encrypted replacement`);
    assert(source.includes("GONE") && source.includes("410"), `${name} route returns 410 Gone instead of accepting direct upload`);
    assert(!source.includes("presignUpload(") && !source.includes("recordFile(") && !source.includes("devPut("), `${name} route no longer calls legacy storage writer`);
  }
  assert(presign.includes("NEYO_ALLOW_LEGACY_DIRECT_UPLOADS") && confirm.includes("NEYO_ALLOW_LEGACY_DIRECT_UPLOADS") && devPut.includes("NEYO_ALLOW_LEGACY_DIRECT_UPLOADS"), "Legacy routes have explicit migration-only environment gate");

  console.log("\nI.56 Legacy Direct Upload Routes Lock test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
