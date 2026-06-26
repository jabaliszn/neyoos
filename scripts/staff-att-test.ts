/** B.3 staff attendance + analytics — live tests. */
import { db } from "../src/lib/db";
import { clockIn, clockOut, staffDaySheet, attendanceAnalytics } from "../src/lib/services/staff-attendance.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const teacher = (await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const parent = (await db.user.findFirstOrThrow({ where: { email: "parent@karibuhigh.ac.ke" } })) as unknown as SessionUser;

  // 1) clock in -> out, double blocked
  const ci = await clockIn(teacher);
  console.log("teacher clock in:", ci.clockInAt ? "✓" : "✗");
  try { await clockIn(teacher); console.log("double clock-in: ALLOWED ✗"); } catch { console.log("double clock-in blocked: ✓"); }
  await clockOut(teacher);
  try { await clockOut(teacher); console.log("double clock-out: ALLOWED ✗"); } catch { console.log("double clock-out blocked: ✓"); }

  // 2) day sheet: principal sees sheet incl seeded clocks; parent canClock=false
  const sheet = await staffDaySheet(principal, undefined, true);
  console.log("sheet:", sheet.presentCount + "/" + sheet.expected, "in", sheet.presentCount >= 4 ? "✓ (3 seeded + teacher)" : "✗");
  const pSheet = await staffDaySheet(parent, undefined, false);
  console.log("parent canClock:", pSheet.canClock === false ? "✓ false" : "✗");

  // 3) analytics on seeded history
  const a = await attendanceAnalytics(principal, 14);
  console.log("trend days:", a.trend.length, a.trend.length >= 8 ? "✓ (>=8 within 14-day window)" : "✗");
  console.log("chronic list:", a.chronic.map(c => `${c.name}:${c.absences}`).join(", ") || "(none)", a.chronic.some(c => c.name.includes("Kamau")) ? "✓ Kamau flagged" : "✗");
  console.log("anomalies:", a.anomalies.length, a.anomalies.length >= 1 ? "✓ " + JSON.stringify(a.anomalies[0]) : "✗ none detected");

  // cleanup teacher's test clock row (keep seeded ones)
  await db.staffAttendance.deleteMany({ where: { userId: teacher.id } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
