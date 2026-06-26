/**
 * B.13 Class discussion forum — shared by teachers (homework.assign) AND
 * families (portal.parent). Row-scoping inside the service decides which
 * class forums each user can touch.
 * GET  ?classId=        — threads in a class
 * GET  ?threadId=       — one thread + posts
 * POST {action:"thread", classId, title, body}
 * POST {action:"post", threadId, body}
 * POST {action:"lock", threadId, locked}   (teaching roles only)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { ok, handleError, fail } from "@/lib/api/respond";
import { threadCreateSchema, postCreateSchema } from "@/lib/validations/lms";
import { listThreads, createThread, getThread, addPost, lockThread } from "@/lib/services/lms.service";

export const dynamic = "force-dynamic";

function allowedRole(role: Role): boolean {
  return can(role, "homework.assign") || can(role, "portal.parent");
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!allowedRole(user.role as Role)) return fail("FORBIDDEN", "No access to class forums.", 403);
    const sp = req.nextUrl.searchParams;
    const threadId = sp.get("threadId");
    if (threadId) return ok(await getThread(user, threadId));
    const classId = sp.get("classId");
    if (!classId) return fail("MISSING", "classId or threadId required.", 400);
    return ok({ threads: await listThreads(user, classId) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!allowedRole(user.role as Role)) return fail("FORBIDDEN", "No access to class forums.", 403);
    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["thread", "post", "lock"]) }).parse(body).action;
    if (action === "thread") {
      const input = threadCreateSchema.parse(body);
      const t = await createThread(user, input);
      return ok({ id: t.id }, 201);
    }
    if (action === "post") {
      const input = postCreateSchema.parse(body);
      const p = await addPost(user, input);
      return ok({ id: p.id }, 201);
    }
    // lock — teaching roles only
    if (!can(user.role as Role, "homework.assign")) return fail("FORBIDDEN", "Only teachers can lock threads.", 403);
    const input = z.object({ threadId: z.string().min(1), locked: z.boolean() }).parse(body);
    return ok(await lockThread(user, input.threadId, input.locked));
  } catch (e) {
    return handleError(e);
  }
}
