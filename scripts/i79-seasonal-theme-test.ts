import { db } from "@/lib/db";
import { currentSeasonalTheme } from "@/lib/services/seasonal-theme.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.79 seasonal holiday/event theme test");
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));

  const mashujaa = await currentSeasonalTheme(principal, new Date("2026-10-20T09:00:00+03:00"));
  assert(mashujaa.active && mashujaa.source === "holiday" && mashujaa.tone === "heritage" && mashujaa.title.includes("Mashujaa"), "Kenyan public holidays activate a matching heritage theme");

  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const event = await db.calendarEvent.create({
    data: {
      tenantId: principal.tenantId,
      title: "Inter-House Sports Finals",
      description: "Wear house colours and cheer respectfully.",
      date: today,
      endDate: today,
      type: "sports",
      createdById: principal.id,
    },
  });
  try {
    const sports = await currentSeasonalTheme(principal, new Date());
    assert(sports.active && sports.source === "event" && sports.tone === "sports" && sports.message.includes("house colours"), "school calendar events activate event-specific seasonal themes and messages");
  } finally {
    await db.calendarEvent.delete({ where: { id: event.id } }).catch(() => {});
  }

  const service = readFileSync("src/lib/services/seasonal-theme.service.ts", "utf8");
  assert(service.includes("KE_MOMENTS") && service.includes("tenantDb().calendarEvent"), "seasonal service uses Kenyan holidays and real tenant calendar events");
  const api = readFileSync("src/app/api/seasonal-theme/route.ts", "utf8");
  assert(api.includes("requireUser") && api.includes("currentSeasonalTheme"), "seasonal theme API is signed-in and backed by the service");
  const banner = readFileSync("src/components/shell/seasonal-theme-banner.tsx", "utf8");
  assert(banner.includes("/api/seasonal-theme") && banner.includes("Seasonal theme") && banner.includes("neyo-seasonal-theme-hidden"), "app shell banner renders seasonal theme with dismiss support");
  const shell = readFileSync("src/components/shell/app-shell.tsx", "utf8");
  assert(shell.includes("<SeasonalThemeBanner />"), "seasonal theme banner is mounted in the app shell");

  console.log("\n✅ I.79 seasonal holiday/event theme test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
