import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { toggleRequirement } from "@/lib/services/student.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ fulfilled: z.boolean() });

/** PUT /api/student-requirements/:id — tick a joining requirement on/off (G.9/B.1). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.edit");
    const { fulfilled } = schema.parse(await req.json().catch(() => ({})));
    const result = await toggleRequirement(user, params.id, fulfilled);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
