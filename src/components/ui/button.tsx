import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * NEYO Button — rounded-full, calm 200ms apple easing.
 * Variants: primary (the ONE green CTA), secondary, ghost, danger.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-all duration-200 ease-apple select-none whitespace-nowrap " +
  "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary:
    "bg-green-500/80 hover:bg-green-600/95 text-white border border-green-400/30 shadow-card backdrop-blur-md hover:shadow-card-hover relative overflow-hidden " +
    "before:content-[''] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_3s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
  secondary:
    "bg-white text-navy-800 border border-navy-200 hover:bg-navy-50 " +
    "dark:bg-navy-800 dark:text-navy-100 dark:border-navy-700 dark:hover:bg-navy-700",
  ghost:
    "bg-transparent text-navy-600 hover:bg-navy-100 dark:text-navy-300 dark:hover:bg-navy-800",
  danger: "bg-red-600 text-white shadow-card hover:bg-red-700",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
