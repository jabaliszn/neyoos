/**
 * G.19 Class Group Chat API.
 * POST /api/class-chat {classId} — get-or-create the class group + sync
 * membership; returns conversationId for /messages?open= deep-link.
 * Access: teachers of the class, families with a child in it, leadership.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { openClassChat } from "@/lib/services/class-chat.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { classId } = z.object({ classId: z.string().min(1) }).parse(await req.json().catch(() => ({})));
    return ok(await openClassChat(user, classId));
  } catch (e) {
    return handleError(e);
  }
}
