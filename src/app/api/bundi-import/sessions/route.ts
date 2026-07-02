import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { startImportSession, listImportSessions } from "@/lib/services/bundi-import.service";
import { startImportSessionSchema } from "@/lib/validations/bundi-import";

export const dynamic = "force-dynamic";

/** GET /api/bundi-import/sessions — this school's recent Bundi import attempts. */
export async function GET() {
  try {
    const user = await requirePermission("student.create");
    const sessions = await listImportSessions(user);
    return ok({ sessions });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/bundi-import/sessions — start a new session (consumes one unlock-code use). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.create");
    const input = startImportSessionSchema.parse(await req.json().catch(() => ({})));
    const session = await startImportSession(user, input);
    return ok({ session }, 201);
  } catch (err) {
    return handleError(err);
  }
}
