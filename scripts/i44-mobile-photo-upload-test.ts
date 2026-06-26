import { readFileSync } from "fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.44 mobile photo upload test");
  const source = readFileSync("src/components/ui/file-upload.tsx", "utf8");
  assert(source.includes('capture={captureValue}'), "FileUpload adds capture attribute to the hidden file input");
  assert(source.includes('capture ?? "environment"'), "FileUpload defaults image uploads to environment camera capture");
  assert(source.includes('accept = "image/*,application/pdf"'), "FileUpload default accept allows mobile camera photos and PDFs");
  assert(source.includes('Camera className'), "FileUpload visually indicates photo-capable upload surfaces");
  console.log("\n✅ I.44 mobile photo upload test passed");
}

main().catch((err) => { console.error(err); process.exit(1); });
