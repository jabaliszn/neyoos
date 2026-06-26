"use client";

import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/auth/permissions-provider";

/**
 * Dashboard quick actions, gated by permission (A.3.5).
 * Client component so it can read the permissions context directly.
 */
export function QuickActions() {
  const { has, hasAny } = usePermissions();

  const anyVisible = hasAny([
    "student.create",
    "finance.record_payment",
    "comms.send",
  ]);

  return (
    <div className="space-y-2">
      {has("student.create") && (
        <Button variant="secondary" className="w-full justify-start">
          Register a new student
        </Button>
      )}
      {has("finance.record_payment") && (
        <Button variant="secondary" className="w-full justify-start">
          Record a fee payment
        </Button>
      )}
      {has("comms.send") && (
        <Button variant="secondary" className="w-full justify-start">
          Send an SMS to a class
        </Button>
      )}
      {!anyVisible && (
        <p className="px-1 py-2 text-sm text-navy-400 dark:text-navy-500">
          No quick actions for your role yet.
        </p>
      )}
    </div>
  );
}
