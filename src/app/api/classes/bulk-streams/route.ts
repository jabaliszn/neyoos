import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { bulkCreateStreamsSchema } from "@/lib/validations/student";
import { bulkCreateStreams, StudentError } from "@/lib/services/student.service";
import { db } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * P.5 — POST /api/classes/bulk-streams: a school specifies "this level has N
 * streams" and every stream is created in one action, each immediately wired
 * with a default TimetableConfig row so it's ready-to-configure the moment
 * the school opens the Timetable Engine (Master Button / generator).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("class.manage");
    const input = bulkCreateStreamsSchema.parse(await req.json().catch(() => ({})));
    const result = await bulkCreateStreams(user, input);
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "class.bulk_create_streams",
        entityType: "SchoolClass",
        entityId: result.level,
        metadata: JSON.stringify({ level: result.level, createdCount: result.createdCount, skippedCount: result.skippedCount }),
      },
    });
    return ok(result, 201);
  } catch (err) {
    if (err instanceof StudentError) {
      const statusMap = { NOT_FOUND: 404, DUPLICATE: 409, FORBIDDEN: 403, INVALID: 400 } as const;
      return fail(err.code, err.message, statusMap[err.code]);
    }
    if ((err as any)?.name === "ZodError") {
      return fail("INVALID", (err as any).errors?.[0]?.message || "Invalid request", 400);
    }
    return handleError(err);
  }
}
