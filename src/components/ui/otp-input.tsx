"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * OtpInput — a row of single-digit boxes for entering a code (A.1 login).
 * Features: auto-advance on type, backspace to previous, full-code paste,
 * arrow-key navigation, numeric-only. Reports the combined value via onChange.
 *
 * Controlled: pass `value` (string up to `length`) and `onChange`.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  error,
  autoFocus,
}: {
  length?: number;
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const digits = React.useMemo(() => {
    const arr = value.split("").slice(0, length);
    while (arr.length < length) arr.push("");
    return arr;
  }, [value, length]);

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    const combined = next.join("").slice(0, length);
    onChange(combined);
    if (combined.length === length && !combined.includes("") && onComplete) {
      onComplete(combined);
    }
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1); // keep last typed digit only
    if (!digit) {
      setDigit(index, "");
      return;
    }
    setDigit(index, digit);
    if (index < length - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setDigit(index - 1, "");
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    refs.current[focusIndex]?.focus();
    if (pasted.length === length && onComplete) onComplete(pasted);
  }

  return (
    <div className="flex items-center justify-between gap-2" role="group" aria-label="Verification code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-full min-w-0 rounded-2xl border bg-white text-center text-xl font-semibold text-navy-900 outline-none transition-all duration-200 ease-apple",
            "dark:bg-navy-900 dark:text-navy-50",
            "disabled:opacity-50",
            error
              ? "border-red-400 focus:ring-2 focus:ring-red-400/40"
              : "border-navy-200 focus:border-navy-300 focus:ring-2 focus:ring-green-500/30 dark:border-navy-700",
            digit && !error && "border-green-400"
          )}
        />
      ))}
    </div>
  );
}
