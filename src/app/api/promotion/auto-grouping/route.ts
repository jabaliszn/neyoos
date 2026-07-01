import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { listAutoGroupingSetup, saveAutoGroupingRule, saveTeacherWorkloadRule, runAutoGroupingPreview, commitAutoGrouping, AutoGroupingError } from "@/lib/services/l7-auto-grouping.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["save_rule", "save_workload", "preview", "commit"]),
  id: z.string().optional(),
  name: z.string().optional(),
  targetLevel: z.string().optional().nullable(),
  ruleType: z.string().optional(),
  priority: z.number().optional(),
  active: z.boolean().optional(),
  config: z.any().optional(),
  teacherId: z.string().optional().nullable(),
  maxClasses: z.number().optional().nullable(),
  maxLessonsPerWeek: z.number().optional().nullable(),
  retainSubjectLoads: z.boolean().optional(),
  retainClassTeacher: z.boolean().optional(),
  level: z.string().optional(),
});

function mapErr(e: unknown) {
  if (e instanceof AutoGroupingError) {
    const m = { NOT_FOUND: 404, INVALID: 400, CONFLICT: 409 } as const;
    return fail(e.code, e.message, m[e.code]);
  }
  return null;
}

export async function GET() {
  try {
    const user = await requirePermission("class.manage");
    return ok(await listAutoGroupingSetup(user));
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("class.manage");
    const body = schema.parse(await req.json());
    switch (body.action) {
      case "save_rule":
        return ok(await saveAutoGroupingRule(user, body));
      case "save_workload":
        return ok(await saveTeacherWorkloadRule(user, body));
      case "preview":
        return ok(await runAutoGroupingPreview(user, body.level || ""));
      case "commit":
        return ok(await commitAutoGrouping(user, body.level || ""));
      default:
        return fail("INVALID", "Unknown action", 400);
    }
  } catch (e) {
    return mapErr(e) ?? handleError(e);
  }
}
