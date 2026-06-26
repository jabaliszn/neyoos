import { z } from "zod";
import { db } from "@/lib/db";

export const neyoYoutubePostSchema = z.object({
  title: z.string().trim().min(3).max(180),
  youtubeUrlOrId: z.string().trim().max(500).optional().or(z.literal("")),
  caption: z.string().trim().min(3).max(2000),
  audience: z.enum(["SCHOOLS", "PARENTS", "TEACHERS", "STUDENTS", "PUBLIC"]).default("SCHOOLS"),
  channel: z.enum(["NEYO_YOUTUBE", "SCHOOL_CHANNEL", "OTHER"]).default("NEYO_YOUTUBE"),
  status: z.enum(["DRAFT", "SCHEDULED", "READY", "POSTED", "CANCELLED"]).default("DRAFT"),
  scheduledFor: z.string().optional().or(z.literal("")),
  postedUrl: z.string().trim().max(500).optional().or(z.literal("")),
  ownerName: z.string().trim().max(100).optional().or(z.literal("")),
  schoolTenantId: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const neyoYoutubeStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["DRAFT", "SCHEDULED", "READY", "POSTED", "CANCELLED"]),
  postedUrl: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type NeyoYoutubePostInput = z.infer<typeof neyoYoutubePostSchema>;

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function extractYoutubeId(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,20})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,20})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,20})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,20})/,
    /^([a-zA-Z0-9_-]{6,20})$/,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function normalizeDate(value?: string) {
  const cleaned = cleanOptional(value);
  if (!cleaned) return null;
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function listNeyoYoutubePosts(limit = 80) {
  return db.neyoYoutubePost.findMany({
    orderBy: [{ status: "asc" }, { scheduledFor: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });
}

export async function upsertNeyoYoutubePost(
  actor: { id: string; fullName: string; tenantId: string },
  input: NeyoYoutubePostInput,
  id?: string
) {
  const data = neyoYoutubePostSchema.parse(input);
  const youtubeId = extractYoutubeId(data.youtubeUrlOrId);
  const payload = {
    title: data.title,
    youtubeUrlOrId: cleanOptional(data.youtubeUrlOrId),
    youtubeId,
    caption: data.caption,
    audience: data.audience,
    channel: data.channel,
    status: data.status,
    scheduledFor: normalizeDate(data.scheduledFor),
    postedUrl: cleanOptional(data.postedUrl),
    ownerName: cleanOptional(data.ownerName),
    schoolTenantId: cleanOptional(data.schoolTenantId),
    notes: cleanOptional(data.notes),
  };

  const row = id
    ? await db.neyoYoutubePost.update({ where: { id }, data: payload })
    : await db.neyoYoutubePost.create({ data: { ...payload, createdById: actor.id, createdByName: actor.fullName } });

  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: id ? "platform.youtube_post_updated" : "platform.youtube_post_created",
      entityType: "NeyoYoutubePost",
      entityId: row.id,
      metadata: JSON.stringify({ title: row.title, status: row.status, scheduledFor: row.scheduledFor, youtubeId: row.youtubeId }),
    },
  });

  return row;
}

export async function updateNeyoYoutubePostStatus(
  actor: { id: string; fullName: string; tenantId: string },
  input: z.infer<typeof neyoYoutubeStatusSchema>
) {
  const data = neyoYoutubeStatusSchema.parse(input);
  const row = await db.neyoYoutubePost.update({
    where: { id: data.id },
    data: { status: data.status, postedUrl: cleanOptional(data.postedUrl), notes: cleanOptional(data.notes) ?? undefined },
  });

  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.youtube_post_status_updated",
      entityType: "NeyoYoutubePost",
      entityId: row.id,
      metadata: JSON.stringify({ status: row.status, postedUrl: row.postedUrl }),
    },
  });

  return row;
}

export async function deleteNeyoYoutubePost(actor: { id: string; fullName: string; tenantId: string }, id: string) {
  const row = await db.neyoYoutubePost.delete({ where: { id } });
  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.youtube_post_deleted",
      entityType: "NeyoYoutubePost",
      entityId: row.id,
      metadata: JSON.stringify({ title: row.title, status: row.status }),
    },
  });
  return { success: true };
}
