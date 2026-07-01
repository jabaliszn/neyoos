"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * NEYO Dialog — a lightweight, dependency-free modal primitive.
 *
 * Liquid Glass styling (Odoo structure + Apple craft + Linear speed):
 *  - frosted backdrop, rounded glass panel, calm 200ms apple easing
 *  - controlled via `open` + `onOpenChange` (Radix-compatible API surface)
 *  - closes on Escape and backdrop click; locks body scroll while open
 *
 * Exposes: Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter.
 */

type DialogContextValue = { open: boolean; onOpenChange?: (open: boolean) => void };
const DialogContext = React.createContext<DialogContextValue>({ open: false });

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange?.(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  return <DialogContext.Provider value={{ open, onOpenChange }}>{open ? children : null}</DialogContext.Provider>;
}

export function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { onOpenChange } = React.useContext(DialogContext);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Frosted backdrop */}
      <div
        className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => onOpenChange?.(false)}
        aria-hidden="true"
      />
      {/* Glass panel */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-2xl border border-white/40 bg-white/95 p-6 shadow-card-hover backdrop-blur-xl",
          "transition-all duration-200 ease-apple",
          "dark:border-navy-700/60 dark:bg-navy-900/95",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-2 flex flex-col gap-1.5", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-black text-navy-950 dark:text-white", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 flex items-center justify-end gap-2", className)} {...props} />;
}
