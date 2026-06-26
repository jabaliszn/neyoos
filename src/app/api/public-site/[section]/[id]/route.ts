import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import {
  PUBLIC_SITE_MANAGE_PERMISSION,
  publicSiteIdSchema,
} from "@/lib/validations/public-site";
import {
  deletePublicSiteLeader,
  deletePublicSiteTestimonial,
  deletePublicSiteGalleryImage,
  deletePublicSiteActivity,
  deletePublicSiteNewsPost,
} from "@/lib/services/public-site.service";

export const dynamic = "force-dynamic";

const sectionSchema = z.enum(["leaders", "testimonials", "gallery", "activities", "news"]);

/** Convenience DELETE endpoint for editor rows. */
export async function DELETE(_req: NextRequest, { params }: { params: { section: string; id: string } }) {
  try {
    const user = await requirePermission(PUBLIC_SITE_MANAGE_PERMISSION);
    const section = sectionSchema.parse(params.section);
    const id = publicSiteIdSchema.parse({ id: params.id }).id;

    if (section === "leaders") return ok(await deletePublicSiteLeader(user, id));
    if (section === "testimonials") return ok(await deletePublicSiteTestimonial(user, id));
    if (section === "gallery") return ok(await deletePublicSiteGalleryImage(user, id));
    if (section === "activities") return ok(await deletePublicSiteActivity(user, id));
    if (section === "news") return ok(await deletePublicSiteNewsPost(user, id));

    return fail("INVALID_SECTION", "Unknown public-site section.", 422);
  } catch (err) {
    return handleError(err);
  }
}
