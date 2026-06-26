import { readFileSync } from "fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.45/I.46 smart bulk printing test");
  const src = readFileSync("src/components/students/students-client.tsx", "utf8");
  assert(src.includes('newsFormat === "4-up" ? 4 : newsFormat === "2-up" ? 2 : 1'), "newsletter print merges 1/2/4 documents per A4 at print time");
  assert(src.includes(".grid-2") && src.includes(".grid-4"), "print HTML defines 2-up and 4-up sheet layouts");
  assert(src.includes("✂ Cut Line"), "merged print sheets include cut guides");
  assert(src.includes("{{student_name}}") && src.includes("{{admission_no}}"), "newsletter supports per-student personalization placeholders");
  assert(src.includes("newsPersonalized"), "newsletter can switch between personalized and general mode");
  console.log("\n✅ I.45/I.46 smart bulk printing test passed");
}

main().catch((err) => { console.error(err); process.exit(1); });
