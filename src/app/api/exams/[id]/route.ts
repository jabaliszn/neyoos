/**
 * B.5 one exam: GET summary (positions/means) · POST {action:"publish"|"unpublish"} (exam.publish).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { examSummary, publishExam } from "@/lib/services/exam.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("exam.view");
    return ok(await examSummary(user, params.id));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("exam.publish");
    const { action } = z.object({ action: z.enum(["publish", "unpublish"]) }).parse(await req.json());
    return ok(await publishExam(user, params.id, action === "publish"));
  } catch (e) {
    return handleError(e);
  }
}
