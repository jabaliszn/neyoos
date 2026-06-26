import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  Facebook,
  GraduationCap,
  HeartHandshake,
  Instagram,
  Leaf,
  Mail,
  MapPin,
  Music,
  Palette,
  Phone,
  ShieldCheck,
  Trophy,
  Twitter,
  Users,
  Youtube,
} from "lucide-react";
import { currentTenantSlug } from "@/lib/core/current-tenant";
import { publicSiteBySlug } from "@/lib/services/public-site.service";
import { db } from "@/lib/db";
import { NeyoLandingClient } from "@/components/public-site/neyo-landing-client";
import { getLandingContent } from "@/lib/services/landing-content.service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const slug = currentTenantSlug();
  if (!slug) {
    const landing = await getLandingContent();
    return {
      title: landing.seoTitle,
      description: landing.seoDescription,
      openGraph: {
        title: landing.seoTitle,
        description: landing.seoDescription,
        images: landing.ogImageUrl ? [landing.ogImageUrl] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: landing.seoTitle,
        description: landing.seoDescription,
        images: landing.ogImageUrl ? [landing.ogImageUrl] : undefined,
      },
    };
  }
  const site = await publicSiteBySlug(slug).catch(() => null);
  if (!site) return { title: "NEYO" };
  return {
    title: `${site.school.name} — powered by NEYO`,
    description: site.school.about || `${site.school.name} public school page on NEYO.`,
    openGraph: {
      title: `${site.school.name} — powered by NEYO`,
      description: site.school.about || `${site.school.name} public school page on NEYO.`,
      images: site.settings.ogImageUrl ? [site.settings.ogImageUrl] : undefined,
    },
  };
}


type PublicSite = Awaited<ReturnType<typeof publicSiteBySlug>>;

type PublicRow = {
  id: string;
  title?: string;
  name?: string;
  guardianName?: string;
  quote?: string;
  description?: string;
  caption?: string | null;
  imageUrl?: string;
  imageFileUrl?: string | null;
  photoUrl?: string | null;
  publishedAt?: Date | string | null;
  slug?: string;
  iconName?: string | null;
  relationship?: string | null;
  studentName?: string | null;
};

const iconMap = {
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  trophy: Trophy,
  music: Music,
  palette: Palette,
  users: Users,
  "heart-handshake": HeartHandshake,
  leaf: Leaf,
  "shield-check": ShieldCheck,
} as const;

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "School update";
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function socialIcon(key: string) {
  if (key === "facebook") return Facebook;
  if (key === "instagram") return Instagram;
  if (key === "twitter" || key === "x") return Twitter;
  if (key === "youtube") return Youtube;
  return null;
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700 dark:text-green-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-navy-950 dark:text-white sm:text-4xl">
        {title}
      </h2>
      {text ? <p className="mt-3 text-sm leading-6 text-navy-500 dark:text-navy-300">{text}</p> : null}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/70 p-5 text-center shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/55">
      <p className="text-4xl font-black tracking-tight text-navy-950 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-navy-400 dark:text-navy-500">
        {label}
      </p>
    </div>
  );
}

/** G.11 — Public School Landing Site or Corporate Marketing Homepage. */
export default async function Home() {
  const slug = currentTenantSlug();

  // If we are at the main corporate root domain (No Subdomain) — Render Neyo Global Marketing Site!
  if (!slug) {
    // Read custom assets from NEYO Ops platform settings concurrently (Speed optimized!)
    const [customLogo, customPrimary, customAccent, landingContent] = await Promise.all([
      db.platformSetting.findUnique({ where: { key: "neyo_logo_url" } }).catch(() => null),
      db.platformSetting.findUnique({ where: { key: "neyo_brand_primary" } }).catch(() => null),
      db.platformSetting.findUnique({ where: { key: "neyo_brand_accent" } }).catch(() => null),
      getLandingContent(),
    ]);

    return (
      <NeyoLandingClient
        customLogoUrl={customLogo?.value || null}
        brandPrimary={customPrimary?.value || undefined}
        brandAccent={customAccent?.value || undefined}
        landingContent={landingContent}
      />
    );
  }

  // School Subdomain Is Active — Render School-Specific Landing Page
  const site = await publicSiteBySlug(slug);
  const { school, settings, stats } = site;
  const brand = school.brandPrimary || "#1c2740";
  const accent = school.brandAccent || "#1f9d5f";
  const why = settings.whyChooseUs || [];
  const hasShowcaseContent =
    site.activities.length > 0 ||
    site.news.length > 0 ||
    site.gallery.length > 0 ||
    site.leaders.length > 0 ||
    site.testimonials.length > 0 ||
    why.length > 0;

  return (
    <main className="min-h-screen overflow-hidden bg-warm-50 text-navy-900 dark:bg-navy-950 dark:text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_20%_0%,rgba(31,157,95,0.14),transparent),radial-gradient(56rem_40rem_at_85%_5%,rgba(28,39,64,0.10),transparent)]" />

      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white shadow-sm dark:border-white/10 dark:bg-navy-900">
              {school.logoUrl ? (
                <img src={school.logoUrl} alt={`${school.name} logo`} className="h-full w-full object-contain" />
              ) : (
                <span className="text-sm font-black" style={{ color: brand }}>{initials(school.name)}</span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-navy-950 dark:text-white sm:text-base">
                {school.name}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-navy-400">
                {school.county ? `${school.county} County, Kenya` : "Kenya"}
              </p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="rounded-full px-4 py-2 text-xs font-bold text-navy-700 transition hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-white/10">
              Portal Sign In
            </Link>
            <Link href="/apply" className="rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-card transition hover:-translate-y-0.5" style={{ backgroundColor: brand }}>
              Enroll Now
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative border-b border-white/70 px-4 py-16 dark:border-white/10 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl">
            {school.motto ? (
              <span className="inline-flex rounded-full border border-green-200 bg-green-50/90 px-3 py-1 text-xs font-bold text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
                {school.motto}
              </span>
            ) : null}
            <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-tight text-navy-950 dark:text-white sm:text-7xl" style={{ color: brand }}>
              {settings.heroHeadline}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-navy-600 dark:text-navy-300 sm:text-lg">
              {settings.heroSubheading}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/apply" className="inline-flex items-center rounded-full px-6 py-3 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5" style={{ backgroundColor: accent }}>
                {settings.primaryCtaLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center rounded-full border border-white/70 bg-white/70 px-6 py-3 text-sm font-bold text-navy-800 shadow-sm backdrop-blur-xl transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
                {settings.secondaryCtaLabel}
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 p-3 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
              {settings.heroImageUrl ? (
                <img src={settings.heroImageUrl} alt={`${school.name} learners`} className="aspect-[4/3] w-full rounded-[1.35rem] object-cover" />
              ) : (
                <div className="flex aspect-[4/3] flex-col justify-between rounded-[1.35rem] bg-[linear-gradient(135deg,rgba(31,157,95,0.18),rgba(28,39,64,0.08))] p-8">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-green-800">Official school website</p>
                    <h3 className="mt-3 text-3xl font-black text-navy-950">{school.name}</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 p-4 shadow-card backdrop-blur-xl">
                      <GraduationCap className="h-6 w-6 text-green-600" />
                      <p className="mt-3 text-sm font-bold">Admissions open</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 shadow-card backdrop-blur-xl">
                      <ShieldCheck className="h-6 w-6 text-blue-600" />
                      <p className="mt-3 text-sm font-bold">Parent portal ready</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-3">
          <Stat value={stats.studentCount} label="Enrolled learners" />
          <Stat value={stats.classCount} label="Active classes" />
          <Stat value={stats.staffCount} label="Staff serving families" />
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow="About the school" title="Our foundations" text="The school story, mission and values parents can trust." />
          <div className="grid gap-5 lg:grid-cols-3">
            <article className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">Vision</p>
              <p className="mt-4 text-sm leading-7 text-navy-600 dark:text-navy-300">{school.vision || "A school where every learner grows with confidence, skill and character."}</p>
            </article>
            <article className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Mission</p>
              <p className="mt-4 text-sm leading-7 text-navy-600 dark:text-navy-300">{school.mission || "To provide structured learning, care and clear communication for every family."}</p>
            </article>
            <article className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-navy-600 dark:text-navy-300">Story</p>
              <p className="mt-4 text-sm leading-7 text-navy-600 dark:text-navy-300">{settings.history || school.about}</p>
            </article>
          </div>
        </div>
      </section>

      {why.length > 0 ? (
        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <SectionTitle eyebrow="Why families choose us" title="Specific reasons parents can see" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {why.map((item, index) => (
                <article key={`${item.title}-${index}`} className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
                  <Award className="h-6 w-6 text-green-600" />
                  <h3 className="mt-4 text-base font-bold text-navy-950 dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-navy-500 dark:text-navy-300">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow="Academics" title="CBC and 8-4-4 pathways" text="Clear learning structures for Kenyan families." />
          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-3xl border border-white/70 bg-white/75 p-7 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
              <GraduationCap className="h-8 w-8 text-green-600" />
              <h3 className="mt-5 text-xl font-black text-navy-950 dark:text-white">Competency Based Curriculum</h3>
              <p className="mt-3 text-sm leading-7 text-navy-500 dark:text-navy-300">CBC support for Grade 1–9, including learning outcomes, formative observations and parent-friendly reports.</p>
            </article>
            <article className="rounded-3xl border border-white/70 bg-white/75 p-7 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
              <Building2 className="h-8 w-8 text-blue-600" />
              <h3 className="mt-5 text-xl font-black text-navy-950 dark:text-white">8-4-4 Secondary</h3>
              <p className="mt-3 text-sm leading-7 text-navy-500 dark:text-navy-300">Structured Form 1–4 academics with exams, report cards, attendance follow-up and fee communication.</p>
            </article>
          </div>
        </div>
      </section>

      {!hasShowcaseContent ? <PublicSiteEmpty schoolName={school.name} /> : null}
      {site.activities.length > 0 ? <Activities rows={site.activities as PublicRow[]} /> : null}
      {site.news.length > 0 ? <News rows={site.news as PublicRow[]} /> : null}
      {site.gallery.length > 0 ? <Gallery rows={site.gallery as PublicRow[]} /> : null}
      {site.leaders.length > 0 ? <Leaders rows={site.leaders as PublicRow[]} /> : null}
      {site.testimonials.length > 0 ? <Testimonials rows={site.testimonials as PublicRow[]} /> : null}

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/70 bg-white/75 p-7 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">Contact</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-navy-950 dark:text-white">Visit or call the school</h2>
            <div className="mt-6 space-y-4 text-sm text-navy-600 dark:text-navy-300">
              {school.addressLine ? <p className="flex gap-3"><MapPin className="h-5 w-5 text-navy-400" />{school.addressLine}</p> : null}
              {school.phone ? <p className="flex gap-3"><Phone className="h-5 w-5 text-navy-400" />{school.phone}</p> : null}
              {school.email ? <p className="flex gap-3"><Mail className="h-5 w-5 text-navy-400" />{school.email}</p> : null}
            </div>
            {Object.keys(school.socialLinks).length > 0 ? (
              <div className="mt-7 flex gap-2 border-t border-navy-100 pt-5 dark:border-white/10">
                {Object.entries(school.socialLinks).map(([key, url]) => {
                  if (!url) return null;
                  const Icon = socialIcon(key);
                  return Icon ? (
                    <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-50 text-navy-500 transition hover:bg-green-50 hover:text-green-700 dark:bg-white/10 dark:text-navy-200">
                      <Icon className="h-5 w-5" />
                    </a>
                  ) : null;
                })}
              </div>
            ) : null}
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
            {settings.mapEmbedUrl ? (
              <iframe title={`${school.name} map`} src={settings.mapEmbedUrl} className="h-full min-h-[320px] w-full rounded-2xl border-0" loading="lazy" />
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl bg-navy-50 text-center dark:bg-navy-950/50">
                <MapPin className="h-10 w-10 text-green-600" />
                <p className="mt-4 text-sm font-bold text-navy-900 dark:text-white">{school.name}</p>
                <p className="mt-1 text-sm text-navy-500 dark:text-navy-300">{school.addressLine || school.county || "Kenya"}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/70 px-4 py-10 text-center text-xs text-navy-400 dark:border-white/10 sm:px-6">
        <p>© {new Date().getFullYear()} {school.name}. All rights reserved.</p>
        <p className="mt-1">Powered by NEYO · neyo.co.ke</p>
      </footer>
    </main>
  );
}

function PublicSiteEmpty({ schoolName }: { schoolName: string }) {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-dashed border-green-200 bg-white/70 p-8 text-center shadow-card backdrop-blur-xl dark:border-green-900/70 dark:bg-navy-900/50">
        <Leaf className="mx-auto h-9 w-9 text-green-600" />
        <h2 className="mt-4 text-2xl font-black tracking-tight text-navy-950 dark:text-white">
          {schoolName} is preparing more public updates
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-navy-500 dark:text-navy-300">
          Admissions and parent portal access are already available. News, gallery photos, leadership notes and activities will appear here as soon as the school publishes them.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/apply" className="rounded-full bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-card">Apply for admission</Link>
          <Link href="/login" className="rounded-full border border-navy-200 bg-white px-5 py-2.5 text-sm font-bold text-navy-700 dark:border-white/10 dark:bg-white/10 dark:text-white">Parent portal</Link>
        </div>
      </div>
    </section>
  );
}

function Activities({ rows }: { rows: PublicRow[] }) {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Activities" title="Beyond the classroom" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => {
            const Icon = iconMap[(row.iconName || "graduation-cap") as keyof typeof iconMap] || GraduationCap;
            return (
              <article key={row.id} className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
                <Icon className="h-7 w-7 text-green-600" />
                <h3 className="mt-4 text-base font-bold text-navy-950 dark:text-white">{row.title}</h3>
                <p className="mt-2 text-sm leading-6 text-navy-500 dark:text-navy-300">{row.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function News({ rows }: { rows: PublicRow[] }) {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="School updates" title="Latest news" />
        <div className="grid gap-5 md:grid-cols-3">
          {rows.map((row) => (
            <Link key={row.id} href={`/news/${row.slug}`} className="group overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-card backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-card-hover dark:border-white/10 dark:bg-navy-900/50">
              {row.imageFileUrl ? <img src={row.imageFileUrl} alt="" className="h-44 w-full object-cover" /> : <div className="flex h-44 items-center justify-center bg-green-50 text-green-700 dark:bg-green-950/40"><CalendarDays className="h-8 w-8" /></div>}
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-green-700">{fmtDate(row.publishedAt)}</p>
                <h3 className="mt-2 line-clamp-2 text-lg font-black text-navy-950 group-hover:text-green-700 dark:text-white">{row.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-navy-500 dark:text-navy-300">{row.description || row.caption || (row as any).excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery({ rows }: { rows: PublicRow[] }) {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Gallery" title="A glimpse of school life" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <figure key={row.id} className="overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
              <img src={row.imageUrl} alt={row.title || "School gallery"} className="h-52 w-full object-cover" />
              <figcaption className="p-4">
                <p className="text-sm font-bold text-navy-950 dark:text-white">{row.title}</p>
                {row.caption ? <p className="mt-1 text-xs leading-5 text-navy-500 dark:text-navy-300">{row.caption}</p> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Leaders({ rows }: { rows: PublicRow[] }) {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Leadership" title="Meet the people guiding the school" />
        <div className="grid gap-5 md:grid-cols-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-green-50 text-sm font-black text-green-700">
                  {row.photoUrl ? <img src={row.photoUrl} alt={row.name || "Leader"} className="h-full w-full object-cover" /> : initials(row.name || "Leader")}
                </div>
                <div>
                  <h3 className="font-black text-navy-950 dark:text-white">{row.name}</h3>
                  <p className="text-sm font-semibold text-green-700">{row.title}</p>
                </div>
              </div>
              {row.description || (row as any).bio ? <p className="mt-4 text-sm leading-6 text-navy-500 dark:text-navy-300">{(row as any).bio || row.description}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials({ rows }: { rows: PublicRow[] }) {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Parents" title="What families say" />
        <div className="grid gap-5 md:grid-cols-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/50">
              <p className="text-4xl leading-none text-green-600">“</p>
              <p className="mt-2 text-sm leading-7 text-navy-600 dark:text-navy-300">{row.quote}</p>
              <div className="mt-5 border-t border-navy-100 pt-4 dark:border-white/10">
                <p className="text-sm font-black text-navy-950 dark:text-white">{row.guardianName}</p>
                {row.relationship ? <p className="text-xs text-navy-400">{row.relationship}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
