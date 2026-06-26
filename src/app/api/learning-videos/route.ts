import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { listSavedLearningVideos, saveLearningVideo, searchLearningVideos, shownLearningVideos, startLearningVideoCast } from "@/lib/services/learning-video.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = req.nextUrl.searchParams.get("q") || "";
    if (req.nextUrl.searchParams.get("shown")) return ok({ sessions: await shownLearningVideos(user) });
    if (q) return ok(await searchLearningVideos(user, q));
    return ok({ saved: await listSavedLearningVideos(user), sessions: await shownLearningVideos(user) });
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["save", "cast"]) }).parse(body).action;
    if (action === "cast") {
      const input = z.object({ videoId: z.string().min(1), classId: z.string().optional() }).parse(body);
      return ok(await startLearningVideoCast(user, input), 201);
    }
    const input = z.object({ youtubeUrlOrId: z.string().min(3), title: z.string().max(200).optional(), description: z.string().max(1000).optional(), channelTitle: z.string().max(120).optional(), thumbnailUrl: z.string().max(500).optional() }).parse(body);
    return ok(await saveLearningVideo(user, input), 201);
  } catch (error) { return handleError(error); }
}
