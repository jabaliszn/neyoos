import { requireUser } from "@/lib/core/session";
import { listForUser } from "@/lib/services/notification.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/notifications — current user's inbox + unread count. */
export async function GET() {
  try {
    const user = await requireUser();
    const { items, unread } = await listForUser(user.id);
    return ok({
      unread,
      items: items.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        category: n.category,
        href: n.href,
        read: Boolean(n.readAt),
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
