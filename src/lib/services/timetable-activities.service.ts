import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import { SessionUser } from "@/lib/core/session";
import { activityCategorySchema, type ActivityCategoryInput } from "@/lib/validations/activity";

export class ActivityError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "ActivityError";
  }
}

export async function getActivityCategories(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    return tDb.activityCategory.findMany({
      orderBy: { name: "asc" }
    });
  });
}

export async function createActivityCategory(user: SessionUser, input: ActivityCategoryInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    const existing = await tDb.activityCategory.findUnique({
      where: {
        tenantId_name: {
          tenantId: user.tenantId,
          name: input.name
        }
      }
    });

    if (existing) {
      throw new ActivityError("CONFLICT", "An activity category with this name already exists.");
    }

    return tDb.activityCategory.create({
      data: { ...input, tenantId: user.tenantId }
    });
  });
}

export async function updateActivityCategory(user: SessionUser, id: string, input: ActivityCategoryInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    const existing = await tDb.activityCategory.findUnique({ where: { id } });
    if (!existing) throw new ActivityError("NOT_FOUND", "Category not found.");

    const nameConflict = await tDb.activityCategory.findUnique({
      where: {
        tenantId_name: {
          tenantId: user.tenantId,
          name: input.name
        }
      }
    });

    if (nameConflict && nameConflict.id !== id) {
      throw new ActivityError("CONFLICT", "An activity category with this name already exists.");
    }

    return tDb.activityCategory.update({
      where: { id },
      data: input
    });
  });
}

export async function deleteActivityCategory(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();

    const existing = await tDb.activityCategory.findUnique({
      where: { id },
      include: { _count: { select: { timetableSlots: true } } }
    });

    if (!existing) throw new ActivityError("NOT_FOUND", "Category not found.");

    if (existing._count.timetableSlots > 0) {
      throw new ActivityError("CONFLICT", "Cannot delete an activity category that is in use on the timetable.");
    }

    return tDb.activityCategory.delete({ where: { id } });
  });
}
