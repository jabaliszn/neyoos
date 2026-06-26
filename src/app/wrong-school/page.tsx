import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

/**
 * Shown when a signed-in user opens a tenant subdomain that isn't theirs (A.2.3).
 * Calm, single recovery action: sign out / go to their own school.
 */
export default function WrongSchoolPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-100 px-4 dark:bg-navy-950">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <Building2 className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-navy-900 dark:text-navy-50">
          This isn&apos;t your school
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Your account belongs to a different school on NEYO. Sign out and use
          your own school&apos;s address to continue.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-green-500 px-6 text-sm font-medium text-white shadow-card transition-all duration-200 ease-apple hover:bg-green-600"
          >
            Back to sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
