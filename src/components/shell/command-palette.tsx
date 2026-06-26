"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  User,
  GraduationCap,
  Wallet,
  MessageSquare,
  CornerDownLeft,
  Loader2,
  Command,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_COMMANDS } from "@/lib/core/commands";
import { usePermissions } from "@/components/auth/permissions-provider";

interface Hit {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_ICON: Record<string, typeof User> = {
  person: User,
  student: GraduationCap,
  payment: Wallet,
  conversation: MessageSquare,
  command: Command,
  module: LayoutGrid,
};

/**
 * Global ⌘K command palette (A.11). Opened by Cmd/Ctrl+K or the topbar search.
 * Debounced type-ahead against /api/search, full keyboard navigation.
 */
export function CommandPalette() {
  const router = useRouter();
  const { has } = usePermissions();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Permission-filtered command actions (G.7).
  const commandHits: Hit[] = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    return APP_COMMANDS.filter((c) => !c.permission || has(c.permission))
      .filter(
        (c) =>
          ql.length < 2 ||
          c.label.toLowerCase().includes(ql) ||
          (c.keywords ?? []).some((k) => k.includes(ql))
      )
      .map((c) => ({
        type: "command",
        id: c.id,
        title: c.label,
        subtitle: "Action",
        href: c.href,
      }));
  }, [q, has]);

  // Combined list: commands first, then search results.
  const allHits = React.useMemo(() => [...commandHits, ...hits], [commandHits, hits]);

  // Open with Cmd/Ctrl+K; also via a custom event the topbar dispatches.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("neyo:open-search", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("neyo:open-search", onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQ("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  // Debounced search.
  React.useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (json.ok) {
          setHits(json.data.hits);
          setActive(0);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  function go(hit: Hit) {
    setOpen(false);
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, allHits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && allHits[active]) {
      e.preventDefault();
      go(allHits[active]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24">
      <div
        className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-xl animate-fade-in overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-pop dark:border-navy-700 dark:bg-navy-900">
        <div className="flex items-center gap-3 border-b border-navy-100 px-4 dark:border-navy-800">
          <Search className="h-4.5 w-4.5 text-navy-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search modules, students, staff, payments…"
            className="h-14 flex-1 bg-transparent text-[15px] text-navy-900 outline-none placeholder:text-navy-400 dark:text-navy-50"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-navy-400" />}
          <kbd className="rounded border border-navy-200 bg-navy-50 px-1.5 py-0.5 text-[10px] text-navy-500 dark:border-navy-700 dark:bg-navy-800">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {allHits.length === 0 && !loading ? (
            <p className="px-3 py-6 text-center text-sm text-navy-400">
              {q.trim().length < 2
                ? "Type to search modules, people, payments, messages…"
                : `No results for “${q}”.`}
            </p>
          ) : (
            <ul>
              {allHits.map((h, i) => {
                const Icon = TYPE_ICON[h.type] ?? Search;
                return (
                  <li key={`${h.type}-${h.id}`}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(h)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                        i === active
                          ? "bg-navy-100 dark:bg-navy-800"
                          : "hover:bg-navy-50 dark:hover:bg-navy-800/50"
                      )}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-100 text-navy-500 dark:bg-navy-700 dark:text-navy-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">
                          {h.title}
                        </p>
                        <p className="truncate text-xs text-navy-400 dark:text-navy-500">
                          {h.subtitle}
                        </p>
                      </div>
                      {i === active && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-navy-300" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
