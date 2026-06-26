import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ language: z.enum(["en", "sw"]) });

/** POST /api/me/language — save the current user's preferred UI language (A.15). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { language } = schema.parse(await req.json().catch(() => ({})));
    await db.user.update({ where: { id: user.id }, data: { language } });
    return ok({ language });
  } catch (err) {
    return handleError(err);
  }
}
