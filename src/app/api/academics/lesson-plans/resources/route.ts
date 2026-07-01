/**
 * J.12 — attach learning resources / evidence to an existing lesson plan.
 * POST { lessonPlanId, resources: [{ fileUrl, fileName? }] }
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { addLessonResources } from "@/lib/services/academics.service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lessonPlanId: z.string().cuid(),
  resources: z.array(z.object({ fileUrl: z.string().url(), fileName: z.string().optional() })).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const { lessonPlanId, resources } = bodySchema.parse(await req.json());
    return ok({ resources: await addLessonResources(user, lessonPlanId, resources) });
  } catch (e) {
    return handleError(e);
  }
}
