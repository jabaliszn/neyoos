import crypto from "crypto";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { readCompanySecret } from "@/lib/services/company-secret.service";

export class LearningVideoError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "EXTERNAL_UNAVAILABLE", message: string) { super(message); this.name = "LearningVideoError"; }
}

type SearchHit = { youtubeId: string; title: string; description?: string | null; channelTitle?: string | null; thumbnailUrl?: string | null; saved?: boolean };

export function youtubeEmbedUrl(youtubeId: string) {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`;
}

function cleanYoutubeId(value: string) {
  const raw = value.trim();
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,20})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,20})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,20})/,
    /^([a-zA-Z0-9_-]{6,20})$/,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m) return m[1];
  }
  throw new LearningVideoError("INVALID", "Paste a valid YouTube video link or ID.");
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action, entityType, entityId, metadata: metadata ? JSON.stringify(metadata) : null } });
}

export async function listSavedLearningVideos(user: SessionUser, q?: string) {
  return withTenant(user.tenantId, async () => {
    const s = q?.trim();
    const rows = await tenantDb().learningVideo.findMany({
      where: s ? { OR: [{ title: { contains: s } }, { description: { contains: s } }, { channelTitle: { contains: s } }] } : {},
      orderBy: { updatedAt: "desc" },
      take: 80,
    });
    return rows.map((v) => ({ ...v, embedUrl: youtubeEmbedUrl(v.youtubeId), saved: true }));
  });
}

export async function searchLearningVideos(user: SessionUser, q: string) {
  return withTenant(user.tenantId, async () => {
    const saved = await listSavedLearningVideos(user, q);
    const apiKey = (await readCompanySecret("youtube_api_key")) || process.env.YOUTUBE_API_KEY;
    if (!q.trim() || !apiKey) {
      return { saved, external: [] as SearchHit[], youtubeSearchConfigured: Boolean(apiKey), note: apiKey ? null : "Add the YouTube Data API key in NEYO Ops → Integration Credential Vault to enable live YouTube search. Saved school videos still work." };
    }
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "8");
    url.searchParams.set("safeSearch", "strict");
    url.searchParams.set("videoEmbeddable", "true");
    url.searchParams.set("relevanceLanguage", "en");
    url.searchParams.set("regionCode", "KE");
    url.searchParams.set("videoCategoryId", "27");
    const res = await fetch(url.toString(), { next: { revalidate: 300 } }).catch(() => null);
    if (!res?.ok) return { saved, external: [] as SearchHit[], youtubeSearchConfigured: true, note: "YouTube search is temporarily unavailable; saved videos still work." };
    const json = await res.json() as any;
    const savedIds = new Set(saved.map((v: any) => v.youtubeId));
    const external: SearchHit[] = (json.items ?? []).map((item: any) => ({
      youtubeId: item.id?.videoId,
      title: item.snippet?.title,
      description: item.snippet?.description,
      channelTitle: item.snippet?.channelTitle,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      saved: savedIds.has(item.id?.videoId),
    })).filter((x: SearchHit) => x.youtubeId && x.title);
    return { saved, external, youtubeSearchConfigured: true, note: null };
  });
}

export async function saveLearningVideo(user: SessionUser, input: { youtubeUrlOrId: string; title?: string; description?: string; channelTitle?: string; thumbnailUrl?: string }) {
  return withTenant(user.tenantId, async () => {
    const youtubeId = cleanYoutubeId(input.youtubeUrlOrId);
    const row = await db.learningVideo.upsert({
      where: { tenantId_youtubeId: { tenantId: user.tenantId, youtubeId } },
      create: { tenantId: user.tenantId, youtubeId, title: input.title?.trim() || `YouTube video ${youtubeId}`, description: input.description || null, channelTitle: input.channelTitle || null, thumbnailUrl: input.thumbnailUrl || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`, savedById: user.id, savedByName: user.fullName },
      update: { title: input.title?.trim() || undefined, description: input.description || undefined, channelTitle: input.channelTitle || undefined, thumbnailUrl: input.thumbnailUrl || undefined },
    });
    await audit(user, "learning.video_saved", "learningVideo", row.id, { youtubeId, title: row.title });
    return { ...row, embedUrl: youtubeEmbedUrl(row.youtubeId) };
  });
}

function castCode() { return `LV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`; }

export async function startLearningVideoCast(user: SessionUser, input: { videoId: string; classId?: string }) {
  return withTenant(user.tenantId, async () => {
    const video = await tenantDb().learningVideo.findUnique({ where: { id: input.videoId } });
    if (!video) throw new LearningVideoError("NOT_FOUND", "Saved learning video not found.");
    let classLabel: string | null = null;
    if (input.classId) {
      const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.classId } });
      classLabel = cls ? [cls.level, cls.stream].filter(Boolean).join(" ") : null;
    }
    const row = await db.learningVideoSession.create({ data: { tenantId: user.tenantId, videoId: video.id, youtubeId: video.youtubeId, title: video.title, classId: input.classId || null, classLabel, castCode: castCode(), startedById: user.id, startedByName: user.fullName } });
    await audit(user, "learning.video_cast_started", "learningVideoSession", row.id, { title: video.title, classLabel });
    return { ...row, embedUrl: youtubeEmbedUrl(row.youtubeId), castUrl: `/learning-videos/cast/${row.castCode}` };
  });
}

export async function shownLearningVideos(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().learningVideoSession.findMany({ orderBy: { startedAt: "desc" }, take: 80, include: { video: true } });
    return rows.map((r) => ({ id: r.id, title: r.title, youtubeId: r.youtubeId, classLabel: r.classLabel, startedByName: r.startedByName, startedAt: r.startedAt, embedUrl: youtubeEmbedUrl(r.youtubeId), videoId: r.videoId }));
  });
}

export async function publicCastSession(code: string) {
  const row = await db.learningVideoSession.findUnique({ where: { castCode: code }, include: { video: true, tenant: { select: { name: true, logoUrl: true } } } });
  if (!row) throw new LearningVideoError("NOT_FOUND", "Class screen session not found.");
  return { ...row, embedUrl: youtubeEmbedUrl(row.youtubeId) };
}
