import { chromium } from "playwright";
import path from "node:path";
import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import { openClassChat } from "../src/lib/services/class-chat.service";
import { startClassVoiceRoom, cleanupExpiredClassVoiceRooms } from "../src/lib/services/class-voice.service";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function userByEmail(email: string): Promise<SessionUser> {
  const user = await db.user.findFirst({ where: { email } });
  if (!user) throw new Error(`Missing user ${email}`);
  return {
    id: user.id,
    tenantId: user.tenantId,
    neyoLoginId: user.neyoLoginId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    secondaryRole: user.secondaryRole as SessionUser["secondaryRole"],
    language: user.language,
  };
}

async function main() {
  const chebet = await userByEmail("f.chebet@karibuhigh.ac.ke");
  const f2e = await db.schoolClass.findFirst({ where: { tenantId: chebet.tenantId, level: "Form 2", stream: "East" } });
  if (!f2e) throw new Error("Missing Form 2 East");
  const chat = await openClassChat(chebet, f2e.id);
  await cleanupExpiredClassVoiceRooms(chebet.tenantId);
  await startClassVoiceRoom(chebet, {
    conversationId: chat.conversationId,
    peerId: `peer_screenshot_${Date.now()}`,
  }).catch((error) => {
    if (!String(error?.message || "").includes("active")) throw error;
  });

  const browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, permissions: ["microphone"] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "f.chebet@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Login failed: ${JSON.stringify(login)}`);

  await page.goto(`${BASE}/messages?open=${chat.conversationId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, "i9-class-group-voice.png"), fullPage: false });
  console.log("✓ screenshots/i9-class-group-voice.png");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
