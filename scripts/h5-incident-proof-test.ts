/** H.5 Incident Photo Proof — live test (self-healing). */
import { db } from "../src/lib/db";
import { reportIncident, listIncidents } from "../src/lib/services/discipline.service";
import { incidentSchema } from "../src/lib/validations/discipline";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}
function today() { return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10); }

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const student = await db.student.findFirstOrThrow({ where: { tenant: { slug: "karibu-high" }, status: "ACTIVE" } });
  let pass = 0, fail = 0;
  const ok = (c: boolean, l: string) => { if (c) { pass++; console.log("  ✓", l); } else { fail++; console.log("  ✗ FAIL:", l); } };

  // 1) validation accepts proof fields
  const parsed = incidentSchema.parse({
    studentId: student.id, date: today(), category: "VANDALISM", severity: "MINOR",
    description: "Broke a window pane during break — photo attached as proof.",
    proofFileUrl: "/api/files/serve?key=tenants/x/discipline/proof123.jpg",
    proofFileName: "broken-window.jpg",
  });
  ok(parsed.proofFileUrl?.includes("proof123") === true, "incidentSchema parses proofFileUrl/proofFileName");

  // 2) reportIncident persists the proof
  const res = await reportIncident(principal, parsed);
  const row = await db.disciplineIncident.findUniqueOrThrow({ where: { id: res.id } });
  ok(row.proofFileUrl === parsed.proofFileUrl, "incident saved with proofFileUrl");
  ok(row.proofFileName === "broken-window.jpg", "incident saved with proofFileName");

  // 3) listIncidents returns the proof for display
  const list = await listIncidents(principal, { studentId: student.id });
  const found = list.find((i) => i.id === res.id);
  ok(!!found && found.proofFileUrl === parsed.proofFileUrl, "listIncidents returns proofFileUrl (UI can show 'View Proof')");

  // 4) incident WITHOUT proof still works (optional)
  const res2 = await reportIncident(principal, {
    studentId: student.id, date: today(), category: "LATENESS", severity: "MINOR",
    description: "Arrived 20 minutes late to assembly.",
  });
  const row2 = await db.disciplineIncident.findUniqueOrThrow({ where: { id: res2.id } });
  ok(row2.proofFileUrl === null, "incident without proof saves null (proof is optional)");

  // self-heal: remove test incidents
  await db.disciplineIncident.deleteMany({ where: { id: { in: [res.id, res2.id] } } });

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
