/**
 * Bridges the auth session (A.1) to the tenant context (A.2).
 * Resolves the signed-in user's tenant and runs `fn` inside withTenant(),
 * giving the handler a tenant-scoped db via tenantDb().
 *
 * Usage in an API route:
 *   return runInTenantSession(async ({ user, db }) => { ... });
 */
import { requireUser, type SessionUser } from "@/lib/core/session";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";

export async function runInTenantSession<T>(
  fn: (ctx: { user: SessionUser; db: ReturnType<typeof tenantDb> }) => Promise<T>
): Promise<T> {
  const user = await requireUser();
  return withTenant(user.tenantId, () => fn({ user, db: tenantDb() }));
}
