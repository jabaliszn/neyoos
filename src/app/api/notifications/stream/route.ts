import { getCurrentUser } from "@/lib/core/session";
import { getUnreadCount } from "@/lib/services/notification.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/stream — Server-Sent Events (A.7 real-time).
 * Emits the unread count every few seconds; the bell updates live without
 * polling churn. (Production could push on write via Redis pub/sub; this poll-
 * based SSE is simple, correct, and works on Vercel/Fly.)
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Initial value immediately.
      send("unread", { unread: await getUnreadCount(user.id) });

      const interval = setInterval(async () => {
        if (closed) return;
        try {
          send("unread", { unread: await getUnreadCount(user.id) });
        } catch {
          /* ignore transient errors */
        }
      }, 5000);

      // Stop after ~5 minutes; the client reconnects automatically.
      const timeout = setTimeout(() => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* noop */ }
      }, 5 * 60 * 1000);

      // @ts-expect-error attach for cancel
      controller._cleanup = () => {
        closed = true;
        clearInterval(interval);
        clearTimeout(timeout);
      };
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
