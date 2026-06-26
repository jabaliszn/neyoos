"use client";

import * as React from "react";
import { Inbox, Plus } from "lucide-react";
import { NeyoLogo } from "@/components/brand/neyo-logo";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TableContainer, Table, THead, TBody, TR, TH, TD,
} from "@/components/ui/table";

interface Moment {
  iso: string;
  name: string;
  swName?: string;
  type: string;
}

const COLOR_SCALES: { name: string; prefix: string; shades: number[] }[] = [
  { name: "Navy", prefix: "bg-navy", shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] },
  { name: "Green", prefix: "bg-green", shades: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] },
  { name: "Warm", prefix: "bg-warm", shades: [50, 100, 200] },
];

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-20">
      <h2 className="text-lg font-semibold tracking-tight text-navy-900 dark:text-navy-50">{title}</h2>
      {children}
    </section>
  );
}

export function BrandShowcase({ moments }: { moments: Moment[] }) {
  return (
    <div className="space-y-12">
      {/* Logo */}
      <Section title="Logo & wordmark" id="logo">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="flex flex-col items-center justify-center gap-4 p-8">
            <NeyoLogo variant="full" className="h-10 text-navy-900 dark:text-navy-50" />
            <span className="text-xs text-navy-400">Full lockup (inline SVG)</span>
          </Card>
          <Card className="flex items-center justify-around gap-4 p-8">
            <div className="flex flex-col items-center gap-2">
              <NeyoLogo variant="mark" className="h-12" />
              <span className="text-xs text-navy-400">Mark</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <NeyoLogo variant="wordmark" className="h-8 text-navy-900 dark:text-navy-50" />
              <span className="text-xs text-navy-400">Wordmark</span>
            </div>
          </Card>
          <Card className="flex flex-col items-center gap-3 bg-warm-50 p-8 dark:bg-navy-950">
            {/* Raster wordmarks for external use (email, slides). */}
            <img src="/brand/wordmark-light.png" alt="NEYO wordmark (light)" className="h-12 w-auto" />
            <span className="text-xs text-navy-400">wordmark-light.png — on light</span>
          </Card>
          <Card className="flex flex-col items-center gap-3 bg-navy-950 p-8">
            <img src="/brand/wordmark-dark.png" alt="NEYO wordmark (dark)" className="h-12 w-auto" />
            <span className="text-xs text-navy-300">wordmark-dark.png — on dark</span>
          </Card>
        </div>
      </Section>

      {/* Mascot */}
      <Section title="Mascot — Bundi the owl" id="mascot">
        <Card className="flex flex-col items-center gap-3 p-8 sm:flex-row sm:items-center sm:gap-8">
          <img src="/brand/bundi-mascot.png" alt="Bundi, the NEYO owl mascot" className="h-40 w-auto" />
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-base font-semibold text-navy-900 dark:text-navy-50">Bundi</p>
            <p className="max-w-sm text-sm text-navy-500 dark:text-navy-400">
              A calm, scholarly owl (&quot;bundi&quot; is Swahili for owl). Appears in
              empty states, onboarding and celebratory moments. Navy + green, never
              loud.
            </p>
          </div>
        </Card>
      </Section>

      {/* Color tokens */}
      <Section title="Color tokens" id="colors">
        <div className="space-y-4">
          {COLOR_SCALES.map((scale) => (
            <Card key={scale.name} className="p-5">
              <p className="mb-3 text-sm font-medium text-navy-700 dark:text-navy-200">{scale.name}</p>
              <div className="flex flex-wrap gap-2">
                {scale.shades.map((s) => (
                  <div key={s} className="flex flex-col items-center gap-1">
                    <div className={`h-12 w-12 rounded-xl border border-navy-100 ${scale.prefix}-${s} dark:border-navy-800`} />
                    <span className="text-[10px] text-navy-400">{s}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Brand pattern */}
      <Section title="Brand pattern tile" id="pattern">
        <Card className="overflow-hidden p-0">
          <div
            className="h-40 w-full"
            style={{ backgroundImage: "url(/brand/pattern-tile.png)", backgroundSize: "320px" }}
          />
        </Card>
      </Section>

      {/* Component library */}
      <Section title="Component library" id="components">
        <Card className="space-y-6 p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-navy-700 dark:text-navy-200">Buttons</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary"><Plus className="h-4 w-4" /> Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-navy-700 dark:text-navy-200">Badges</p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">Neutral</Badge>
              <Badge tone="green">Paid</Badge>
              <Badge tone="amber">Pending</Badge>
              <Badge tone="red">Overdue</Badge>
              <Badge tone="blue">Info</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-navy-700 dark:text-navy-200">Input</p>
            <div className="max-w-sm space-y-1">
              <Label htmlFor="demo-input">Student name</Label>
              <Input id="demo-input" placeholder="e.g. Achieng Mary" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-navy-700 dark:text-navy-200">Stat cards</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Students" value="482" hint="+12 this term" tone="navy" />
              <StatCard label="Fees collected" value="KES 1.2M" tone="green" />
              <StatCard label="Absent today" value="7" tone="amber" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-navy-700 dark:text-navy-200">Table</p>
            <TableContainer>
              <Table>
                <THead>
                  <TR>
                    <TH>Student</TH>
                    <TH>Class</TH>
                    <TH align="right">Balance</TH>
                    <TH align="center">Status</TH>
                  </TR>
                </THead>
                <TBody>
                  <TR>
                    <TD>Achieng Mary</TD><TD>Form 2 East</TD>
                    <TD align="right">KES 0</TD>
                    <TD align="center"><Badge tone="green">Paid</Badge></TD>
                  </TR>
                  <TR>
                    <TD>Kamau Brian</TD><TD>Form 2 East</TD>
                    <TD align="right">KES 4,500</TD>
                    <TD align="center"><Badge tone="amber">Partial</Badge></TD>
                  </TR>
                  <TR>
                    <TD>Wanjiru Grace</TD><TD>Form 1 West</TD>
                    <TD align="right">KES 12,000</TD>
                    <TD align="center"><Badge tone="red">Overdue</Badge></TD>
                  </TR>
                </TBody>
              </Table>
            </TableContainer>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-navy-700 dark:text-navy-200">Empty state</p>
            <EmptyState
              icon={Inbox}
              title="No invoices yet"
              description="Create the first fee invoice to start tracking payments."
              action={<Button><Plus className="h-4 w-4" /> New invoice</Button>}
            />
          </div>
        </Card>
      </Section>

      {/* Cultural moments lookup */}
      <Section title="Cultural moments lookup" id="moments">
        <p className="text-sm text-navy-500 dark:text-navy-400">
          The Kenyan public-holiday &amp; academic calendar that powers reminders and
          the shared calendar (A.15/A.17). Upcoming this year:
        </p>
        <TableContainer>
          <Table>
            <THead>
              <TR><TH>Date</TH><TH>Moment</TH><TH>Kiswahili</TH><TH>Type</TH></TR>
            </THead>
            <TBody>
              {moments.map((m) => (
                <TR key={m.iso}>
                  <TD>{m.iso}</TD>
                  <TD>{m.name}</TD>
                  <TD className="text-navy-500 dark:text-navy-400">{m.swName ?? "—"}</TD>
                  <TD>
                    <Badge tone={m.type === "public_holiday" ? "green" : m.type === "academic" ? "amber" : "blue"}>
                      {m.type.replace("_", " ")}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Section>
    </div>
  );
}
