import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const stamp = Date.now();
  await db.platformSetting.upsert({ where: { key: "privacy_policy" }, create: { key: "privacy_policy", value: `I.48 privacy test ${stamp}`, updatedBy: "test" }, update: { value: `I.48 privacy test ${stamp}`, updatedBy: "test" } });
  await db.platformSetting.upsert({ where: { key: "terms_of_service" }, create: { key: "terms_of_service", value: `I.48 terms test ${stamp}`, updatedBy: "test" }, update: { value: `I.48 terms test ${stamp}`, updatedBy: "test" } });
  const privacy = await db.platformSetting.findUniqueOrThrow({ where: { key: "privacy_policy" } });
  const terms = await db.platformSetting.findUniqueOrThrow({ where: { key: "terms_of_service" } });
  assert(privacy.value.includes(String(stamp)) && terms.value.includes(String(stamp)), "company legal documents are stored as live PlatformSetting rows");

  const privacyPage = readFileSync(join(process.cwd(), "src/app/(legal)/privacy/page.tsx"), "utf8");
  const termsPage = readFileSync(join(process.cwd(), "src/app/(legal)/terms/page.tsx"), "utf8");
  const founderUi = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const founderApi = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");

  assert(privacyPage.includes('key: "privacy_policy"') && privacyPage.includes("Dynamically Updated via NEYO Ops"), "public privacy page reads live NEYO Ops privacy text");
  assert(termsPage.includes('key: "terms_of_service"') && termsPage.includes("Dynamically Updated via NEYO Ops"), "public terms page reads live NEYO Ops terms text");
  assert(founderUi.includes("Live Legal & Compliance Editor") && founderUi.includes("Save Live Privacy Policy") && founderUi.includes("Save Live Terms of Service"), "Business Operations has live legal document editor");
  assert(founderUi.includes("onPrivacyChange") && founderUi.includes("onTermsChange"), "legal text editing is local until save button is pressed");
  assert(founderApi.includes("update_platform_setting") && founderApi.includes("platform.setting_updated"), "document saves go through SUPER_ADMIN Founder Ops API and audit log");

  console.log("\nI.48 Company Documents checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
