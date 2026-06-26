import { WifiOff } from "lucide-react";

/** Offline fallback (Feature G.2). Served by the SW when a page can't load. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-100 px-4 dark:bg-navy-950">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <WifiOff className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-navy-900 dark:text-navy-50">
          You&apos;re offline
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          NEYO needs a connection to load this page. Any actions you took offline
          are saved and will sync automatically when you&apos;re back online.
        </p>
      </div>
    </div>
  );
}
