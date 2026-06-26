import * as React from "react";
import { cn } from "@/lib/utils";

/** Accessible form label. Pair via htmlFor + input id. */
export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200",
        className
      )}
      {...props}
    />
  );
}
