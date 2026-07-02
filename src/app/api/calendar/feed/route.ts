import { requirePermission } from "@/lib/core/session";
import {
  getOrCreateCalendarFeedToken,
  rotateCalendarFeedToken,
  revokeCalendarFeedToken,
  feedUrlForToken,
} from "@/lib/services/calendar.service";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * M.3 — GET /api/calendar/feed: the SIGNED-IN user's own personal
 * subscription link (https + webcal), so their phone's Calendar app can
 * sync automatically instead of a one-shot manual download.
 */
export async function GET() {
  try {
    const user = await requirePermission("calendar.view");
    const row = await getOrCreateCalendarFeedToken(user.tenantId, user.id);
    return ok({ ...feedUrlForToken(row.token), lastPolledAt: row.lastPolledAt, rotatedAt: row.rotatedAt });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/calendar/feed — { action: "rotate" | "revoke" }. */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("calendar.view");
    const body = await req.json().catch(() => ({}));

    if (body.action === "revoke") {
      const result = await revokeCalendarFeedToken(user.id);
      await db.auditLog.create({
        data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "calendar.feed_token_revoked", entityType: "user", entityId: user.id },
      });
      return ok(result);
    }

    // default action = rotate (also covers the very first "generate my link")
    const row = await rotateCalendarFeedToken(user.tenantId, user.id);
    await db.auditLog.create({
      data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "calendar.feed_token_rotated", entityType: "user", entityId: user.id },
    });
    return ok({ ...feedUrlForToken(row.token), lastPolledAt: row.lastPolledAt, rotatedAt: row.rotatedAt });
  } catch (err) {
    return handleError(err);
  }
}
