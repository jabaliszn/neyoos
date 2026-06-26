import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { upsertNeyoYoutubePost, updateNeyoYoutubePostStatus, deleteNeyoYoutubePost } from "../src/lib/services/neyo-youtube.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260624143000_i48_youtube_ops_posts/migration.sql"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/neyo-youtube.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const doc = readFileSync(join(process.cwd(), "docs/YOUTUBE-MANAGEMENT-POSTING-STRATEGY.md"), "utf8");

  assert(schema.includes("model NeyoYoutubePost"), "Database has company-level NeyoYoutubePost model");
  assert(migration.includes("CREATE TABLE \"NeyoYoutubePost\""), "Migration creates NeyoYoutubePost table");
  assert(service.includes("upsertNeyoYoutubePost") && service.includes("platform.youtube_post_created"), "Service creates/updates YouTube posting records with audit logs");
  assert(api.includes("upsert_youtube_post") && api.includes("listNeyoYoutubePosts"), "Founder Ops API exposes YouTube posting management actions/data");
  assert(ui.includes("YouTube Management & Posting Hub") && ui.includes("Save YouTube Posting Record"), "Business Operations UI includes YouTube management/posting hub");
  assert(ui.includes("does not pretend to upload without YouTube channel authorization"), "UI honestly explains YouTube upload authorization boundary");
  assert(doc.includes("Future YouTube API activation") && doc.includes("NEYO Ops posting management"), "YouTube management/posting strategy document exists");

  const actor = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert(actor, "SUPER_ADMIN actor exists");
  const tenant = await db.tenant.findFirst();

  const post = await upsertNeyoYoutubePost(actor!, {
    title: "Karibu High fee receipt tutorial",
    youtubeUrlOrId: "https://youtu.be/dQw4w9WgXcQ",
    caption: "A short NEYO tutorial for schools on fee receipt workflows.",
    audience: "SCHOOLS",
    channel: "NEYO_YOUTUBE",
    status: "SCHEDULED",
    scheduledFor: "2026-06-25T09:00:00.000Z",
    ownerName: "Njeri Support",
    schoolTenantId: tenant?.id || "",
    notes: "Confirm thumbnail before posting.",
  });
  assert(post.youtubeId === "dQw4w9WgXcQ", "Service extracts YouTube ID from a URL");
  assert(post.status === "SCHEDULED", "Service stores scheduled posting state");

  const updated = await updateNeyoYoutubePostStatus(actor!, { id: post.id, status: "POSTED", postedUrl: "https://youtu.be/dQw4w9WgXcQ", notes: "Published from official NEYO channel." });
  assert(updated.status === "POSTED" && updated.postedUrl?.includes("youtu.be"), "Service updates posting status and posted URL");

  const audits = await db.auditLog.findMany({ where: { entityType: "NeyoYoutubePost", entityId: post.id } });
  assert(audits.some((a) => a.action === "platform.youtube_post_created") && audits.some((a) => a.action === "platform.youtube_post_status_updated"), "Posting create/status actions are audit logged");

  await deleteNeyoYoutubePost(actor!, post.id);
  const removed = await db.neyoYoutubePost.findUnique({ where: { id: post.id } });
  assert(!removed, "Service deletes YouTube posting records when removed from NEYO Ops");

  console.log("\nI.48 YouTube Ops Management checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
