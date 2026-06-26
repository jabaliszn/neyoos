"use client";

import * as React from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

/**
 * Cookie consent banner (A.14). NEYO uses only essential cookies (the login
 * session), so this is a clear notice with an acknowledge action. Choice is
 * stored locally so it doesn't reappear.
 */
export function CookieConsent() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem("neyo-cookie-ack")) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem("neyo-cookie-ack", new Date().toISOString());
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-navy-100 bg-white p-4 shadow-pop dark:border-navy-700 dark:bg-navy-900 sm:flex-row sm:items-center">
        <Cookie className="hidden h-5 w-5 shrink-0 text-navy-400 sm:block" />
        <p className="flex-1 text-sm text-navy-600 dark:text-navy-300">
          NEYO uses only essential cookies to keep you signed in securely. See our{" "}
          <Link href="/privacy" className="font-medium text-green-700 underline underline-offset-2 dark:text-green-400">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-full bg-green-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
