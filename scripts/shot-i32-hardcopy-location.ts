import { chromium } from "playwright";
import { db } from "@/lib/db";
import { addDocument } from "@/lib/services/student.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}

async function main() {
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const student = await db.student.findFirstOrThrow({ where: { tenantId: principal.tenantId, status: "ACTIVE" } });
  const doc = await addDocument(principal, student.id, {
    label: "Birth certificate hardcopy demo",
    fileUrl: "/api/files/serve?k=demo-hardcopy",
    fileName: "birth-demo.pdf",
    hardcopyLocation: "Cabinet 2 / Drawer B / File 14",
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("neyo-cookie-ack", new Date().toISOString()));
  await page.request.post("http://localhost:3000/api/auth/password/login", { data: { email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" } });
  await page.goto(`http://localhost:3000/students/${student.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "screenshots/i32-hardcopy-location-document.png", fullPage: false });
  await browser.close();
  await db.studentDocument.delete({ where: { id: doc.id } }).catch(() => {});
  console.log("✓ screenshots/i32-hardcopy-location-document.png");
}

main().finally(async () => db.$disconnect());
