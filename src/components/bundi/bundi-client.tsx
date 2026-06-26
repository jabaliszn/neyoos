"use client";

import * as React from "react";
import Image from "next/image";
import {
  Feather,
  MessageCircle,
  FileText,
  TrendingUp,
  Sparkles,
  Lock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * B.23 — Bundi Layer client (DESIGN-ONLY, founder 2026-06-13).
 * WWDC-style hero: the mascot floats on liquid glass, capabilities are shown
 * as calm preview cards. EVERYTHING is disabled while the platform flag is
 * paused — there is no working engine behind this screen yet, and NOTHING
 * else in NEYO depends on it (founder rule: no feature depends on this layer).
 * Copy rule: it is always "Bundi", never "AI".
 */

const PREVIEWS = [
  {
    icon: MessageCircle,
    title: "Ask Bundi",
    body: "“How many learners were absent in Form 2 East this week?” — Bundi answers from your school's own records.",
  },
  {
    icon: FileText,
    title: "Report card remarks",
    body: "Bundi drafts a personal remark for each learner from their marks — the class teacher reviews and approves every word.",
  },
  {
    icon: TrendingUp,
    title: "Early flags",
    body: "Bundi quietly watches attendance and fees, and taps your shoulder when a learner needs a follow-up call.",
  },
  {
    icon: Sparkles,
    title: "Lesson plan starters",
    body: "A KICD-aligned starting draft for tomorrow's lesson — the teacher always shapes the final plan.",
  },
];

export function BundiClient({ paused, note }: { paused: boolean; note: string | null }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Hero — WWDC style: mascot on liquid glass, one calm message. */}
      <Card className="overflow-hidden">
        <CardContent className="relative flex flex-col items-center gap-5 px-6 py-12 text-center sm:py-16">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-full bg-green-500/15 blur-2xl"
            />
            <Image
              src="/brand/bundi-hero-v2.png"
              alt="Bundi, the NEYO owl"
              width={160}
              height={160}
              className="relative h-36 w-auto drop-shadow-lg sm:h-40"
              priority
            />
          </div>

          <Badge tone="green" className="gap-1.5">
            <Feather className="h-3.5 w-3.5" />
            New from NEYO
          </Badge>

          <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50 sm:text-3xl">
            Bundi is here to help
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-navy-600 dark:text-navy-300">
            Your school&apos;s own owl — quietly reading the registers, the marks
            and the fee ledgers you already keep in NEYO, and lending a wing
            where it saves you time. Teachers stay in charge of every word.
          </p>

          {paused && (
            <div className="mt-2 flex items-center gap-2 rounded-full border border-navy-200/70 bg-warm-50 px-4 py-2 text-xs font-medium text-navy-600 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-300">
              <Lock className="h-3.5 w-3.5 text-navy-400" />
              {note ?? "Bundi is getting ready — meet your new helper soon."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capability previews — disabled while paused, zero fake output. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PREVIEWS.map((p) => {
          const Icon = p.icon;
          return (
            <Card
              key={p.title}
              className={paused ? "opacity-75" : undefined}
            >
              <CardContent className="flex gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-navy-900 dark:text-navy-50">
                    {p.title}
                    {paused && (
                      <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-500 dark:bg-navy-800 dark:text-navy-400">
                        Soon
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-navy-500 dark:text-navy-400">
                    {p.body}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-navy-400 dark:text-navy-500">
        Bundi only reads what your school already keeps in NEYO. Nothing leaves
        your school, and a teacher approves anything Bundi writes.
      </p>
    </div>
  );
}
