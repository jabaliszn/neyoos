import { chromium } from "playwright";
import { db } from "@/lib/db";
import { submitPortfolioItem, approvePortfolioItem } from "@/lib/services/portfolio.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    secondaryRole: (u.secondaryRole as Role | null) ?? null,
    language: u.language ?? "en",
  };
}

async function ensureVisualDemoData() {
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const studentUserRow = await db.user.findFirstOrThrow({ where: { email: "achieng@karibuhigh.ac.ke" } });
  const learner = await db.student.findFirstOrThrow({ where: { tenantId: principal.tenantId, userId: studentUserRow.id } });
  const studentUser = asUser(studentUserRow);

  // Remove any old visual-demo items with the same titles so the screenshot stays stable.
  await db.portfolioItem.deleteMany({
    where: {
      tenantId: principal.tenantId,
      studentId: learner.id,
      title: { in: [
        "Nairobi River clean-up reflection",
        "Scratch coding fractions animation",
      ] },
    },
  });

  const approved = await submitPortfolioItem(principal, {
    studentId: learner.id,
    title: "Nairobi River clean-up reflection",
    category: "COMMUNITY",
    description: "Achieng documented the Saturday school-community clean-up and reflected on teamwork, safety and environmental care.",
    externalLink: "https://example.org/community-cleanup-reflection",
    status: "SUBMITTED",
    visibleToParents: false,
  });
  await approvePortfolioItem(principal, {
    itemId: approved.id,
    status: "APPROVED",
    visibleToParents: true,
    note: "Excellent reflection and clear learner ownership.",
  });

  await submitPortfolioItem(studentUser, {
    studentId: learner.id,
    title: "Scratch coding fractions animation",
    category: "CODING",
    description: "A short coding project showing fraction addition with animated blocks and voice notes for revision.",
    externalLink: "https://example.org/fractions-scratch-demo",
    status: "DRAFT",
    visibleToParents: false,
  });

  return learner.id;
}

async function main() {
  const studentId = await ensureVisualDemoData();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto(`http://localhost:3000/portfolio?studentId=${studentId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "screenshots/j7-student-portfolio-page.png", fullPage: false });
  await browser.close();
  console.log("✓ screenshots/j7-student-portfolio-page.png");
}

main().finally(async () => db.$disconnect());
