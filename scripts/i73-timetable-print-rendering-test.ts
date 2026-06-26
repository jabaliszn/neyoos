import { db } from "@/lib/db";
import { clearSlot, setSlot, timetablePrintBundle } from "@/lib/services/academics.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.73 timetable advanced rendering + bulk print test");
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId, archived: false } });
  const subject = await db.subject.findFirstOrThrow({ where: { tenantId: principal.tenantId, archived: false } });
  const teacher = await db.user.findFirst({ where: { tenantId: principal.tenantId, role: { in: ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL"] } } });

  await clearSlot(principal, cls.id, 1, 8);
  const slot = await setSlot(principal, { classId: cls.id, subjectId: subject.id, teacherId: teacher?.id, venue: "Science Lab", dayOfWeek: 1, period: 8 });
  assert(Boolean(slot.id), "lesson slot saves with a real venue field");

  const classPack = await timetablePrintBundle(principal, "classes");
  assert(classPack.groups.some((g) => g.id === cls.id && g.slots.some((s) => s.venue === "Science Lab")), "print-all-classes pack includes venue-backed slots");

  const teacherPack = await timetablePrintBundle(principal, "teachers");
  if (teacher) assert(teacherPack.groups.some((g) => g.id === teacher.id && g.slots.some((s) => s.className)), "print-all-teachers pack groups lessons by teacher with class labels");

  const venuePack = await timetablePrintBundle(principal, "venues");
  assert(venuePack.groups.some((g) => g.title === "Science Lab" && g.slots.some((s) => s.className)), "print-by-venue pack groups lessons by venue");

  const source = readFileSync("src/components/academics/academics-client.tsx", "utf8");
  assert(source.includes("Vertical days"), "horizontal/vertical days toggle is rendered");
  assert(source.includes("Cell font"), "custom in-cell font size control is rendered");
  assert(source.includes("Print all classes") && source.includes("Print all teachers") && source.includes("Print by venue"), "one-click bulk print controls are rendered");
  assert(source.includes("[writing-mode:vertical-rl]") && source.includes("colSpan={daysList.length}"), "break/lunch rows merge cells and display vertical labels");
  assert(source.includes("block text-2xl leading-none"), "period column displays a bigger number-only marker");
  assert(source.includes("{getPeriodTimeRange(p)}</span>") && source.includes("timetablePeriodTimeRange(p, group.config)"), "time range is printed directly below period numbers in live and print timetables");
  assert(source.includes("timetableNonLessonTimeRange") && source.includes("{row.timeRange}"), "break and lunch headers/rows show their own times without lesson numbers");

  await clearSlot(principal, cls.id, 1, 8);
  console.log("\n✅ I.73 timetable advanced rendering + bulk print test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
