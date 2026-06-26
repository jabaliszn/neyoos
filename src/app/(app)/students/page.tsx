import Link from "next/link";
import { Users, UploadCloud, GraduationCap, ArrowUpRight } from "lucide-react";
import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { Button } from "@/components/ui/button";
import { StudentsClient } from "@/components/students/students-client";

export const dynamic = "force-dynamic";

/** Students list (B.1.1/7/8). Row-scoped per role on the server. */
export default async function StudentsPage() {
  const user = await requirePagePermission("student.view");
  const canCreate = can(user.role, "student.create");
  const canManageClasses = can(user.role, "class.manage");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Students</h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
            Registration, profiles, classes and status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/students/alumni">
            <Button variant="secondary"><GraduationCap className="h-4 w-4" /> Alumni</Button>
          </Link>
          {canCreate && (
            <Link href="/students/import">
              <Button variant="secondary"><UploadCloud className="h-4 w-4" /> Import</Button>
            </Link>
          )}
          {canManageClasses && (
            <>
              <Link href="/classes">
                <Button variant="secondary"><Users className="h-4 w-4" /> Manage classes</Button>
              </Link>
              <Link href="/students/promotion">
                <Button variant="secondary"><ArrowUpRight className="h-4 w-4" /> New year</Button>
              </Link>
            </>
          )}
        </div>
      </div>
      <StudentsClient canCreate={canCreate} />
    </div>
  );
}
