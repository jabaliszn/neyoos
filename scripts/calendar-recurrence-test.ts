/** B.25 Calendar — recurring events (RRULE subset) live test (SELF-HEALS). */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import {
  expandRecurrence, getOccurrences, createEvent, deleteEvent, buildIcs,
} from "../src/lib/services/calendar.service";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name}`); }
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });

  // ---- 1) pure expander: WEEKLY ----
  const w = expandRecurrence("2026-07-06", "WEEKLY", "2026-07-31", "2026-07-01", "2026-07-31");
  assert("WEEKLY expands to the right Mondays", JSON.stringify(w) === JSON.stringify(["2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"]));

  // ---- 2) pure expander: WEEKLY bounded by the requested range ----
  const wBounded = expandRecurrence("2026-07-06", "WEEKLY", "2026-12-31", "2026-08-01", "2026-08-31");
  assert("WEEKLY bounded to August only (5 Mondays)", wBounded.every((d) => d >= "2026-08-01" && d <= "2026-08-31") && wBounded.length === 5);

  // ---- 3) pure expander: MONTHLY same day-of-month ----
  const m = expandRecurrence("2026-07-05", "MONTHLY", "2026-12-05", "2026-07-01", "2026-12-31");
  assert("MONTHLY hits the 5th each month", JSON.stringify(m) === JSON.stringify(["2026-07-05", "2026-08-05", "2026-09-05", "2026-10-05", "2026-11-05", "2026-12-05"]));

  // ---- 4) MONTHLY skips months without the day (31st) — Feb/Apr/Jun/Sep/Nov skipped ----
  const m31 = expandRecurrence("2026-01-31", "MONTHLY", "2026-12-31", "2026-01-01", "2026-12-31");
  assert("MONTHLY 31st skips short months", !m31.includes("2026-02-31") && !m31.includes("2026-02-28") && m31.includes("2026-03-31") && m31.includes("2026-01-31"));
  assert("MONTHLY 31st count = 7 (Jan,Mar,May,Jul,Aug,Oct,Dec)", m31.length === 7);

  // ---- 5) recurUntil caps the series ----
  const capped = expandRecurrence("2026-07-06", "WEEKLY", "2026-07-20", "2026-07-01", "2026-12-31");
  assert("recurUntil caps the series", capped[capped.length - 1] === "2026-07-20" && capped.length === 3);

  // ---- 6) getOccurrences expands the SEED weekly briefing inside a month ----
  const occJul = await withTenant(tenant.id, () =>
    getOccurrences({ from: "2026-07-01", to: "2026-07-31", viewerRole: "PRINCIPAL", seeAll: true, showReligious: true })
  );
  const briefings = occJul.filter((o) => o.title === "Staff Briefing");
  assert("seed weekly briefing expands to >=4 in July", briefings.length >= 4);
  assert("each briefing occurrence is marked recurring WEEKLY", briefings.every((o) => o.recurring === "WEEKLY"));
  assert("recurring occurrences carry the same seriesId", new Set(briefings.map((o) => o.seriesId)).size === 1);

  // ---- 7) monthly fees reminder shows once per month ----
  const fees = occJul.filter((o) => o.title === "Fees due reminder");
  assert("monthly fees reminder appears once in July", fees.length === 1 && fees[0].recurring === "MONTHLY");

  // ---- 8) a NEW recurring event round-trips and expands ----
  const created = await withTenant(tenant.id, () => createEvent({
    title: "TEST weekly club", date: "2026-07-07", type: "event", audience: "all", notify: false,
    recurrence: "WEEKLY", recurUntil: "2026-07-28",
  } as never, principal.id));
  const occTest = await withTenant(tenant.id, () =>
    getOccurrences({ from: "2026-07-01", to: "2026-07-31", viewerRole: "PRINCIPAL", seeAll: true, showReligious: false })
  );
  const club = occTest.filter((o) => o.title === "TEST weekly club");
  assert("new weekly event expands to 4 Tuesdays", club.length === 4);
  assert("recurring occurrence ids are unique per date", new Set(club.map((o) => o.id)).size === 4);

  // ---- 9) iCal includes every expanded occurrence ----
  const ics = buildIcs(occTest.filter((o) => o.title === "TEST weekly club"), "Karibu High");
  const vevents = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
  assert("iCal exports each recurring occurrence", vevents === 4);

  // ---- 10) deleting the series id removes all occurrences ----
  await withTenant(tenant.id, () => deleteEvent(created.id));
  const after = await withTenant(tenant.id, () =>
    getOccurrences({ from: "2026-07-01", to: "2026-07-31", viewerRole: "PRINCIPAL", seeAll: true, showReligious: false })
  );
  assert("deleting series removes all its occurrences", after.filter((o) => o.title === "TEST weekly club").length === 0);

  // ---- self-heal ----
  await db.calendarEvent.deleteMany({ where: { tenantId: tenant.id, title: { startsWith: "TEST " } } });

  console.log(`\nB.25 Calendar recurrence: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
