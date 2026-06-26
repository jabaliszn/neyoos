"use client";

import * as React from "react";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * SlugField — a school-address input with live availability checking (A.2.5).
 * Renders the four states: checking, available, taken/invalid, idle.
 * Calls GET /api/tenant/slug-check with debounce.
 */
type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "error"; message: string; suggestion?: string };

export function SlugField({
  value,
  onChange,
  schoolName = "",
  rootDomainLabel = "neyo.co.ke",
  label = "School address",
}: {
  value: string;
  onChange: (v: string) => void;
  schoolName?: string;
  rootDomainLabel?: string;
  label?: string;
}) {
  const [state, setState] = React.useState<State>({ kind: "idle" });

  React.useEffect(() => {
    if (!value) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "checking" });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slug: value });
        if (schoolName) params.set("name", schoolName);
        const res = await fetch(`/api/tenant/slug-check?${params}`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!json.ok) {
          setState({ kind: "error", message: "Could not check this address." });
          return;
        }
        if (json.data.available) {
          setState({ kind: "available" });
        } else {
          setState({
            kind: "error",
            message: json.data.message,
            suggestion: json.data.suggestion,
          });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setState({ kind: "error", message: "Network problem." });
        }
      }
    }, 350);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, schoolName]);

  const isError = state.kind === "error";

  return (
    <div className="w-full">
      <Label htmlFor="slug">{label}</Label>
      <div
        className={cn(
          "flex items-center rounded-2xl border bg-white pr-3 transition-colors duration-200 ease-apple dark:bg-navy-900",
          isError
            ? "border-red-400 focus-within:ring-2 focus-within:ring-red-400/40"
            : state.kind === "available"
              ? "border-green-400 focus-within:ring-2 focus-within:ring-green-500/30"
              : "border-navy-200 focus-within:ring-2 focus-within:ring-green-500/30 dark:border-navy-700"
        )}
      >
        <input
          id="slug"
          value={value}
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="karibu-high"
          onChange={(e) =>
            onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          className="h-12 min-w-0 flex-1 rounded-l-2xl bg-transparent px-3.5 text-[15px] text-navy-900 outline-none placeholder:text-navy-300 dark:text-navy-50"
        />
        <span className="shrink-0 select-none text-sm text-navy-400 dark:text-navy-500">
          .{rootDomainLabel}
        </span>
        <span className="ml-2.5 shrink-0">
          {state.kind === "checking" && (
            <Loader2 className="h-4 w-4 animate-spin text-navy-400" />
          )}
          {state.kind === "available" && (
            <Check className="h-4 w-4 text-green-600" />
          )}
          {isError && <X className="h-4 w-4 text-red-500" />}
        </span>
      </div>

      {/* State messages */}
      {state.kind === "available" && (
        <p className="mt-1.5 text-sm text-green-700 dark:text-green-400">
          {value}.{rootDomainLabel} is available
        </p>
      )}
      {isError && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {state.message}
          {state.suggestion && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => onChange(state.suggestion!)}
                className="font-medium underline underline-offset-2"
              >
                Try {state.suggestion}
              </button>
            </>
          )}
        </p>
      )}
      {state.kind === "idle" && (
        <p className="mt-1.5 text-sm text-navy-400 dark:text-navy-500">
          This becomes your school&apos;s web address.
        </p>
      )}
    </div>
  );
}
