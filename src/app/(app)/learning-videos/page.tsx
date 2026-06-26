import { requirePageUser } from "@/lib/core/page-guards";
import { LearningVideosClient } from "@/components/learning-videos/learning-videos-client";

export const dynamic = "force-dynamic";

export default async function LearningVideosPage() {
  await requirePageUser();
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-navy-50">Learning Videos</h1><p className="mt-1 text-sm text-navy-500 dark:text-navy-400">Search educational videos, watch inside NEYO, and cast to a class TV or projector.</p></div><LearningVideosClient /></div>;
}
