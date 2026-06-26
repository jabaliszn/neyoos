"use client";

import * as React from "react";
import { usePermissions } from "./permissions-provider";

/**
 * <Can> — render children only when the user has the required permission(s).
 * (Features A.3.5)
 *
 * USE INSIDE CLIENT COMPONENTS. Don't wrap server-rendered children from a
 * Server Component (RSC can't pass some props across the boundary). In server
 * components, render a small client component that calls usePermission() instead
 * (see components/dashboard/quick-actions.tsx).
 *
 *   <Can permission="finance.record_payment"> <Button>…</Button> </Can>
 *   <Can anyOf={["staff.view","staff.manage"]}> … </Can>
 *   <Can allOf={["exam.enter_marks","exam.publish"]} fallback={<Locked/>}>…</Can>
 */
export function Can({
  permission,
  anyOf,
  allOf,
  fallback = null,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { has, hasAny, hasAll } = usePermissions();

  let allowed = true;
  if (permission) allowed = allowed && has(permission);
  if (anyOf) allowed = allowed && hasAny(anyOf);
  if (allOf) allowed = allowed && hasAll(allOf);

  return <>{allowed ? children : fallback}</>;
}
