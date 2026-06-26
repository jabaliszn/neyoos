import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";

/** Calm "no access" screen (A.3.7). Never a raw 403. */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-100 px-4 dark:bg-navy-950">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-100 text-navy-500 dark:bg-navy-800 dark:text-navy-300">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-navy-900 dark:text-navy-50">
          You don&apos;t have access to this
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          This page is limited to certain roles at your school. If you think you
          should have access, ask your administrator.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-green-500 px-6 text-sm font-medium text-white shadow-card transition-all duration-200 ease-apple hover:bg-green-600"
          >
            Back to dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
