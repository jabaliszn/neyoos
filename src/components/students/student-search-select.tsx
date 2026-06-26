"use client";

import * as React from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StudentSearchOption {
  id: string;
  name: string;
  admissionNo: string;
  className?: string | null;
  gender?: string | null;
}

interface StudentSearchSelectProps {
  students: StudentSearchOption[];
  value: string;
  onChange: (studentId: string) => void;
  label?: string;
  placeholder?: string;
  helper?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function optionLabel(student?: StudentSearchOption) {
  if (!student) return "";
  return `${student.name} — ${student.admissionNo}${student.className ? ` · ${student.className}` : ""}`;
}

/**
 * I.3 required learner/admission-number picker.
 * Searches loaded real learners by name, NEYO/school admission number and class.
 * This replaces long dropdowns on operational screens so staff type and select.
 */
export function StudentSearchSelect({
  students,
  value,
  onChange,
  label = "Learner / admission number",
  placeholder = "Type learner name or admission number…",
  helper = "Required. Type at least part of the name or admission number, then choose the learner.",
  disabled = false,
  required = true,
  className,
}: StudentSearchSelectProps) {
  const selected = React.useMemo(() => students.find((s) => s.id === value) ?? null, [students, value]);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (selected) setQuery(optionLabel(selected));
    else setQuery("");
  }, [selected]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || selected && query === optionLabel(selected)) return students.slice(0, 12);
    return students
      .filter((student) => {
        const haystack = [student.name, student.admissionNo, student.className ?? "", student.gender ?? ""].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 12);
  }, [query, selected, students]);

  function choose(student: StudentSearchOption) {
    onChange(student.id);
    setQuery(optionLabel(student));
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(true);
  }

  return (
    <div className={cn("relative", className)}>
      {label && (
        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-400 dark:text-navy-500">
          {label}{required ? " *" : ""}
        </label>
      )}
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
        <input
          value={query}
          disabled={disabled}
          aria-required={required}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) onChange("");
            setOpen(true);
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-2xl border border-white/55 bg-white/70 py-2.5 pl-10 pr-10 text-sm text-navy-900 shadow-inner outline-none transition duration-200 ease-apple placeholder:text-navy-300 focus:border-green-300 focus:ring-4 focus:ring-green-500/10 dark:border-white/10 dark:bg-navy-900/55 dark:text-navy-50 dark:placeholder:text-navy-500",
            !value && required ? "border-amber-200 focus:border-amber-300 focus:ring-amber-500/10" : "",
          )}
        />
        {query && !disabled && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-navy-400 hover:bg-navy-100 hover:text-navy-700 dark:hover:bg-navy-800 dark:hover:text-navy-100"
            aria-label="Clear learner search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {helper && <p className="mt-1 text-[11px] leading-5 text-navy-400 dark:text-navy-500">{helper}</p>}

      {open && !disabled && (
        <div className="absolute z-[80] mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-white/60 bg-white/95 p-1.5 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/95">
          {results.length === 0 ? (
            <div className="rounded-xl px-3 py-4 text-center text-xs text-navy-400">
              No learner found. Try another name or admission number.
            </div>
          ) : (
            results.map((student) => (
              <button
                type="button"
                key={student.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(student)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-navy-900 dark:text-navy-50">{student.name}</span>
                  <span className="block truncate text-xs text-navy-400">
                    {student.admissionNo}{student.className ? ` · ${student.className}` : ""}
                  </span>
                </span>
                {value === student.id && <Check className="h-4 w-4 shrink-0 text-green-600" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
