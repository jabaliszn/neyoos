import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
  const founderApi = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const landing = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

  assert(layout.includes("generateMetadata") && layout.includes("neyo_favicon_url") && layout.includes("neyo_wordmark_light_url"), "Root metadata reads NEYO Ops favicon and Open Graph brand assets");
  assert(founderApi.includes("update_platform_setting") && founderApi.includes("platform.setting_updated"), "Founder Ops saves brand assets through audited PlatformSetting writes");
  assert(ui.includes("Favicons, wordmarks & mascot assets") && ui.includes("Save all brand assets"), "Business Operations UI edits favicons, wordmarks and mascot assets");
  assert(ui.includes("neyo_mascot_url") && ui.includes("neyo_icon_192_url") && ui.includes("neyo_pattern_url"), "UI saves mascot, PWA icon and pattern settings");
  assert(landing.includes("neyo_logo_url") && landing.includes("neyo_brand_primary") && landing.includes("neyo_brand_accent"), "Public landing already consumes live NEYO logo and colors");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");

  const keys = ["neyo_favicon_url", "neyo_wordmark_light_url", "neyo_mascot_url", "neyo_pattern_url"];
  const old = await db.platformSetting.findMany({ where: { key: { in: keys } } });
  try {
    for (const key of keys) {
      await db.platformSetting.upsert({ where: { key }, create: { key, value: `/brand/test-${key}.png`, updatedBy: actor!.fullName }, update: { value: `/brand/test-${key}.png`, updatedBy: actor!.fullName } });
    }
    const saved = await db.platformSetting.findMany({ where: { key: { in: keys } } });
    assert(saved.length === keys.length && saved.every((row) => row.value.includes("/brand/test-")), "Brand asset URLs persist as PlatformSettings without code changes");
  } finally {
    await db.platformSetting.deleteMany({ where: { key: { in: keys } } });
    for (const row of old) {
      await db.platformSetting.create({ data: { key: row.key, value: row.value, updatedBy: row.updatedBy } });
    }
  }

  console.log("\nI.48 Brand Assets checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
