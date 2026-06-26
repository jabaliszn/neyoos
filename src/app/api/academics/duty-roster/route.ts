import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { dutyRosterBoard, generateDutyRoster } from "@/lib/services/duty-roster.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("academics.view");
    return ok(await dutyRosterBoard(user));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const input = z.object({
      rotationPeriod: z.enum(["WEEKLY", "BI_WEEKLY", "MONTHLY"]),
      teacherIds: z.array(z.string()).min(1),
      teachersPerCycle: z.coerce.number().int().min(1).max(12).optional(),
    }).parse(await req.json().catch(() => ({})));
    return ok(await generateDutyRoster(user, input));
  } catch (e) {
    return handleError(e);
  }
}
