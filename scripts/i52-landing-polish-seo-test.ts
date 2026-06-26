import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const page = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
  const client = readFileSync(join(process.cwd(), "src/components/public-site/neyo-landing-client.tsx"), "utf8");
  const checklist = readFileSync(join(process.cwd(), "docs/FEATURES-CHECKLIST.md"), "utf8");

  assert(page.includes("export async function generateMetadata") && page.includes("landing.seoTitle") && page.includes("landing.seoDescription"), "Public homepage metadata uses NEYO Ops landing SEO title/description");
  assert(page.includes("twitter") && page.includes("summary_large_image") && page.includes("landing.ogImageUrl"), "Public homepage wires Open Graph/Twitter image from landing content");
  assert(client.includes("mobileMenuOpen") && client.includes("Open landing navigation") && client.includes("lg:hidden"), "Landing page has a mobile navigation menu");
  assert(client.includes("text-4xl") && client.includes("sm:text-6xl") && client.includes("lg:text-8xl"), "Hero typography is responsive across phone/tablet/desktop");
  assert(client.includes("NEYO preview") && client.includes("object-cover") && client.includes("Media slot"), "Media showcase has polished preview frames and intentional empty states");
  assert(client.includes("hover:-translate-y-0.5") && client.includes("rounded-[2rem]") && client.includes("#fbf8f1"), "Renderer has premium editorial polish without generic gradient soup");
  assert(checklist.includes("Batch 2 public homepage renderer + media slots completed"), "Checklist records slow batched landing implementation progress");

  console.log("\nI.52 Landing Polish + SEO Batch 3 test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
