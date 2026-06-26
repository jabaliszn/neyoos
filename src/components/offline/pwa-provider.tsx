"use client";

import * as React from "react";
import { syncQueue } from "@/lib/offline/queue";
import { useToast } from "@/components/ui/toast";
import { Download, Monitor, Smartphone, X, Share, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PwaProvider (G.2 + I.33).
 * - Registers the service worker.
 * - Syncs offline queued actions when connection returns.
 * - Shows a persistent bottom-right "Install NEYO" affordance when the app is
 *   not already installed. Chrome/Edge/Android use beforeinstallprompt; iPhone
 *   and unsupported browsers get clear manual Add-to-Home-Screen instructions.
 */
export function PwaProvider() {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(true);
  const [dismissed, setDismissed] = React.useState(true);
  const [instructionsOpen, setInstructionsOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent;
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(ua));
      setIsIos(/iPhone|iPad|iPod/i.test(ua));
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      setIsStandalone(standalone);
      setDismissed(localStorage.getItem("neyo-pwa-install-dismissed") === "true");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    function onBeforeInstallPrompt(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsStandalone(false);
      setDismissed(false);
    }

    function onInstalled() {
      setIsStandalone(true);
      setDeferredPrompt(null);
      toast({ title: "NEYO installed", description: "You can now open NEYO from your Home Screen.", tone: "success" });
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    async function onOnline() {
      const { sent } = await syncQueue();
      if (sent > 0) {
        toast({ title: `${sent} saved action${sent === 1 ? "" : "s"} synced`, tone: "success" });
      }
    }

    window.addEventListener("online", onOnline);
    if (navigator.onLine) void syncQueue();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
    };
  }, [toast]);

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast({ title: "Welcome to NEYO", description: "Installed successfully.", tone: "success" });
        setIsStandalone(true);
      } else {
        setInstructionsOpen(true);
      }
      setDeferredPrompt(null);
      return;
    }
    setInstructionsOpen(true);
  }

  function dismiss() {
    try { localStorage.setItem("neyo-pwa-install-dismissed", "true"); } catch {}
    setDismissed(true);
  }

  if (isStandalone || dismissed) return null;

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 flex items-center gap-2 pointer-events-none sm:bottom-4">
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-2.5 rounded-full",
            "bg-navy-950/95 dark:bg-white/95 text-white dark:text-navy-950 pl-4 pr-2 py-2",
            "shadow-[0_8px_30px_rgba(0,0,0,0.35)] border border-white/10 dark:border-navy-200 animate-fade-in group",
            "hover:scale-[1.02] transition-all duration-300 ease-apple cursor-pointer"
          )}
          onClick={handleInstall}
        >
          {isMobile ? (
            <Smartphone className="h-4 w-4 text-green-400 shrink-0 group-hover:scale-110 transition-transform" />
          ) : (
            <Monitor className="h-4 w-4 text-green-400 shrink-0 group-hover:scale-110 transition-transform" />
          )}
          <span className="text-xs font-semibold tracking-wide whitespace-nowrap">
            Install NEYO
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            className="rounded-full p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white dark:text-navy-500 dark:hover:bg-navy-950/10 dark:hover:text-navy-950"
            aria-label="Dismiss install trigger"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {instructionsOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-950/45 p-4 backdrop-blur-md sm:items-center" onClick={() => setInstructionsOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-white/30 bg-white p-5 shadow-pop dark:border-white/10 dark:bg-navy-950" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-600">Install NEYO</p>
                <h3 className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">Add NEYO to your Home Screen</h3>
              </div>
              <button onClick={() => setInstructionsOpen(false)} className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold dark:border-navy-700">Close</button>
            </div>

            {isIos ? (
              <ol className="space-y-3 text-sm text-navy-600 dark:text-navy-300">
                <li className="flex gap-2"><Share className="mt-0.5 h-4 w-4 text-green-600" /> Tap the Safari Share button.</li>
                <li className="flex gap-2"><PlusCircle className="mt-0.5 h-4 w-4 text-green-600" /> Choose <strong>Add to Home Screen</strong>.</li>
                <li className="flex gap-2"><Download className="mt-0.5 h-4 w-4 text-green-600" /> Tap <strong>Add</strong>. NEYO will open like an app.</li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-navy-600 dark:text-navy-300">
                <li className="flex gap-2"><Download className="mt-0.5 h-4 w-4 text-green-600" /> If your browser shows an install prompt, accept it.</li>
                <li className="flex gap-2"><PlusCircle className="mt-0.5 h-4 w-4 text-green-600" /> Otherwise open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li>
                <li className="flex gap-2"><Smartphone className="mt-0.5 h-4 w-4 text-green-600" /> NEYO will then appear on your phone or laptop like a normal app.</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
