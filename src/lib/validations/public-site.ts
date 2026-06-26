/**
 * G.11 Public School Landing Site — validation contracts.
 *
 * The public site is school-authored content shown on the tenant subdomain.
 * Editing is restricted to school leadership/settings managers; public reads only
 * expose published content.
 */
import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const requiredText = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max);
const isSafeUrl = (value: string) => {
  if (!value) return true;
  if (value.startsWith("/api/files/serve") || value.startsWith("/brand/") || value.startsWith("/public/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine(isSafeUrl, "Use a valid URL or a NEYO uploaded file URL.")
  .optional()
  .or(z.literal(""));
const requiredUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !!value && isSafeUrl(value), "Upload or paste a valid image URL.");

export const PUBLIC_SITE_MANAGE_PERMISSION = "tenant.manage_settings" as const;

export const PUBLIC_SITE_NEWS_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type PublicSiteNewsStatus = (typeof PUBLIC_SITE_NEWS_STATUSES)[number];

export const PUBLIC_SITE_GALLERY_CATEGORIES = [
  "School life",
  "Academics",
  "Sports",
  "Clubs",
  "Boarding",
  "Community",
  "Facilities",
] as const;
export type PublicSiteGalleryCategory = (typeof PUBLIC_SITE_GALLERY_CATEGORIES)[number];

export const PUBLIC_SITE_ACTIVITY_ICONS = [
  "book-open",
  "graduation-cap",
  "trophy",
  "music",
  "palette",
  "users",
  "heart-handshake",
  "leaf",
  "shield-check",
] as const;
export type PublicSiteActivityIcon = (typeof PUBLIC_SITE_ACTIVITY_ICONS)[number];

const sortOrder = z.coerce.number().int().min(0).max(999).default(0);
const published = z.boolean().default(true);

export const whyChooseUsItemSchema = z.object({
  title: requiredText(2, 80, "Give the proof point a title."),
  detail: requiredText(5, 220, "Add a short factual detail."),
});
export type WhyChooseUsItem = z.infer<typeof whyChooseUsItemSchema>;

export const publicSiteSettingsSchema = z.object({
  heroHeadline: requiredText(4, 90, "Write a clear landing-page headline."),
  heroSubheading: optionalText(320),
  heroImageUrl: optionalUrl,
  history: optionalText(1800),
  whyChooseUs: z.array(whyChooseUsItemSchema).max(6).optional(),
  mapEmbedUrl: optionalUrl,
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  ogImageUrl: optionalUrl,
  primaryCtaLabel: requiredText(2, 32, "Name the main application button."),
  secondaryCtaLabel: requiredText(2, 32, "Name the portal button."),
});
export type PublicSiteSettingsInput = z.infer<typeof publicSiteSettingsSchema>;

export const publicSiteLeaderSchema = z.object({
  name: requiredText(2, 90, "Leader name is required."),
  title: requiredText(2, 80, "Leader title is required."),
  bio: optionalText(600),
  photoUrl: optionalUrl,
  email: z.string().trim().email("Use a valid email address.").optional().or(z.literal("")),
  phone: optionalText(24),
  sortOrder,
  published,
});
export type PublicSiteLeaderInput = z.infer<typeof publicSiteLeaderSchema>;

export const publicSiteTestimonialSchema = z.object({
  quote: requiredText(10, 500, "Parent quote is required."),
  guardianName: requiredText(2, 90, "Guardian name is required."),
  relationship: optionalText(90),
  studentName: optionalText(90),
  photoUrl: optionalUrl,
  sortOrder,
  published,
});
export type PublicSiteTestimonialInput = z.infer<typeof publicSiteTestimonialSchema>;

export const publicSiteGalleryImageSchema = z.object({
  title: requiredText(2, 100, "Image title is required."),
  caption: optionalText(220),
  imageUrl: requiredUrl,
  category: z.enum(PUBLIC_SITE_GALLERY_CATEGORIES).default("School life"),
  sortOrder,
  published,
});
export type PublicSiteGalleryImageInput = z.infer<typeof publicSiteGalleryImageSchema>;

export const publicSiteActivitySchema = z.object({
  title: requiredText(2, 80, "Activity title is required."),
  description: requiredText(5, 260, "Activity description is required."),
  iconName: z.enum(PUBLIC_SITE_ACTIVITY_ICONS).optional().or(z.literal("")),
  sortOrder,
  published,
});
export type PublicSiteActivityInput = z.infer<typeof publicSiteActivitySchema>;

export const newsSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug is too short.")
  .max(90, "Slug is too long.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens.");

export const publicSiteNewsPostSchema = z
  .object({
    title: requiredText(4, 120, "News title is required."),
    slug: newsSlugSchema,
    excerpt: optionalText(220),
    content: requiredText(20, 12000, "Write the news story before publishing."),
    imageFileUrl: optionalUrl,
    status: z.enum(PUBLIC_SITE_NEWS_STATUSES).default("DRAFT"),
    featured: z.boolean().default(false),
    publishedAt: z.coerce.date().optional().nullable(),
  })
  .refine((value) => value.status === "DRAFT" || value.publishedAt, {
    message: "Published news needs a publish date.",
    path: ["publishedAt"],
  });
export type PublicSiteNewsPostInput = z.infer<typeof publicSiteNewsPostSchema>;

export const publicSiteIdSchema = z.object({
  id: z.string().cuid("Invalid public-site record id."),
});

export const publicSiteListQuerySchema = z.object({
  includeDrafts: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});
export type PublicSiteListQuery = z.infer<typeof publicSiteListQuerySchema>;

export function safePublicSiteSlug(value: string): string {
  return newsSlugSchema.parse(value);
}
