import { requirePageUser } from "@/lib/core/page-guards";
import { MessagesClient } from "@/components/messaging/messages-client";

export const dynamic = "force-dynamic";

/** Messages (A.8). Available to all signed-in users. */
export default async function MessagesPage() {
  await requirePageUser();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Messages
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Talk to colleagues and parents in one place.
        </p>
      </div>
      <MessagesClient />
    </div>
  );
}
