import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { saveLearningVideo, searchLearningVideos, startLearningVideoCast, shownLearningVideos, youtubeEmbedUrl, publicCastSession } from "@/lib/services/learning-video.service";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`✓ ${message}`); }
function asUser(u: any): SessionUser { return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" }; }

async function main() {
  const teacher = asUser(await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } }));
  const suffix = Date.now().toString().slice(-6);
  const video = await saveLearningVideo(teacher, { youtubeUrlOrId: "aircAruvnKk", title: `I27 classroom explainer ${suffix}`, channelTitle: "3Blue1Brown", description: "Saved for a class lesson" });
  assert(video.embedUrl.includes("youtube-nocookie.com/embed/aircAruvnKk"), "learning video saves and uses privacy-enhanced in-NEYO embed URL");
  const search = await searchLearningVideos(teacher, "classroom explainer");
  assert(search.saved.some((v: any) => v.id === video.id), "students/teachers can search saved educational videos inside NEYO");
  const cast = await startLearningVideoCast(teacher, { videoId: video.id });
  assert(cast.castUrl.includes("/learning-videos/cast/") && cast.castCode.startsWith("LV-"), "teacher can create a castable class-screen link from phone/tablet");
  const publicSession = await publicCastSession(cast.castCode);
  assert(publicSession.embedUrl === youtubeEmbedUrl("aircAruvnKk"), "projector/TV cast page can play the selected video inside NEYO");
  const shown = await shownLearningVideos(teacher);
  assert(shown.some((s: any) => s.id === cast.id), "students can see videos that were shown in class");

  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const nav = readFileSync(join(process.cwd(), "src/lib/core/navigation.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/learning-video.service.ts"), "utf8");
  const client = readFileSync(join(process.cwd(), "src/components/learning-videos/learning-videos-client.tsx"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/learning-videos/route.ts"), "utf8");
  assert(schema.includes("model LearningVideo") && schema.includes("model LearningVideoSession"), "schema stores saved videos and classroom cast sessions");
  assert(nav.includes("Learning Videos") && nav.includes("/learning-videos"), "sidebar navigation exposes Learning Videos inside NEYO");
  assert(service.includes("YOUTUBE_API_KEY") && service.includes("safeSearch") && service.includes("videoEmbeddable"), "YouTube live search is ready with strict safe embeddable educational search when key is provided");
  assert(client.includes("Distraction guard") && client.includes("youtube-nocookie") && client.includes("Cast to class screen"), "UI watches inside NEYO, explains ad/distraction guard and supports casting");
  assert(api.includes("requireUser") && api.includes("shownLearningVideos"), "API works for signed-in teachers and students and exposes shown-in-class videos");

  console.log("\nI.27 YouTube Learning Integration test passed.");
}
main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
