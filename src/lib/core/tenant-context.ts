/**
 * Tenant context (Feature A.2 — Multi-Tenancy).
 * An AsyncLocalStorage holds the current tenantId for the duration of a request,
 * so tenantDb() and services can read it without it being passed everywhere.
 *
 * `withTenant(tenantId, fn)` runs `fn` with that tenant in scope.
 * `getTenantId()` reads it; `requireTenantId()` throws if none is set.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Run `fn` with the given tenant in scope. Every awaited call inside sees it. */
export function withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  if (!tenantId) {
    throw new Error("withTenant called without a tenantId");
  }
  return storage.run({ tenantId }, fn);
}

/** Current tenantId, or null if not inside a withTenant scope. */
export function getTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}

/** Current tenantId, or throw. Use in tenant-scoped code paths. */
export function requireTenantId(): string {
  const id = getTenantId();
  if (!id) {
    throw new Error(
      "No tenant in scope. Wrap this call in withTenant(tenantId, ...)."
    );
  }
  return id;
}
