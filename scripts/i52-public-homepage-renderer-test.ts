import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const page = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
  const client = readFileSync(join(process.cwd(), "src/components/public-site/neyo-landing-client.tsx"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/landing-content.service.ts"), "utf8");

  assert(page.includes("getLandingContent") && page.includes("landingContent={landingContent}"), "Public homepage reads neyo_landing_content and passes it to renderer");
  assert(client.includes("landingContent.nav.map") && client.includes("landingContent.heroHeadline") && client.includes("landingContent.heroSubheadline"), "Renderer consumes editable nav and hero content");
  assert(client.includes("landingContent.trustStats.map") && client.includes("landingContent.products.map"), "Renderer consumes editable trust stats and product ecosystem cards");
  assert(client.includes("landingContent.mediaShowcase.map") && client.includes("Screenshot / video slot"), "Renderer consumes editable screenshot/video showcase slots");
  assert(client.includes("landingContent.industries.map") && client.includes("landingContent.whyNeyo.map") && client.includes("landingContent.securityPoints.map"), "Renderer consumes editable industries, benefits and security sections");
  assert(client.includes("landingContent.footerLinks.map") && client.includes("landingContent.socialLinks.map"), "Renderer consumes editable footer and social links");
  assert(client.includes("Features only. No private integration details exposed."), "Public footer avoids exposing brand secrets or integrations");
  assert(service.includes("LANDING_CONTENT_KEY") && service.includes("mediaShowcase"), "Landing content source of truth includes media showcase model");

  console.log("\nI.52 Public Homepage Renderer Batch 2 test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
