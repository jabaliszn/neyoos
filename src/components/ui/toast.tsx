"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Info, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dynamic Island Toast System (Siri WWDC-style premium overlay).
 * Centered at the top of the screen, mimicking Apple's Dynamic Island.
 * Features:
 * - One-Message-at-a-time processing (latest notification replaces old cleanly).
 * - Real-time Web Audio API synthesized premium crystal chime sound on arrival.
 * - Siri-style color-shifting border/shadow glow (conic blue-green-magenta pulse).
 * - Deep-link click navigation to the relevant module.
 */
type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
  href?: string; // Optional deep-link destination on click
}
interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
  href?: string;
}

const ToastContext = React.createContext<{
  toast: (t: ToastInput) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

// Pastel, high-contrast colors suited for a premium dark Dynamic Island background
const toneClasses: Record<Tone, string> = {
  success: "text-green-400",
  error: "text-red-400",
  info: "text-blue-400",
};

/**
 * Synthesizes a beautiful, clean, soft Apple-style chime
 * completely client-side using the native browser Web Audio API.
 * Requires 0kb network bandwidth, zero external assets, and zero latency!
 */
function playPremiumChime() {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // First crystal osc
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now); // A5 note
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6 slide
    
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.04); // quick attack
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5); // smooth decay
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.5);
  } catch {
    // browser blocked audio context or unsupported
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    
    // Play the premium physical audio alert chime!
    playPremiumChime();

    // Enforce one notification at a time: clear older queue immediately
    setToasts([{ id, tone: "info", ...t }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__toast = toast;
    }
  }, [toast]);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      
      {/* Centered at the top of the viewport, shifted down to be 100% notch-safe on modern MacBooks (clears the physical notch perfectly) */}
      <div className="pointer-events-none fixed top-[42px] md:top-[48px] left-1/2 -translate-x-1/2 z-50 flex w-full max-w-sm md:max-w-xl flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          
          return (
            <div
              key={t.id}
              onClick={() => {
                if (t.href) {
                  dismiss(t.id);
                  router.push(t.href);
                }
              }}
              className={cn(
                "pointer-events-auto flex animate-island animate-siri items-center gap-3.5 rounded-3xl",
                "bg-white/95 text-navy-950 dark:bg-black/90 dark:text-white px-6 py-4.5 min-h-[62px] md:min-h-[72px]",
                "border border-navy-100 dark:border-white/10 transition-all duration-300 ease-apple max-w-full shadow-pop backdrop-blur-xl",
                t.href ? "cursor-pointer hover:scale-[1.01] active:scale-95" : ""
              )}
            >
              {/* Dynamic Island Status Icon */}
              <Icon className={cn("h-4.5 w-4.5 shrink-0", toneClasses[t.tone])} />
              
              {/* Notification details */}
              <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5">
                <span className="text-xs md:text-sm font-black tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-navy-950 via-green-600 to-navy-950 dark:from-white dark:via-green-400 dark:to-white animate-pulse">
                  {t.title}
                </span>
                {t.description && (
                  <span className="text-[10px] md:text-xs text-navy-600 dark:text-navy-300 border-l border-navy-200 dark:border-white/20 pl-2 truncate max-w-[140px] md:max-w-[300px]">
                    {t.description}
                  </span>
                )}
              </div>
              
              {/* Deep-link action indicator */}
              {t.href && (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-bold flex items-center gap-0.5 shrink-0 bg-green-500/10 rounded-full px-2 py-0.5 border border-green-500/20">
                  View <ArrowRight className="h-3 w-3" />
                </span>
              )}
              
              {/* Smooth close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent navigation click
                  dismiss(t.id);
                }}
                aria-label="Dismiss"
                className="text-navy-400 hover:text-navy-800 dark:text-white/40 dark:hover:text-white rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
