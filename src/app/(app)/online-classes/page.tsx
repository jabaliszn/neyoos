import { requirePageUser } from "@/lib/core/page-guards";
import { OnlineClassesClient } from "@/components/online-classes/online-classes-client";

export const dynamic = "force-dynamic";

export default async function OnlineClassesPage() {
  await requirePageUser();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Online Live Classes</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">Request, start and join secure NEYO live classes from home, mobile or classroom TVs.</p>
      </div>
      <OnlineClassesClient />
    </div>
  );
}
