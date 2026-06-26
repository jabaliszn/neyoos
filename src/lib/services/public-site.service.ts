/**
 * G.11 Public School Landing Site — backend service.
 *
 * This is the real database layer for a school's public subdomain website. Public
 * reads use the tenant slug and only return published rows. Management writes use
 * the signed-in school user and are tenant-scoped through tenantDb().
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import type {
  PublicSiteSettingsInput,
  PublicSiteLeaderInput,
  PublicSiteTestimonialInput,
  PublicSiteGalleryImageInput,
  PublicSiteActivityInput,
  PublicSiteNewsPostInput,
  WhyChooseUsItem,
} from "@/lib/validations/public-site";

export class PublicSiteError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "INVALID", message: string) {
    super(message);
    this.name = "PublicSiteError";
  }
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function publicSettingsFallback(tenant: {
  name: string;
  motto: string | null;
  about: string | null;
}) {
  return {
    heroHeadline: "Nurturing Excellence & Character",
    heroSubheading:
      tenant.about ||
      `Welcome to ${tenant.name}. We provide a values-first environment where learners grow academically, socially, and emotionally.`,
    heroImageUrl: "",
    history: "",
    whyChooseUs: [] as WhyChooseUsItem[],
    mapEmbedUrl: "",
    seoTitle: `${tenant.name} — ${tenant.motto || "School in Kenya"}`,
    seoDescription: tenant.about || `${tenant.name} admissions, academics, school news and parent portal access.`,
    ogImageUrl: "",
    primaryCtaLabel: "Begin Application",
    secondaryCtaLabel: "Parent Portal",
  };
}

function mapSettings(row: any, tenant: { name: string; motto: string | null; about: string | null }) {
  const fallback = publicSettingsFallback(tenant);
  if (!row) return fallback;
  return {
    heroHeadline: row.heroHeadline || fallback.heroHeadline,
    heroSubheading: row.heroSubheading || fallback.heroSubheading,
    heroImageUrl: row.heroImageUrl || "",
    history: row.history || "",
    whyChooseUs: parseJson<WhyChooseUsItem[]>(row.whyChooseUs, []),
    mapEmbedUrl: row.mapEmbedUrl || "",
    seoTitle: row.seoTitle || fallback.seoTitle,
    seoDescription: row.seoDescription || fallback.seoDescription,
    ogImageUrl: row.ogImageUrl || "",
    primaryCtaLabel: row.primaryCtaLabel || fallback.primaryCtaLabel,
    secondaryCtaLabel: row.secondaryCtaLabel || fallback.secondaryCtaLabel,
  };
}

function safeSocialLinks(value: string | null): Record<string, string> {
  return parseJson<Record<string, string>>(value, {});
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await tenantDb().auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action,
      entityType,
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/** Public read: complete published landing payload for a tenant slug. */
export async function publicSiteBySlug(slug: string) {
  const tenant = await db.tenant.findUnique({
    where: { slug },
    include: { publicSiteSettings: true },
  });
  if (!tenant) throw new PublicSiteError("NOT_FOUND", "School website not found.");

  const [studentCount, classCount, staffCount, leaders, testimonials, gallery, activities, news] =
    await Promise.all([
      db.student.count({ where: { tenantId: tenant.id, status: "ACTIVE" } }),
      db.schoolClass.count({ where: { tenantId: tenant.id, archived: false } }),
      db.user.count({ where: { tenantId: tenant.id, isActive: true } }),
      db.publicSiteLeader.findMany({
        where: { tenantId: tenant.id, published: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 8,
      }),
      db.publicSiteTestimonial.findMany({
        where: { tenantId: tenant.id, published: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 6,
      }),
      db.publicSiteGalleryImage.findMany({
        where: { tenantId: tenant.id, published: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 12,
      }),
      db.publicSiteActivity.findMany({
        where: { tenantId: tenant.id, published: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 8,
      }),
      db.newsPost.findMany({
        where: { tenantId: tenant.id, status: "PUBLISHED" },
        orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
        take: 6,
      }),
    ]);

  return {
    school: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      county: tenant.county ?? "",
      phone: tenant.phone ?? "",
      email: tenant.email ?? "",
      motto: tenant.motto ?? "",
      vision: tenant.vision ?? "",
      mission: tenant.mission ?? "",
      about: tenant.about ?? "",
      logoUrl: tenant.logoUrl ?? "",
      brandPrimary: tenant.brandPrimary ?? "#1c2740",
      brandAccent: tenant.brandAccent ?? "#1f9d5f",
      addressLine: tenant.addressLine ?? "",
      curriculum: tenant.curriculum ?? "",
      schoolType: tenant.schoolType,
      socialLinks: safeSocialLinks(tenant.socialLinks),
    },
    settings: mapSettings(tenant.publicSiteSettings, tenant),
    stats: { studentCount, classCount, staffCount },
    leaders,
    testimonials,
    gallery,
    activities,
    news,
  };
}

/** Public read: one published news post by tenant slug + post slug. */
export async function publicNewsPostBySlug(tenantSlug: string, postSlug: string) {
  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new PublicSiteError("NOT_FOUND", "School website not found.");

  const post = await db.newsPost.findFirst({
    where: { tenantId: tenant.id, slug: postSlug, status: "PUBLISHED" },
  });
  if (!post) throw new PublicSiteError("NOT_FOUND", "News post not found.");

  return { tenant, post };
}

/** Management read: full public-site content, including drafts/unpublished rows. */
export async function getPublicSiteAdmin(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      include: { publicSiteSettings: true },
    });

    const [leaders, testimonials, gallery, activities, news] = await Promise.all([
      tdb.publicSiteLeader.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      tdb.publicSiteTestimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      tdb.publicSiteGalleryImage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      tdb.publicSiteActivity.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      tdb.newsPost.findMany({ orderBy: [{ status: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }] }),
    ]);

    return {
      school: { name: tenant.name, slug: tenant.slug },
      settings: mapSettings(tenant.publicSiteSettings, tenant),
      leaders,
      testimonials,
      gallery,
      activities,
      news,
    };
  });
}

export async function updatePublicSiteSettings(user: SessionUser, input: PublicSiteSettingsInput) {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const row = await tdb.publicSiteSettings.upsert({
      where: { tenantId: user.tenantId },
      update: {
        heroHeadline: input.heroHeadline,
        heroSubheading: clean(input.heroSubheading),
        heroImageUrl: clean(input.heroImageUrl),
        history: clean(input.history),
        whyChooseUs: JSON.stringify(input.whyChooseUs ?? []),
        mapEmbedUrl: clean(input.mapEmbedUrl),
        seoTitle: clean(input.seoTitle),
        seoDescription: clean(input.seoDescription),
        ogImageUrl: clean(input.ogImageUrl),
        primaryCtaLabel: input.primaryCtaLabel,
        secondaryCtaLabel: input.secondaryCtaLabel,
      },
      create: {
        tenantId: user.tenantId,
        heroHeadline: input.heroHeadline,
        heroSubheading: clean(input.heroSubheading),
        heroImageUrl: clean(input.heroImageUrl),
        history: clean(input.history),
        whyChooseUs: JSON.stringify(input.whyChooseUs ?? []),
        mapEmbedUrl: clean(input.mapEmbedUrl),
        seoTitle: clean(input.seoTitle),
        seoDescription: clean(input.seoDescription),
        ogImageUrl: clean(input.ogImageUrl),
        primaryCtaLabel: input.primaryCtaLabel,
        secondaryCtaLabel: input.secondaryCtaLabel,
      },
    });
    await audit(user, "public_site.settings_updated", "PublicSiteSettings", row.id);
    return row;
  });
}

async function assertUniqueNewsSlug(user: SessionUser, slug: string, exceptId?: string) {
  const existing = await tenantDb().newsPost.findFirst({ where: { slug } });
  if (existing && existing.id !== exceptId) {
    throw new PublicSiteError("DUPLICATE", "Another news post already uses this slug.");
  }
}

function handlePrismaDuplicate(err: unknown, message: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new PublicSiteError("DUPLICATE", message);
  }
  throw err;
}

export async function createPublicSiteLeader(user: SessionUser, input: PublicSiteLeaderInput) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().publicSiteLeader.create({
      data: { tenantId: user.tenantId, ...input, bio: clean(input.bio), photoUrl: clean(input.photoUrl), email: clean(input.email), phone: clean(input.phone) },
    });
    await audit(user, "public_site.leader_created", "PublicSiteLeader", row.id, { name: row.name });
    return row;
  });
}

export async function updatePublicSiteLeader(user: SessionUser, id: string, input: PublicSiteLeaderInput) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().publicSiteLeader.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "Leadership profile not found.");
    const row = await tenantDb().publicSiteLeader.update({
      where: { id },
      data: { ...input, bio: clean(input.bio), photoUrl: clean(input.photoUrl), email: clean(input.email), phone: clean(input.phone) },
    });
    await audit(user, "public_site.leader_updated", "PublicSiteLeader", row.id, { name: row.name });
    return row;
  });
}

export async function deletePublicSiteLeader(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().publicSiteLeader.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "Leadership profile not found.");
    await tenantDb().publicSiteLeader.delete({ where: { id } });
    await audit(user, "public_site.leader_deleted", "PublicSiteLeader", id, { name: existing.name });
    return { success: true };
  });
}

export async function createPublicSiteTestimonial(user: SessionUser, input: PublicSiteTestimonialInput) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().publicSiteTestimonial.create({
      data: {
        tenantId: user.tenantId,
        quote: input.quote,
        guardianName: input.guardianName,
        relationship: clean(input.relationship),
        studentName: clean(input.studentName),
        photoUrl: clean(input.photoUrl),
        sortOrder: input.sortOrder,
        published: input.published,
      },
    });
    await audit(user, "public_site.testimonial_created", "PublicSiteTestimonial", row.id, { guardianName: row.guardianName });
    return row;
  });
}

export async function updatePublicSiteTestimonial(user: SessionUser, id: string, input: PublicSiteTestimonialInput) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().publicSiteTestimonial.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "Testimonial not found.");
    const row = await tenantDb().publicSiteTestimonial.update({
      where: { id },
      data: {
        quote: input.quote,
        guardianName: input.guardianName,
        relationship: clean(input.relationship),
        studentName: clean(input.studentName),
        photoUrl: clean(input.photoUrl),
        sortOrder: input.sortOrder,
        published: input.published,
      },
    });
    await audit(user, "public_site.testimonial_updated", "PublicSiteTestimonial", row.id, { guardianName: row.guardianName });
    return row;
  });
}

export async function deletePublicSiteTestimonial(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().publicSiteTestimonial.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "Testimonial not found.");
    await tenantDb().publicSiteTestimonial.delete({ where: { id } });
    await audit(user, "public_site.testimonial_deleted", "PublicSiteTestimonial", id, { guardianName: existing.guardianName });
    return { success: true };
  });
}

export async function createPublicSiteGalleryImage(user: SessionUser, input: PublicSiteGalleryImageInput) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().publicSiteGalleryImage.create({ data: { tenantId: user.tenantId, ...input, caption: clean(input.caption) } });
    await audit(user, "public_site.gallery_created", "PublicSiteGalleryImage", row.id, { title: row.title });
    return row;
  });
}

export async function updatePublicSiteGalleryImage(user: SessionUser, id: string, input: PublicSiteGalleryImageInput) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().publicSiteGalleryImage.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "Gallery image not found.");
    const row = await tenantDb().publicSiteGalleryImage.update({ where: { id }, data: { ...input, caption: clean(input.caption) } });
    await audit(user, "public_site.gallery_updated", "PublicSiteGalleryImage", row.id, { title: row.title });
    return row;
  });
}

export async function deletePublicSiteGalleryImage(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().publicSiteGalleryImage.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "Gallery image not found.");
    await tenantDb().publicSiteGalleryImage.delete({ where: { id } });
    await audit(user, "public_site.gallery_deleted", "PublicSiteGalleryImage", id, { title: existing.title });
    return { success: true };
  });
}

export async function createPublicSiteActivity(user: SessionUser, input: PublicSiteActivityInput) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().publicSiteActivity.create({ data: { tenantId: user.tenantId, ...input, iconName: clean(input.iconName) } });
    await audit(user, "public_site.activity_created", "PublicSiteActivity", row.id, { title: row.title });
    return row;
  });
}

export async function updatePublicSiteActivity(user: SessionUser, id: string, input: PublicSiteActivityInput) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().publicSiteActivity.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "Activity not found.");
    const row = await tenantDb().publicSiteActivity.update({ where: { id }, data: { ...input, iconName: clean(input.iconName) } });
    await audit(user, "public_site.activity_updated", "PublicSiteActivity", row.id, { title: row.title });
    return row;
  });
}

export async function deletePublicSiteActivity(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().publicSiteActivity.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "Activity not found.");
    await tenantDb().publicSiteActivity.delete({ where: { id } });
    await audit(user, "public_site.activity_deleted", "PublicSiteActivity", id, { title: existing.title });
    return { success: true };
  });
}

export async function createPublicSiteNewsPost(user: SessionUser, input: PublicSiteNewsPostInput) {
  return withTenant(user.tenantId, async () => {
    await assertUniqueNewsSlug(user, input.slug);
    try {
      const row = await tenantDb().newsPost.create({
        data: {
          tenantId: user.tenantId,
          title: input.title,
          slug: input.slug,
          excerpt: clean(input.excerpt),
          content: input.content,
          imageFileUrl: clean(input.imageFileUrl),
          status: input.status,
          featured: input.featured,
          publishedAt: input.status === "PUBLISHED" ? input.publishedAt : null,
        },
      });
      await audit(user, "public_site.news_created", "NewsPost", row.id, { title: row.title, status: row.status });
      return row;
    } catch (err) {
      handlePrismaDuplicate(err, "Another news post already uses this slug.");
    }
  });
}

export async function updatePublicSiteNewsPost(user: SessionUser, id: string, input: PublicSiteNewsPostInput) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().newsPost.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "News post not found.");
    await assertUniqueNewsSlug(user, input.slug, id);
    try {
      const row = await tenantDb().newsPost.update({
        where: { id },
        data: {
          title: input.title,
          slug: input.slug,
          excerpt: clean(input.excerpt),
          content: input.content,
          imageFileUrl: clean(input.imageFileUrl),
          status: input.status,
          featured: input.featured,
          publishedAt: input.status === "PUBLISHED" ? input.publishedAt : null,
        },
      });
      await audit(user, "public_site.news_updated", "NewsPost", row.id, { title: row.title, status: row.status });
      return row;
    } catch (err) {
      handlePrismaDuplicate(err, "Another news post already uses this slug.");
    }
  });
}

export async function deletePublicSiteNewsPost(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().newsPost.findFirst({ where: { id } });
    if (!existing) throw new PublicSiteError("NOT_FOUND", "News post not found.");
    await tenantDb().newsPost.delete({ where: { id } });
    await audit(user, "public_site.news_deleted", "NewsPost", id, { title: existing.title });
    return { success: true };
  });
}
