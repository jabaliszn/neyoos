/** A.17 live test: occurrences merge + iCal + audience invite. */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { getOccurrences, buildIcs, inviteAudience } from "../src/lib/services/calendar.service";

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const year = new Date().getFullYear();

  // 1) Occurrences for the seeded months (Jul–Sep) as a leadership viewer.
  const occ = await withTenant(tenant.id, () =>
    getOccurrences({
      from: `${year}-07-01`, to: `${year}-09-30`,
      viewerRole: "PRINCIPAL", seeAll: true, showReligious: true,
    })
  );
  const events = occ.filter((o) => o.source === "event");
  const holidays = occ.filter((o) => o.source === "holiday");
  console.log(`occurrences: ${occ.length} total (${events.length} events, ${holidays.length} holidays)`);
  console.log("event titles:", events.map((e) => `${e.date} ${e.title}`).join(" | "));

  // 2) Audience filter: a PARENT should NOT see the targeted "Form 2 Parents' Meeting"? It targets PARENT -> they SHOULD see it.
  const parentView = await withTenant(tenant.id, () =>
    getOccurrences({ from: `${year}-07-01`, to: `${year}-07-31`, viewerRole: "PARENT", seeAll: false, showReligious: true })
  );
  const sawPTA = parentView.some((o) => o.title.includes("Parents' Meeting"));
  // A STUDENT should NOT see the PARENT-targeted meeting.
  const studentView = await withTenant(tenant.id, () =>
    getOccurrences({ from: `${year}-07-01`, to: `${year}-07-31`, viewerRole: "STUDENT", seeAll: false, showReligious: true })
  );
  const studentSawPTA = studentView.some((o) => o.title.includes("Parents' Meeting"));
  console.log(`audience: PARENT sees PTA=${sawPTA} (want true); STUDENT sees PTA=${studentSawPTA} (want false)`);

  // 3) showReligious=false hides Christmas etc.
  const noRel = await withTenant(tenant.id, () =>
    getOccurrences({ from: `${year}-12-01`, to: `${year}-12-31`, viewerRole: "PRINCIPAL", seeAll: true, showReligious: false })
  );
  const hasXmas = noRel.some((o) => o.title.includes("Christmas"));
  console.log(`religious off: December has Christmas=${hasXmas} (want false); Jamhuri present=${noRel.some(o=>o.title.includes("Jamhuri"))} (want true)`);

  // 4) iCal validity check.
  const ics = buildIcs(occ.slice(0, 6), tenant.name);
  const vevents = (ics.match(/BEGIN:VEVENT/g) || []).length;
  console.log(`ical: ${vevents} VEVENTs, starts ${ics.startsWith("BEGIN:VCALENDAR")}, ends ${ics.trimEnd().endsWith("END:VCALENDAR")}`);
  console.log("ical sample DTSTART lines:", (ics.match(/DTSTART[^\r\n]*/g) || []).slice(0,3).join(" || "));

  // 5) inviteAudience dry count for the PARENT-targeted event.
  const pta = events.find((e) => e.title.includes("Parents' Meeting"))!;
  const r = await inviteAudience(tenant.id, { id: pta.id, title: pta.title, date: pta.date, startTime: pta.startTime, audienceRole: "PARENT" }, "someone-else");
  console.log(`invite PARENT audience -> invited ${r.invited} (Karibu has parents? count below)`);
  const parentCount = await db.user.count({ where: { tenantId: tenant.id, role: "PARENT", isActive: true } });
  console.log(`PARENT users in Karibu: ${parentCount}`);
  // cleanup the notifications we just created
  await db.notification.deleteMany({ where: { tenantId: tenant.id, category: "calendar" } });

  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
