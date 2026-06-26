import Link from "next/link";
import { LinkIcon, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Magic-link error landing. The callback redirects here with ?error=CODE
 * when a link is invalid/expired/unregistered. Calm, single recovery action.
 */
const MESSAGES: Record<string, { title: string; body: string }> = {
  CODE_EXPIRED: {
    title: "This link has expired",
    body: "Sign-in links last 15 minutes. Request a fresh one to continue.",
  },
  INVALID_CODE: {
    title: "This link can't be used",
    body: "It may have already been used or is incomplete. Request a new link.",
  },
  USER_INACTIVE: {
    title: "Email not registered",
    body: "Ask your school administrator to add your email, then try again.",
  },
};

export default function MagicLinkError({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const info =
    MESSAGES[searchParams.error ?? ""] ?? MESSAGES.INVALID_CODE;

  return (
    <div className="w-full max-w-sm animate-fade-in">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <LinkIcon className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          {info.title}
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          {info.body}
        </p>
      </div>
      <Card>
        <CardContent className="p-6">
          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-green-500 text-sm font-medium text-white shadow-card transition-all duration-200 ease-apple hover:bg-green-600"
          >
            Back to sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
