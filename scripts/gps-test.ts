/** G.17 GPS clock-in — live tests. Karibu gate: -1.2921, 36.8219 (Nairobi CBD). */
import { db } from "../src/lib/db";
import { clockIn, distanceMetres } from "../src/lib/services/staff-attendance.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const teacher = (await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const tenantId = teacher.tenantId;
  await db.staffAttendance.deleteMany({ where: { userId: teacher.id } });

  // 0) Haversine sanity: Nairobi CBD -> Westlands ~ 3.0-3.5 km
  const d = distanceMetres(-1.2921, 36.8219, -1.2673, 36.8111);
  console.log("Haversine CBD->Westlands:", d, "m", d > 2500 && d < 4000 ? "✓" : "✗");

  // 1) geofence OFF -> clock-in works without GPS (backwards compatible)
  await db.tenant.update({ where: { id: tenantId }, data: { gpsLat: null, gpsLng: null, gpsRadiusM: null } });
  const r1 = await clockIn(teacher);
  console.log("fence off, no GPS:", r1.gpsVerified === false ? "✓ allowed, unverified" : "✗");
  await db.staffAttendance.deleteMany({ where: { userId: teacher.id } });

  // 2) geofence ON
  await db.tenant.update({ where: { id: tenantId }, data: { gpsLat: -1.2921, gpsLng: 36.8219, gpsRadiusM: 300 } });
  // 2a) no GPS -> GPS_REQUIRED
  try { await clockIn(teacher); console.log("fence on, no GPS: ALLOWED ✗ FAIL"); }
  catch (e) { console.log("fence on, no GPS blocked:", (e as { code: string }).code === "GPS_REQUIRED" ? "✓ GPS_REQUIRED" : "✗"); }
  // 2b) far away (Westlands, ~3 km) -> OUT_OF_RANGE w/ distance in message
  try { await clockIn(teacher, { lat: -1.2673, lng: 36.8111 }); console.log("3km away: ALLOWED ✗ FAIL"); }
  catch (e) { const m = (e as Error).message; console.log("3km away blocked:", m.includes("km from school") ? "✓ " + m : "✗ " + m); }
  // 2c) at the gate (60m off) -> verified
  const r2 = await clockIn(teacher, { lat: -1.29265, lng: 36.8219 });
  console.log("at gate:", r2.gpsVerified && (r2.gpsDistanceM ?? 999) < 300 ? `✓ verified, ${r2.gpsDistanceM} m` : "✗");
  const row = await db.staffAttendance.findFirst({ where: { userId: teacher.id } });
  console.log("row stores gps + distance:", row?.gpsVerified && row.gpsLat !== null && row.gpsDistanceM !== null ? "✓" : "✗");

  // cleanup: keep geofence ON for Karibu (demo realism) but remove test row
  await db.staffAttendance.deleteMany({ where: { userId: teacher.id } });
  console.log("cleanup ✓ (geofence left ON for Karibu: -1.2921,36.8219 r300)");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
