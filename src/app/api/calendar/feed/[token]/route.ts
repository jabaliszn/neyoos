import { NextRequest } from "next/server";
import { withTenant } from "@/lib/core/tenant-context";
import { can } from "@/lib/core/permissions";
import {
  getOccurrences,
  buildIcs,
  getCalendarPrefs,
  resolveCalendarFeedToken,
} from "@/lib/services/calendar.service";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * M.3 — GET /api/calendar/feed/:token.ics
 * PUBLIC route (no session/cookie) — this is the actual "native mobile
 * calendar sync" endpoint: a phone's Calendar app subscribes to this exact
 * URL once (via the webcal:// link from /api/calendar/feed) and then polls
 * it automatically forever, always getting the LIVE current calendar, not a
 * stale one-time snapshot. The random token itself is the credential (same
 * trust model as a webhook signing secret) — no cookie/session exists here.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  // The URL ends in ".ics" for Calendar-app compatibility; strip it to get
  // the raw token before looking it up.
  const rawToken = params.token.replace(/\.ics$/i, "");

  const resolved = await resolveCalendarFeedToken(rawToken);
  if (!resolved) {
    return new Response("Not found or revoked.", { status: 404 });
  }
  const { tenantId, userId, role } = resolved;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 12, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const prefs = await getCalendarPrefs(tenantId);
  const occurrences = await withTenant(tenantId, () =>
    getOccurrences({
      from: iso(start),
      to: iso(end),
      viewerRole: role,
      seeAll: can(role, "calendar.manage"),
      showReligious: prefs.showReligiousHolidays,
    })
  );

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
  const ics = buildIcs(occurrences, tenant.name);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // no Content-Disposition: this is a LIVE feed URL, not a download.
      "Cache-Control": "no-store", // always serve the current calendar, never a stale cache
    },
  });
}
