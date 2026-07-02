import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });

  // Full-size desktop viewport, same convention as the other shot-* scripts (j5/j6 etc).
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const login = await page.evaluate(async () => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
    return res.json();
  });
  if (!login?.ok) throw new Error(`Login failed: ${JSON.stringify(login)}`);

  await page.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "m3-chat-bug-01-list.png"), fullPage: false });

  // "Form 2 Teachers" is a GROUP conversation — this type SHOULD show the
  // composer (only ANNOUNCEMENT hides it), so this is the real test case.
  const convoTitle = page.getByText("Form 2 Teachers").first();
  await convoTitle.waitFor({ timeout: 10000 }).catch(() => {});
  if (await convoTitle.count()) {
    await convoTitle.click({ force: true });
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "m3-chat-bug-02-thread-open.png"), fullPage: false });


  // Scroll the message-list container up (toward older messages) to see if the
  // input bar shifts / hides behind anything while scrolling.
  const scrollArea = page.locator("div.flex-1.space-y-3.overflow-y-auto").first();
  if (await scrollArea.count()) {
    await scrollArea.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "m3-chat-bug-03-scrolled-top.png"), fullPage: false });
  }

  // geometry of the composer (input) bar vs the viewport
  const inputBar = page.locator("textarea[placeholder='Type a message…']").last();
  const box = await inputBar.boundingBox().catch(() => null);
  console.log("input bar bounding box:", box);
  console.log("viewport height:", 1080);
  const html = await page.content();
  require("fs").writeFileSync(path.join(OUT, "..", "m3-chat-thread.html"), html);

  // Now also check a real mobile-sized viewport (this is where the founder likely
  // saw it — narrow screens / on-screen keyboards push content around more).
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mobilePage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(500);
  await mobilePage.evaluate(async () => {
    await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
    });
  });
  await mobilePage.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.getByText("Got it", { exact: true }).click({ timeout: 1200 }).catch(() => {});
  await mobilePage.waitForTimeout(300);
  const mConvo = mobilePage.getByText("Form 2 Teachers").first();
  await mConvo.waitFor({ timeout: 10000 }).catch(() => {});
  if (await mConvo.count()) await mConvo.click({ force: true });
  await mobilePage.waitForTimeout(1200);
  await mobilePage.screenshot({ path: path.join(OUT, "m3-chat-bug-04-mobile-thread.png"), fullPage: false });

  // Scroll the WHOLE PAGE (not an internal div) — this is what a real user's
  // thumb does on mobile when the page content is taller than the viewport.
  // Position the mouse over the middle of the page content first so the
  // wheel event actually targets the page, not a corner overlay.
  await mobilePage.mouse.move(195, 400);
  await mobilePage.mouse.wheel(0, 400);
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: path.join(OUT, "m3-chat-bug-05-mobile-scrolled.png"), fullPage: false });

  await mobilePage.mouse.wheel(0, 400);
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: path.join(OUT, "m3-chat-bug-06-mobile-scrolled-more.png"), fullPage: false });

  const mInputBar = mobilePage.locator("textarea[placeholder='Type a message…']").last();
  const mBox = await mInputBar.boundingBox().catch(() => null);
  console.log("mobile input bar bounding box (after scroll):", mBox);
  console.log("mobile viewport height:", 844);

  // Document / page total height vs viewport — tells us if the page itself
  // is scrollable (which it should NOT need to be for a chat UI).
  const docHeight = await mobilePage.evaluate(() => document.documentElement.scrollHeight);
  const scrollY = await mobilePage.evaluate(() => window.scrollY);
  console.log("mobile document.scrollHeight:", docHeight, "| window.scrollY after 2x wheel(300):", scrollY);

  // Deep geometry diagnosis: measure every ancestor of the composer to find
  // exactly which container is causing the page (not just an inner pane) to
  // scroll — the root cause of "input hides behind cards while scrolling".
  const geometry = await mobilePage.evaluate(() => {
    const ta = document.querySelector("textarea[placeholder='Type a message…']") as HTMLElement | null;
    if (!ta) return null;
    const rows: { tag: string; cls: string; rect: DOMRect; overflowY: string; position: string; height: string }[] = [];
    let el: HTMLElement | null = ta;
    while (el) {
      const cs = getComputedStyle(el);
      rows.push({
        tag: el.tagName,
        cls: el.className?.toString().slice(0, 80) ?? "",
        rect: el.getBoundingClientRect(),
        overflowY: cs.overflowY,
        position: cs.position,
        height: cs.height,
      });
      el = el.parentElement;
    }
    return { rows, viewportHeight: window.innerHeight, docScrollHeight: document.documentElement.scrollHeight, windowScrollY: window.scrollY };
  });
  console.log(JSON.stringify(geometry, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// diagnostic addendum run separately below via a second invocation is avoided;
// this file's main() already covers the needed screenshots.
