import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/core/session";

import { getActivityCategories, createActivityCategory, ActivityError } from "@/lib/services/timetable-activities.service";
import { activityCategorySchema } from "@/lib/validations/activity";
import { ok, fail } from "@/lib/api/respond";

export async function GET() {
  try {
    const user = await requirePermission("academics.view");
    const categories = await getActivityCategories(user);
    return ok(categories);
  } catch (error) {
    return handleActivityError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission("academics.manage");
    
    const body = await req.json();
    const data = activityCategorySchema.parse(body);
    
    const category = await createActivityCategory(user, data);
    return ok(category, 201);
  } catch (error) {
    return handleActivityError(error);
  }
}

function handleActivityError(error: unknown) {
  if (error instanceof ActivityError) {
    const statusMap = {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      INVALID: 400,
      CONFLICT: 409
    };
    return fail(error.code, error.message, statusMap[error.code] as any);
  }
  if ((error as any).name === "ZodError") {
    return fail("INVALID", (error as any).errors[0].message, 400);
  }
  return fail("SERVER_ERROR", "An unexpected error occurred", 500);
}
