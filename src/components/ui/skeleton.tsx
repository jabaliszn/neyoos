import * as React from "react";
import { cn } from "@/lib/utils";

/** Skeleton loader (Principle 3 — Loading state). Never an infinite spinner. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton h-4 w-full", className)} {...props} />;
}
