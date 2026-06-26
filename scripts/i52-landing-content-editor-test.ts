import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { defaultLandingContent, getLandingContent, LANDING_CONTENT_KEY, saveLandingContent } from "../src/lib/services/landing-content.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const service = readFileSync(join(process.cwd(), "src/lib/services/landing-content.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const checklist = readFileSync(join(process.cwd(), "docs/FEATURES-CHECKLIST.md"), "utf8");

  assert(service.includes("LANDING_CONTENT_KEY") && service.includes("landingContentSchema"), "Landing content has a validated PlatformSetting model");
  assert(service.includes("api key") && service.includes("Landing content must describe features only"), "Landing validation blocks public exposure of secrets/internal logic");
  assert(api.includes("getLandingContent") && api.includes("update_landing_content") && api.includes("saveLandingContent"), "Founder Ops API returns and saves landing content");
  assert(ui.includes("Landing Page Content Editor") && ui.includes("Save landing content") && ui.includes("advanced JSON editor"), "NEYO Ops UI includes landing content editor");
  assert(ui.includes("Public-safe rule") && ui.includes("do not expose secrets"), "Editor reminds founder to keep public copy safe");
  assert(checklist.includes("Founder-added landing-page requirements"), "Founder-added landing requirements are recorded in checklist");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");
  const previous = await db.platformSetting.findUnique({ where: { key: LANDING_CONTENT_KEY } });
  try {
    const content = defaultLandingContent();
    content.heroHeadline = "One platform. Many operating systems. Built for Kenya.";
    content.mediaShowcase[0] = { ...content.mediaShowcase[0]!, url: "screenshots/i48-neyo-business-os-cockpit.png" };
    await saveLandingContent(content, { id: actor!.id, fullName: actor!.fullName, tenantId: actor!.tenantId });
    const saved = await getLandingContent();
    assert(saved.heroHeadline.includes("Many operating systems"), "Landing content saves and reloads from PlatformSetting");
    assert(saved.mediaShowcase[0]?.url?.includes("screenshots/"), "Media showcase slots persist for screenshots/videos");
    const audit = await db.auditLog.findFirst({ where: { action: "platform.landing_content_updated", entityType: "PlatformSetting", entityId: LANDING_CONTENT_KEY } });
    assert(audit, "Landing content save is audit logged");

    let rejected = false;
    try {
      await saveLandingContent({ ...content, heroSubheadline: "Our API key and database secret should never be public." }, { id: actor!.id, fullName: actor!.fullName, tenantId: actor!.tenantId });
    } catch { rejected = true; }
    assert(rejected, "Landing content validation rejects secret/internal wording");
  } finally {
    if (previous) await db.platformSetting.update({ where: { key: LANDING_CONTENT_KEY }, data: { value: previous.value, updatedBy: previous.updatedBy } });
    else await db.platformSetting.deleteMany({ where: { key: LANDING_CONTENT_KEY } });
  }

  console.log("\nI.52 Landing Content Editor Batch 1 test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
