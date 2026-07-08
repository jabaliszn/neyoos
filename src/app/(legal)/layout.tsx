import Link from "next/link";

/** Calm, readable layout for public legal pages (A.14). */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-warm-100 dark:bg-navy-950">
      <header className="border-b border-navy-100 bg-warm-50/80 backdrop-blur dark:border-navy-800 dark:bg-navy-950/80">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-900 text-xs font-bold text-white dark:bg-green-500">
              N
            </span>
            <span className="text-sm font-semibold text-navy-800 dark:text-navy-100">
              NEYO
            </span>
          </Link>
          <nav className="ml-auto flex gap-4 text-sm text-navy-500 dark:text-navy-400">
            <Link href="/privacy" className="hover:text-navy-800 dark:hover:text-navy-100">Privacy</Link>
            <Link href="/terms" className="hover:text-navy-800 dark:hover:text-navy-100">Terms</Link>
            <Link href="/developers" className="hover:text-navy-800 dark:hover:text-navy-100">Developers</Link>
            <Link href="/status" className="hover:text-navy-800 dark:hover:text-navy-100">Status</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <article className="prose-neyo space-y-4 text-sm leading-relaxed text-navy-700 dark:text-navy-200">
          {children}
        </article>
      </main>
    </div>
  );
}
