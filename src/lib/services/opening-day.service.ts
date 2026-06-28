import { tenantDb } from "@/lib/core/tenant-db";
import { SessionUser } from "@/lib/core/session";

/**
 * L.6 First-Day "Ghost" Tracking.
 * Scans the first day's attendance records. If a student is marked Absent,
 * their status is downgraded to "UNKNOWN" to pause billing and duty roster assignments
 * until the school manually confirms their status (Did they transfer out?).
 */
import { withTenant } from "@/lib/core/tenant-context";
export async function runOpeningDayGhostSweep(user: SessionUser, openingDate: string) {
  return withTenant(user.tenantId, async () => {
  const tDb = tenantDb();
  
  // Find all ACTIVE students who were marked Absent on the target date
  const absences = await tDb.attendanceRecord.findMany({
    where: { 
      date: openingDate, 
      status: "A",
      student: { status: "ACTIVE" }
    },
    include: { student: true }
  });

  let ghostedCount = 0;

  for (const abs of absences) {
    await tDb.student.update({
      where: { id: abs.studentId },
      data: { status: "UNKNOWN" }
    });
    ghostedCount++;
  }

  // L.12 Unlink them from Duty Roster explicitly (to prevent missing cleaning duty)
  if (ghostedCount > 0) {
    await tDb.studentDutyAssignment.deleteMany({
      where: { studentId: { in: absences.map(a => a.studentId) } }
    });
  }

  return { success: true, ghostsFlagged: ghostedCount };
  });
}
