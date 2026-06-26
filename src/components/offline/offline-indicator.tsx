"use client";

import * as React from "react";
import { WifiOff, CloudUpload } from "lucide-react";
import { useOnline } from "@/lib/offline/use-online";
import { queueCount, syncQueue } from "@/lib/offline/queue";

/**
 * Top-bar indicator (Feature G.2): shows "Offline" when disconnected, or a
 * "N queued" pill with pending offline actions. Hidden when online & empty.
 */
export function OfflineIndicator() {
  const online = useOnline();
  const [count, setCount] = React.useState(0);

  const refresh = React.useCallback(() => {
    queueCount().then(setCount).catch(() => setCount(0));
  }, []);

  React.useEffect(() => {
    refresh();
    window.addEventListener("neyo:queue-changed", refresh);
    return () => window.removeEventListener("neyo:queue-changed", refresh);
  }, [refresh]);

  if (online && count === 0) return null;

  if (!online) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 sm:flex">
        <WifiOff className="h-3.5 w-3.5" />
        Offline{count > 0 ? ` · ${count} queued` : ""}
      </span>
    );
  }

  // Online but with pending items -> offer a manual sync.
  return (
    <button
      onClick={() => syncQueue().then(refresh)}
      className="hidden items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 sm:flex"
    >
      <CloudUpload className="h-3.5 w-3.5" />
      Sync {count}
    </button>
  );
}
