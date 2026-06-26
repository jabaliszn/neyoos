/**
 * G.8 Polish — Saved filters / saved views service.
 * Allows users to persist their search/filter criteria for lists (students,
 * invoices, etc.) and recall them in one click.
 * Scoped cleanly per tenant & user for complete privacy.
 */
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class SavedViewError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE", message: string) {
    super(message);
    this.name = "SavedViewError";
  }
}

/** Create a new saved view. */
export async function createSavedView(
  user: SessionUser,
  input: { entityType: string; name: string; filters: Record<string, any> }
) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const type = input.entityType.toLowerCase();
    const name = input.name.trim();

    // Prevent duplicate name for the same user + entityType
    const dup = await tdb.savedView.findFirst({
      where: { userId: user.id, entityType: type, name },
    });
    if (dup) throw new SavedViewError("DUPLICATE", "A saved view with this name already exists.");

    const row = await tdb.savedView.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        entityType: type,
        name,
        filters: JSON.stringify(input.filters),
      },
    });

    return row;
  });
}

/** List all saved views for a specific entityType and user. */
export async function listSavedViews(user: SessionUser, entityType: string) {
  return withTenant(user.tenantId, async () => {
    const type = entityType.toLowerCase();
    const views = await tenantDb().savedView.findMany({
      where: { userId: user.id, entityType: type },
      orderBy: { createdAt: "desc" },
    });

    return views.map((v) => ({
      id: v.id,
      name: v.name,
      filters: JSON.parse(v.filters),
      createdAt: v.createdAt,
    }));
  });
}

/** Delete a saved view. */
export async function deleteSavedView(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const view = await tdb.savedView.findFirst({
      where: { id, userId: user.id },
    });
    if (!view) throw new SavedViewError("NOT_FOUND", "Saved view not found.");

    await tdb.savedView.delete({ where: { id } });
    return { success: true };
  });
}
