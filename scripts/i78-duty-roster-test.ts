import { db } from "@/lib/db";
import { dutyRosterBoard, generateDutyRoster } from "@/lib/services/duty-roster.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.78 duty-roster timetable test");
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const teachers = await db.user.findMany({ where: { tenantId: principal.tenantId, role: { in: ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL"] }, isActive: true }, take: 3 });
  assert(teachers.length >= 2, "test school has at least two active teachers for rotation");

  const before = await dutyRosterBoard(principal);
  assert(before.teachers.length >= 2, "duty roster board returns the selectable teacher pool");
  await db.dutyRosterEntry.deleteMany({ where: { tenantId: principal.tenantId, termLabel: before.termLabel } });

  const weekly = await generateDutyRoster(principal, { rotationPeriod: "WEEKLY", teacherIds: teachers.map((t) => t.id), teachersPerCycle: Math.min(3, teachers.length) });
  assert(weekly.entries.length >= 8, "weekly duty roster generates saved term blocks");
  assert(weekly.entries[0].primaryTeacherName && weekly.entries[0].assistantTeacherName, "roster stores primary and assistant teacher names");
  assert(weekly.entries[0].dutyTeamSize === Math.min(3, teachers.length) && JSON.parse(weekly.entries[0].dutyTeacherNames || "[]").length === Math.min(3, teachers.length), "school can choose the number of teachers per reshuffle cycle");
  assert(new Set(weekly.entries.map((e) => e.primaryTeacherId)).size >= 2, "primary duty rotates across teachers fairly");
  assert(weekly.entries.every((e) => e.rotationPeriod === "WEEKLY" && e.startDate && e.endDate), "each roster entry stores dates and rotation period");

  const board = await dutyRosterBoard(principal);
  assert(board.entries.length === weekly.entries.length, "duty roster board reads saved database entries");

  const monthly = await generateDutyRoster(principal, { rotationPeriod: "MONTHLY", teacherIds: teachers.map((t) => t.id) });
  assert(monthly.entries.length < weekly.entries.length && monthly.entries.every((e) => e.rotationPeriod === "MONTHLY"), "school can choose a different reshuffle period and regenerate");

  const audit = await db.auditLog.findFirst({ where: { tenantId: principal.tenantId, action: "academics.duty_roster_generated" }, orderBy: { createdAt: "desc" } });
  assert(Boolean(audit), "duty roster generation is audit logged");

  const route = readFileSync("src/app/api/academics/duty-roster/route.ts", "utf8");
  assert(route.includes('requirePermission("academics.view")') && route.includes('requirePermission("academics.manage")'), "duty roster API has view/manage permission gates");
  const ui = readFileSync("src/components/academics/academics-client.tsx", "utf8");
  assert(ui.includes("Generate & Save Duty Roster") && ui.includes("/api/academics/duty-roster"), "Academics duty roster UI saves through the real API");
  assert(ui.includes("Teachers per reshuffle cycle") && ui.includes("teachersPerCycle"), "Academics duty roster UI lets the school choose team size per cycle");

  await db.dutyRosterEntry.deleteMany({ where: { tenantId: principal.tenantId, termLabel: before.termLabel } });
  console.log("\n✅ I.78 duty-roster timetable test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
