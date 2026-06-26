/**
 * G.8 Polish — Bulk Student Status Update.
 * POST { studentIds: string[], status: string } -> JSON. Permission: student.edit.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError, ok } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { canViewStudent } from "@/lib/services/student.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.edit");
    const body = await req.json().catch(() => ({}));
    const studentIds = body.studentIds as string[];
    const status = body.status as string;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0 || !status) {
      return new Response("Invalid fields", { status: 422 });
    }

    let updatedCount = 0;
    for (const id of studentIds) {
      if (!(await canViewStudent(user, id))) continue;
      await db.student.update({
        where: { id, tenantId: user.tenantId },
        data: { status },
      });
      updatedCount++;
    }

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.bulk_status_updated",
        entityType: "student",
        entityId: "bulk",
        metadata: JSON.stringify({ count: updatedCount, status }),
      },
    });

    return ok({ updatedCount });
  } catch (e) {
    return handleError(e);
  }
}
