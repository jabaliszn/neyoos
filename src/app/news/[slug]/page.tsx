import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { currentTenantSlug } from "@/lib/core/current-tenant";
import { publicNewsPostBySlug } from "@/lib/services/public-site.service";

export const dynamic = "force-dynamic";

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "School update";
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

async function loadPost(slug: string) {
  const tenantSlug = currentTenantSlug();
  if (!tenantSlug) redirect("/login");
  try {
    return await publicNewsPostBySlug(tenantSlug, slug);
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await loadPost(params.slug);
  return {
    title: `${data.post.title} — ${data.tenant.name}`,
    description: data.post.excerpt || data.post.content.slice(0, 160),
    openGraph: {
      title: data.post.title,
      description: data.post.excerpt || data.post.content.slice(0, 160),
      images: data.post.imageFileUrl ? [{ url: data.post.imageFileUrl }] : undefined,
    },
  };
}

/** G.11 — public news detail page. Drafts never render here. */
export default async function PublicNewsPage({ params }: { params: { slug: string } }) {
  const { tenant, post } = await loadPost(params.slug);
  const brand = tenant.brandPrimary || "#1c2740";

  return (
    <main className="min-h-screen bg-warm-50 text-navy-900 dark:bg-navy-950 dark:text-white">
      <header className="border-b border-white/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/70">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex items-center text-sm font-bold text-navy-600 hover:text-green-700 dark:text-navy-300">
            <ArrowLeft className="mr-2 h-4 w-4" /> {tenant.name}
          </Link>
          <Link href="/apply" className="rounded-full px-4 py-2 text-xs font-bold text-white" style={{ backgroundColor: brand }}>
            Apply
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/55 sm:p-8">
          <p className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300">
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> {fmtDate(post.publishedAt)}
          </p>
          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-navy-950 dark:text-white sm:text-5xl" style={{ color: brand }}>
            {post.title}
          </h1>
          {post.excerpt ? <p className="mt-4 text-lg leading-8 text-navy-500 dark:text-navy-300">{post.excerpt}</p> : null}
          {post.imageFileUrl ? <img src={post.imageFileUrl} alt="" className="mt-8 max-h-[460px] w-full rounded-3xl object-cover" /> : null}
          <div className="prose prose-navy mt-8 max-w-none whitespace-pre-line text-base leading-8 text-navy-700 dark:text-navy-200">
            {post.content}
          </div>
        </div>
      </article>
    </main>
  );
}
