/**
 * M.3 — Native-mobile calendar sync (webcal:// live feed): full-stack test.
 *
 * Proves (real DB, real service calls, real assertions):
 *  1. A token is created idempotently (same token on repeat calls).
 *  2. Rotating replaces the token; the OLD token stops resolving (revoked).
 *  3. Revoking removes the token entirely; it no longer resolves.
 *  4. The public resolver returns the correct tenant/user/role for a live token.
 *  5. An unknown/garbage token resolves to null (no crash, no leak).
 *  6. An audience-targeted event created for one role is correctly visible in
 *     that role's live feed, and correctly ABSENT for a different role's feed
 *     (privacy: two schools/roles must never see each other's targeted events
 *     just because they know a URL shape).
 *  7. The feed content is REAL iCalendar text (BEGIN:VCALENDAR / VEVENT), not
 *     a stub.
 *  8. A deactivated user's token no longer resolves (fail-closed).
 *
 * Full cleanup in a finally block; safe to run repeatedly.
 */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import {
  getOrCreateCalendarFeedToken,
  rotateCalendarFeedToken,
  revokeCalendarFeedToken,
  resolveCalendarFeedToken,
  feedUrlForToken,
  getOccurrences,
  buildIcs,
  createEvent,
  deleteEvent,
} from "../src/lib/services/calendar.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}

async function main() {
  console.log("M.3 native-mobile calendar sync \u2014 full-stack test");

  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const teacher = await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  const tenantId = principal.tenantId;

  const createdEventIds: string[] = [];

  try {
    // 1) Idempotent creation.
    const t1 = await getOrCreateCalendarFeedToken(tenantId, principal.id);
    const t1Again = await getOrCreateCalendarFeedToken(tenantId, principal.id);
    assert(t1.token === t1Again.token, "getOrCreateCalendarFeedToken is idempotent (same token on repeat calls)");

    const url = feedUrlForToken(t1.token);
    assert(url.https.endsWith(`/api/calendar/feed/${t1.token}.ics`), "https feed URL has the correct real shape");
    assert(url.webcal.startsWith("webcal://"), "webcal:// URL is generated for native Calendar-app subscription");

    // 4) Resolver works for a live token.
    const resolved1 = await resolveCalendarFeedToken(t1.token);
    assert(!!resolved1 && resolved1.userId === principal.id && resolved1.tenantId === tenantId && resolved1.role === "PRINCIPAL", "resolver returns the correct tenant/user/role for a live token");

    // 2) Rotation invalidates the old token.
    const t2 = await rotateCalendarFeedToken(tenantId, principal.id);
    assert(t2.token !== t1.token, "rotate() generates a genuinely different token");
    const oldResolved = await resolveCalendarFeedToken(t1.token);
    assert(oldResolved === null, "the OLD token no longer resolves after rotation (old device links stop syncing)");
    const newResolved = await resolveCalendarFeedToken(t2.token);
    assert(!!newResolved && newResolved.userId === principal.id, "the NEW token resolves correctly");

    // 5) Garbage token.
    const garbage = await resolveCalendarFeedToken("this-token-does-not-exist-anywhere");
    assert(garbage === null, "an unknown/garbage token resolves to null, no crash");

    // 8) Deactivated user's token fails closed.
    const teacherToken = await getOrCreateCalendarFeedToken(tenantId, teacher.id);
    await db.user.update({ where: { id: teacher.id }, data: { isActive: false } });
    const deactivatedResolve = await resolveCalendarFeedToken(teacherToken.token);
    assert(deactivatedResolve === null, "a deactivated user's feed token fails closed (no longer resolves)");
    await db.user.update({ where: { id: teacher.id }, data: { isActive: true } }); // restore

    // Re-fetch a live teacher token now that they're active again, for the
    // audience-targeting checks below.
    const teacherLive = await getOrCreateCalendarFeedToken(tenantId, teacher.id);

    // 6) Audience targeting: create an event visible ONLY to TEACHER role.
    await withTenant(tenantId, async () => {
      const teacherOnlyEvent = await createEvent({
        title: "M3 Sync Test — Teacher-only briefing",
        date: "2026-08-15",
        type: "meeting",
        audience: "TEACHER",
        notify: false,
      } as never, principal.id);
      createdEventIds.push(teacherOnlyEvent.id);

      const principalOnlyResolved = await resolveCalendarFeedToken(t2.token);
      const teacherResolved = await resolveCalendarFeedToken(teacherLive.token);
      assert(!!principalOnlyResolved && !!teacherResolved, "both feed tokens resolve for the audience-targeting check");

      // Principal sees everything (seeAll = calendar.manage permission).
      const { can } = await import("../src/lib/core/permissions");
      const principalOcc = await getOccurrences({
        from: "2026-08-01", to: "2026-08-31",
        viewerRole: principalOnlyResolved!.role, seeAll: can(principalOnlyResolved!.role, "calendar.manage"), showReligious: true,
      });
      assert(principalOcc.some((o) => o.id === teacherOnlyEvent.id), "PRINCIPAL's live feed includes the teacher-targeted event (leadership sees all)");

      // A hypothetical PARENT (or any non-matching, non-leadership role) must NOT see it.
      const parentOcc = await getOccurrences({
        from: "2026-08-01", to: "2026-08-31",
        viewerRole: "PARENT", seeAll: can("PARENT", "calendar.manage"), showReligious: true,
      });
      assert(!parentOcc.some((o) => o.id === teacherOnlyEvent.id), "a PARENT-role feed does NOT include a TEACHER-only targeted event (privacy)");

      const teacherOcc = await getOccurrences({
        from: "2026-08-01", to: "2026-08-31",
        viewerRole: teacherResolved!.role, seeAll: can(teacherResolved!.role, "calendar.manage"), showReligious: true,
      });
      assert(teacherOcc.some((o) => o.id === teacherOnlyEvent.id), "the real TEACHER's own live feed DOES include their targeted event");

      // 7) Real iCalendar content, not a stub.
      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
      const ics = buildIcs(teacherOcc, tenant.name);
      assert(ics.includes("BEGIN:VCALENDAR") && ics.includes("BEGIN:VEVENT") && ics.includes("SUMMARY:M3 Sync Test"), "the feed produces real RFC-5545 iCalendar content with the actual event in it");
    });

    // 3) Revocation removes the token entirely.
    await revokeCalendarFeedToken(principal.id);
    const afterRevoke = await resolveCalendarFeedToken(t2.token);
    assert(afterRevoke === null, "revoke() removes the token; it no longer resolves at all");
    const rowGone = await db.calendarFeedToken.findUnique({ where: { userId: principal.id } });
    assert(rowGone === null, "the CalendarFeedToken row is genuinely deleted from the DB on revoke");

    console.log("\n\u2705 M.3 calendar sync test passed");
  } finally {
    await withTenant(tenantId, async () => {
      if (createdEventIds.length) {
        for (const id of createdEventIds) {
          await deleteEvent(id).catch(() => {});
        }
      }
    });
    await db.calendarFeedToken.deleteMany({ where: { userId: { in: [principal.id, teacher.id] } } });
    await db.user.update({ where: { id: teacher.id }, data: { isActive: true } }).catch(() => {});
    console.log("  cleanup \u2713 (test events + feed tokens removed, user reactivated)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
