import { requirePageUser } from "@/lib/core/page-guards";
import { OnlineClassRoomClient } from "@/components/online-classes/online-class-room-client";

export default async function JoinOnlineClassPage({ params }: { params: { roomId: string } }) {
  await requirePageUser();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">Join Online Class</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">Students join from home/mobile; classroom TVs join with the TV button.</p>
      </div>
      <OnlineClassRoomClient roomId={params.roomId} />
    </div>
  );
}
