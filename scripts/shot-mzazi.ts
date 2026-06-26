/** G.13 Mzazi Card screenshots (126 challenge, 127 revealed). Mobile 390px (parent phone). */
import { chromium } from "playwright-core";
import { readFileSync } from "fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/user/screenshots";

function val(file: string, key: string) {
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(key + "="));
  return line ? line.slice(key.length + 1).trim() : "";
}

async function main() {
  const code = val("/tmp/atieno_info.txt", "ATIENO_CODE");
  const phone = val("/tmp/atieno_info.txt", "ATIENO_PHONE");
  const browser = await chromium.launch();
  // parent phone viewport
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // 1) challenge screen
  await page.goto(`${BASE}/mzazi/${code}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/126-mzazi-challenge.png` });

  // 2) enter the guardian phone -> revealed balance
  await page.locator("input[inputmode='tel']").fill(phone);
  await page.getByRole("button", { name: /check balance/i }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${SHOTS}/127-mzazi-revealed.png` });

  await browser.close();
  console.log("✓ screenshots 126-127 captured");
}
main().catch((e) => { console.error(e); process.exit(1); });
