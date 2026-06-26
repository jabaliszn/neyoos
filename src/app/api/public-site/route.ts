import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  PUBLIC_SITE_MANAGE_PERMISSION,
  publicSiteSettingsSchema,
  publicSiteLeaderSchema,
  publicSiteTestimonialSchema,
  publicSiteGalleryImageSchema,
  publicSiteActivitySchema,
  publicSiteNewsPostSchema,
  publicSiteIdSchema,
} from "@/lib/validations/public-site";
import {
  getPublicSiteAdmin,
  updatePublicSiteSettings,
  createPublicSiteLeader,
  updatePublicSiteLeader,
  deletePublicSiteLeader,
  createPublicSiteTestimonial,
  updatePublicSiteTestimonial,
  deletePublicSiteTestimonial,
  createPublicSiteGalleryImage,
  updatePublicSiteGalleryImage,
  deletePublicSiteGalleryImage,
  createPublicSiteActivity,
  updatePublicSiteActivity,
  deletePublicSiteActivity,
  createPublicSiteNewsPost,
  updatePublicSiteNewsPost,
  deletePublicSiteNewsPost,
} from "@/lib/services/public-site.service";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum([
    "create_leader",
    "update_leader",
    "delete_leader",
    "create_testimonial",
    "update_testimonial",
    "delete_testimonial",
    "create_gallery",
    "update_gallery",
    "delete_gallery",
    "create_activity",
    "update_activity",
    "delete_activity",
    "create_news",
    "update_news",
    "delete_news",
  ]),
  id: z.string().optional(),
  data: z.unknown().optional(),
});

function requireBodyId(id: string | undefined) {
  return publicSiteIdSchema.parse({ id }).id;
}

/** GET /api/public-site — management payload including drafts/unpublished rows. */
export async function GET() {
  try {
    const user = await requirePermission(PUBLIC_SITE_MANAGE_PERMISSION);
    const site = await getPublicSiteAdmin(user);
    return ok({ site });
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/public-site — update landing settings. */
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(PUBLIC_SITE_MANAGE_PERMISSION);
    const input = publicSiteSettingsSchema.parse(await req.json().catch(() => ({})));
    const settings = await updatePublicSiteSettings(user, input);
    return ok({ settings });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/public-site — create/update/delete content blocks by action. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PUBLIC_SITE_MANAGE_PERMISSION);
    const body = actionSchema.parse(await req.json().catch(() => ({})));

    switch (body.action) {
      case "create_leader":
        return ok({ leader: await createPublicSiteLeader(user, publicSiteLeaderSchema.parse(body.data)) }, 201);
      case "update_leader":
        return ok({ leader: await updatePublicSiteLeader(user, requireBodyId(body.id), publicSiteLeaderSchema.parse(body.data)) });
      case "delete_leader":
        return ok(await deletePublicSiteLeader(user, requireBodyId(body.id)));

      case "create_testimonial":
        return ok({ testimonial: await createPublicSiteTestimonial(user, publicSiteTestimonialSchema.parse(body.data)) }, 201);
      case "update_testimonial":
        return ok({ testimonial: await updatePublicSiteTestimonial(user, requireBodyId(body.id), publicSiteTestimonialSchema.parse(body.data)) });
      case "delete_testimonial":
        return ok(await deletePublicSiteTestimonial(user, requireBodyId(body.id)));

      case "create_gallery":
        return ok({ image: await createPublicSiteGalleryImage(user, publicSiteGalleryImageSchema.parse(body.data)) }, 201);
      case "update_gallery":
        return ok({ image: await updatePublicSiteGalleryImage(user, requireBodyId(body.id), publicSiteGalleryImageSchema.parse(body.data)) });
      case "delete_gallery":
        return ok(await deletePublicSiteGalleryImage(user, requireBodyId(body.id)));

      case "create_activity":
        return ok({ activity: await createPublicSiteActivity(user, publicSiteActivitySchema.parse(body.data)) }, 201);
      case "update_activity":
        return ok({ activity: await updatePublicSiteActivity(user, requireBodyId(body.id), publicSiteActivitySchema.parse(body.data)) });
      case "delete_activity":
        return ok(await deletePublicSiteActivity(user, requireBodyId(body.id)));

      case "create_news":
        return ok({ post: await createPublicSiteNewsPost(user, publicSiteNewsPostSchema.parse(body.data)) }, 201);
      case "update_news":
        return ok({ post: await updatePublicSiteNewsPost(user, requireBodyId(body.id), publicSiteNewsPostSchema.parse(body.data)) });
      case "delete_news":
        return ok(await deletePublicSiteNewsPost(user, requireBodyId(body.id)));
    }
  } catch (err) {
    return handleError(err);
  }
}
