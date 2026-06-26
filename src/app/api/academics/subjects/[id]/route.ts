/** B.4 subject update/archive. PATCH (academics.manage). */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { subjectSchema } from "@/lib/validations/academics";
import { updateSubject } from "@/lib/services/academics.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("academics.manage");
    const input = subjectSchema.partial().extend({ archived: z.boolean().optional() }).parse(await req.json());
    return ok(await updateSubject(user, params.id, input));
  } catch (e) {
    return handleError(e);
  }
}
