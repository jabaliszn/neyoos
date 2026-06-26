import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/core/page-guards";
import { can } from "@/lib/core/permissions";
import { ClassesClient } from "@/components/students/classes-client";

export const dynamic = "force-dynamic";

/** Classes & streams management (B.1). */
export default async function ClassesPage() {
  const user = await requirePagePermission("student.view");
  const canManage = can(user.role, "class.manage");
  return (
    <div className="space-y-6">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-800 dark:text-navy-400">
        <ArrowLeft className="h-4 w-4" /> Students
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Classes & streams</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">Organise students into classes, streams and curricula.</p>
      </div>
      <ClassesClient canManage={canManage} />
    </div>
  );
}
