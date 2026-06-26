import { getCurrentUser } from "@/lib/core/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations/:id/stream — SSE for live thread updates (A.8).
 * Emits the latest message id + count every 3s; the client refetches when it
 * changes. (Stands in for WebSocket; swappable for true WS later.)
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  // Must be a participant.
  const member = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: params.id, userId: user.id } },
  });
  if (!member) return new Response("forbidden", { status: 403 });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: tick\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      const tick = async () => {
        const last = await db.message.findFirst({
          where: { conversationId: params.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        });
        const count = await db.message.count({
          where: { conversationId: params.id },
        });
        send({ lastId: last?.id ?? null, count });
      };
      await tick();
      const interval = setInterval(tick, 3000);
      const timeout = setTimeout(() => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* noop */ }
      }, 5 * 60 * 1000);
      void timeout;
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
