import { db } from "../src/lib/db";
import type { Role } from "../src/lib/core/roles";
import type { SessionUser } from "../src/lib/core/session";
import { assertCanPrint, decidePrintApproval, printsToday, recordPrint, requestPrintApproval, setPrintLimit } from "../src/lib/services/print-limits.service";
import { queuePrint, queuedJobs, setPrintStationMode } from "../src/lib/services/print-queue.service";
import { readFileSync } from "node:fs";

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
async function expectThrows(name: string, fn: () => Promise<unknown>, code?: string) {
  try { await fn(); check(name, false, "expected error"); }
  catch (e: any) { check(name, code ? e?.code === code : true, `blocked with ${e?.code ?? e?.name ?? "error"}`); }
}
function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: (u.secondaryRole ?? null) as Role | null, language: u.language ?? "en" };
}

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!tenant) throw new Error("Karibu tenant missing.");
  const [principalRow, deputyRow, hodRow, librarianRow] = await Promise.all([
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "deputy@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "library@karibuhigh.ac.ke" } }),
  ]);
  const originalLimit = tenant.printLimitPerDay;
  const originalMode = tenant.printStationMode;
  const originalHodRole = hodRow.role;
  const originalHodSecondary = hodRow.secondaryRole;
  const principal = asUser(principalRow);
  const deputy = asUser(deputyRow);
  const librarian = asUser(librarianRow);
  const jobRefs: string[] = [];

  try {
    await db.user.update({ where: { id: hodRow.id }, data: { role: "HOD", secondaryRole: null } });
    const hod = asUser(await db.user.findUniqueOrThrow({ where: { id: hodRow.id } }));

    await setPrintStationMode(principal, "HOLD");
    const held = await queuedJobs(principal);
    check("Principal can turn printer off into term-end HOLD mode", held.printStationMode === "HOLD");
    const job = await queuePrint({ tenantId: tenant.id, kind: "RECEIPT", refId: `i8-hold-${Date.now()}`, title: "I.8 held receipt", url: "/api/payments/test/receipt", queuedBy: "I.8 test" });
    jobRefs.push(job.refId);
    const heldWithJob = await queuedJobs(principal);
    check("HOLD mode keeps print jobs queued for later batch printing", heldWithJob.printStationMode === "HOLD" && heldWithJob.jobs.some((j) => j.id === job.id));
    await setPrintStationMode(principal, "AUTO");
    const auto = await queuedJobs(principal);
    check("Principal can turn instant auto-print back on", auto.printStationMode === "AUTO");
    await setPrintStationMode(hod, "HOLD");
    check("Academics HOD can also change print station mode", (await queuedJobs(principal)).printStationMode === "HOLD");
    await setPrintStationMode(principal, "AUTO");
    await expectThrows("Non-privileged staff cannot change print station mode", () => setPrintStationMode(librarian, "HOLD"), "FORBIDDEN");

    const pLimit = await setPrintLimit(principal, 37);
    check("Principal can set a fully custom print limit", pLimit.printLimitPerDay === 37);
    const dLimit = await setPrintLimit(deputy, 38);
    check("Deputy can set a fully custom print limit", dLimit.printLimitPerDay === 38);
    const hLimit = await setPrintLimit(hod, 39);
    check("Academics HOD can set a fully custom print limit", hLimit.printLimitPerDay === 39);
    await expectThrows("Non-privileged staff cannot set print limit", () => setPrintLimit(librarian, 5), "FORBIDDEN");

    await setPrintLimit(principal, 1);
    const day = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    await db.usageCounter.deleteMany({ where: { tenantId: tenant.id, metric: `print:${librarian.id}`, periodKey: day } });
    await recordPrint(librarian);
    check("Non-privileged staff print count is recorded", (await printsToday(tenant.id, librarian.id)) === 1);
    await expectThrows("Non-privileged staff over limit must request approval", () => assertCanPrint(librarian, "INVOICE", "I8-DOC"), "LIMIT_REACHED");
    const req = await requestPrintApproval(librarian, { docKind: "INVOICE", docRef: "I8-DOC", reason: "I.8 extra invoice print" });
    check("Over-limit staff can request print approval", req.status === "PENDING");
    await decidePrintApproval(principal, req.id, true);
    const gate = await assertCanPrint(librarian, "INVOICE", "I8-DOC");
    check("Approved print request is consumed for one extra print", gate.usedApproval === true);
    const consumed = await db.printApprovalRequest.findUnique({ where: { id: req.id } });
    check("Print approval row is marked USED after consumption", consumed?.status === "USED");

    const manager = readFileSync("src/components/settings/print-limits-manager.tsx", "utf8");
    check("Settings UI exposes custom number limit and approval queue", manager.includes("Documents per day (0 = unlimited)") && manager.includes("Print approval requests"));
    const station = readFileSync("src/components/reception/print-station-client.tsx", "utf8");
    check("Print Station UI has term-end batch mode switch", station.includes("Boarding School Term-End Batch Mode") && station.includes("stationMode"));
    const route = readFileSync("src/app/api/print-queue/route.ts", "utf8");
    const postRoute = route.slice(route.indexOf("export async function POST"));
    check("Station mode API is handled as a privileged setting action", postRoute.indexOf('action === "stationMode"') > -1 && postRoute.indexOf('action === "stationMode"') < postRoute.indexOf('if (!(await allowed(user)))'));
  } finally {
    await db.tenant.update({ where: { id: tenant.id }, data: { printLimitPerDay: originalLimit, printStationMode: originalMode } });
    await db.user.update({ where: { id: hodRow.id }, data: { role: originalHodRole, secondaryRole: originalHodSecondary } });
    await db.usageCounter.deleteMany({ where: { tenantId: tenant.id, metric: `print:${librarianRow.id}` } });
    await db.printApprovalRequest.deleteMany({ where: { tenantId: tenant.id, OR: [{ reason: { contains: "I.8" } }, { docRef: { contains: "I8" } }] } });
    await db.printJob.deleteMany({ where: { tenantId: tenant.id, refId: { in: jobRefs } } });
    await db.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nI.8 printing controls: ${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
