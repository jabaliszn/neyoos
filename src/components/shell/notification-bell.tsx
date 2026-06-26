"use client";

import * as React from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Inbox,
  Wallet,
  CalendarCheck,
  GraduationCap,
  Info,
  MessageSquare,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NeyoLogo } from "@/components/brand/neyo-logo";

interface Item {
  id: string;
  title: string;
  body: string;
  category: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

const CATEGORY_ICON: Record<string, typeof Bell> = {
  fees: Wallet,
  attendance: CalendarCheck,
  exam: GraduationCap,
  message: MessageSquare,
  approval: ShieldAlert,
  emergency: ShieldAlert,
  general: Info,
  system: Info,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function playIslandTone() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    const one = ctx.createOscillator();
    one.type = "sine";
    one.frequency.setValueAtTime(740, now);
    one.frequency.exponentialRampToValueAtTime(980, now + 0.16);
    const two = ctx.createOscillator();
    two.type = "triangle";
    two.frequency.setValueAtTime(1240, now + 0.08);

    one.connect(gain);
    two.connect(gain);
    gain.connect(ctx.destination);
    one.start(now);
    two.start(now + 0.08);
    one.stop(now + 0.34);
    two.stop(now + 0.44);
  } catch {
    // Browsers may block sound until interaction; visual island still works.
  }
}

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [nativeStatus, setNativeStatus] = React.useState<"unsupported" | "default" | "granted" | "denied">("unsupported");
  const [islandQueue, setIslandQueue] = React.useState<Item[]>([]);
  const [activeIsland, setActiveIsland] = React.useState<Item | null>(null);
  const [dismissedIslandIds, setDismissedIslandIds] = React.useState<Set<string>>(new Set());
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNativeStatus(Notification.permission as "default" | "granted" | "denied");
  }, []);

  async function showNativeNotification(item: Item) {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    const payload = { body: item.body, icon: "/icon-192.png", badge: "/icon-192.png", tag: item.id, data: { href: item.href || "/dashboard", id: item.id } };
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg?.showNotification) await reg.showNotification(item.title, payload);
      else new Notification(item.title, payload);
    } catch {
      try { new Notification(item.title, payload); } catch {}
    }
  }

  async function enableNativeNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) { setNativeStatus("unsupported"); return; }
    const permission = await Notification.requestPermission();
    setNativeStatus(permission as "default" | "granted" | "denied");
    if (permission !== "granted") return;
    try {
      const meta = await fetch("/api/notifications/native-subscription").then((r) => r.json()).catch(() => null);
      if (meta?.data?.vapidPublicKey && "PushManager" in window) {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: meta.data.vapidPublicKey });
        await fetch("/api/notifications/native-subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      }
    } catch {
      // Permission is still useful: foreground/background tab notifications use ServiceWorkerRegistration.showNotification.
    }
  }

  async function fetchInbox() {
    const res = await fetch("/api/notifications");
    const json = await res.json();
    if (!json.ok) return null;
    const nextItems = json.data.items as Item[];
    setItems(nextItems);
    setUnread(json.data.unread);
    return nextItems;
  }

  const enqueueFreshUnread = React.useCallback(async () => {
    const nextItems = await fetchInbox();
    if (!nextItems) return;
    const alreadySurfaced = new Set<string>(JSON.parse(localStorage.getItem("neyo_island_notifications") || "[]"));
    const fresh = nextItems
      .filter((item) => !item.read && !alreadySurfaced.has(item.id) && !dismissedIslandIds.has(item.id))
      .reverse();
    if (fresh.length === 0) return;
    for (const item of fresh) {
      alreadySurfaced.add(item.id);
      void showNativeNotification(item);
    }
    localStorage.setItem("neyo_island_notifications", JSON.stringify([...alreadySurfaced].slice(-250)));
    setIslandQueue((q) => [...q, ...fresh]);
  }, [dismissedIslandIds]);

  // Live unread count via SSE (A.7). When it changes, fetch the real targeted
  // notifications for THIS user only and enqueue any new unread items one by one.
  React.useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.addEventListener("unread", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        setUnread(d.unread ?? 0);
        enqueueFreshUnread();
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [enqueueFreshUnread]);

  React.useEffect(() => {
    enqueueFreshUnread();
    const onOnline = () => enqueueFreshUnread();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [enqueueFreshUnread]);

  // I.94 live activities: modules can raise short-lived account activity updates
  // (calls, imports, running jobs) without creating layout shifts.
  React.useEffect(() => {
    function onLiveActivity(e: Event) {
      const detail = (e as CustomEvent<Partial<Item>>).detail;
      if (!detail?.title) return;
      const item: Item = {
        id: detail.id || `live_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        title: detail.title,
        body: detail.body || "Activity running in your account",
        category: detail.category || "system",
        href: detail.href || null,
        read: false,
        createdAt: new Date().toISOString(),
      };
      setIslandQueue((q) => [...q, item]);
    }
    window.addEventListener("neyo:live-activity", onLiveActivity as EventListener);
    return () => window.removeEventListener("neyo:live-activity", onLiveActivity as EventListener);
  }, []);

  // One-message-at-a-time Dynamic Island queue.
  React.useEffect(() => {
    if (activeIsland || islandQueue.length === 0) return;
    const [next, ...rest] = islandQueue;
    setIslandQueue(rest);
    setActiveIsland(next);
    playIslandTone();
    const t = window.setTimeout(() => setActiveIsland(null), 6500);
    return () => window.clearTimeout(t);
  }, [activeIsland, islandQueue]);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function loadInbox() {
    setLoading(true);
    try {
      await fetchInbox();
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) loadInbox();
  }

  async function markAll() {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  async function markOne(id: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  }

  async function openNotification(n: Item) {
    await markOne(n.id);
    setActiveIsland((cur) => (cur?.id === n.id ? null : cur));
    if (n.href) window.location.assign(n.href);
  }

  function dismissIsland(id: string) {
    setDismissedIslandIds((old) => new Set([...old, id]));
    setActiveIsland(null);
  }

  const IslandIcon = activeIsland ? CATEGORY_ICON[activeIsland.category] ?? Sparkles : Sparkles;

  return (
    <div ref={ref} className="relative">
      {activeIsland && (
        <div
          className="fixed left-1/2 z-[60] w-[min(92vw,34rem)] -translate-x-1/2 px-2 sm:w-[30rem]"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.55rem)" }}
        >
          <div
            className="animate-island overflow-hidden rounded-[2rem] border border-navy-200/70 bg-white/95 text-navy-950 shadow-pop backdrop-blur-2xl dark:border-white/10 dark:bg-navy-950/95 dark:text-white"
            role="status"
            aria-live="polite"
          >
            <div className="pointer-events-auto flex min-h-[3.35rem] items-center gap-3 px-3.5 py-2.5 sm:min-h-[3.7rem] sm:px-4">
              <button
                onClick={() => openNotification(activeIsland)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-400/15 text-green-700 ring-1 ring-green-300/35 dark:bg-green-600/15 dark:text-green-300">
                  <IslandIcon className="h-4.5 w-4.5" />
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-navy-950 shadow-sm ring-1 ring-white/70 dark:bg-white dark:ring-navy-800" aria-label="Powered by NEYO">
                    <NeyoLogo variant="mark" className="h-3 w-3 text-white dark:text-navy-950" title="NEYO" />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold leading-tight sm:text-[15px]">
                    {activeIsland.title}
                  </span>
                  <span className="block truncate text-xs text-navy-600 dark:text-white/70">
                    {activeIsland.body}
                  </span>
                </span>
              </button>
              <button
                onClick={() => dismissIsland(activeIsland.id)}
                className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-navy-500 transition hover:bg-navy-950/10 hover:text-navy-950 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-navy-500 hover:bg-navy-100 dark:text-navy-300 dark:hover:bg-navy-800"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-semibold text-white ring-2 ring-warm-50 dark:ring-navy-950">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed left-1/2 z-[59] w-[min(92vw,34rem)] -translate-x-1/2 px-2 sm:w-[30rem]"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.55rem)" }}
        >
          <div className="animate-island overflow-hidden rounded-[2rem] border border-white/35 bg-white/92 text-navy-950 shadow-pop backdrop-blur-2xl dark:border-white/10 dark:bg-navy-950/94 dark:text-white">
            <div className="flex items-center justify-between border-b border-navy-100/70 px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/12 text-green-700 dark:text-green-300">
                  <Bell className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold">Notifications</p>
                  <p className="text-xs text-navy-500 dark:text-white/60">Dynamic Island inbox · {unread} unread</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {unread > 0 && (
                  <button onClick={markAll} className="rounded-full p-1.5 text-navy-400 hover:bg-navy-100 dark:hover:bg-white/10" title="Mark all read">
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-navy-500 hover:bg-navy-100 dark:text-white/55 dark:hover:bg-white/10" title="Close">
                  Hide
                </button>
              </div>
            </div>

            {nativeStatus !== "granted" && nativeStatus !== "unsupported" && (
              <div className="border-b border-navy-100/70 px-4 py-3 dark:border-white/10">
                <button
                  onClick={enableNativeNotifications}
                  className="w-full rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-left text-xs font-semibold text-green-800 hover:bg-green-100 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
                >
                  Turn on phone-style notifications — ring/sound even when you are not inside Messages.
                </button>
              </div>
            )}

            <div className="max-h-[min(62vh,28rem)] overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-width:thin] [scrollbar-color:rgba(31,157,95,.45)_transparent]">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-navy-100/70 dark:bg-white/10" />)}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <Inbox className="h-8 w-8 text-navy-300 dark:text-white/40" />
                  <p className="mt-3 text-sm font-semibold">You're all caught up</p>
                  <p className="mt-0.5 text-xs text-navy-500 dark:text-white/60">New alerts appear in this same Dynamic Island surface.</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((n) => {
                    const Icon = CATEGORY_ICON[n.category] ?? Info;
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => openNotification(n)}
                          className={cn(
                            "flex w-full gap-3 rounded-2xl px-3 py-2.5 text-left transition-all hover:bg-navy-50 dark:hover:bg-white/10",
                            !n.read && "bg-green-50/85 ring-1 ring-green-100 dark:bg-green-950/35 dark:ring-green-900/40"
                          )}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/12 text-green-700 dark:text-green-300">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="line-clamp-1 text-sm font-semibold">{n.title}</span>
                              <span className="shrink-0 text-[10px] text-navy-400 dark:text-white/45">{timeAgo(n.createdAt)}</span>
                            </span>
                            <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-navy-500 dark:text-white/60">{n.body}</span>
                            {n.href && <span className="mt-1 block text-[11px] font-semibold text-green-700 dark:text-green-300">Open linked item →</span>}
                          </span>
                          {!n.read && (
                            <span
                              onClick={(e) => { e.stopPropagation(); markOne(n.id); }}
                              aria-label="Mark read"
                              className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-navy-300 hover:bg-white hover:text-green-600 dark:hover:bg-white/10"
                            >
                              <Check className="h-4 w-4" />
                            </span>
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
      )}
    </div>
  );
}
