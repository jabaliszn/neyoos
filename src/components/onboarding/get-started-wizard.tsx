"use client";

import * as React from "react";
import { ArrowRight, ArrowLeft, Check, Loader2, School, GraduationCap, Wallet, CalendarCheck, BookOpen, Users, BedDouble, Bus, Library, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { SlugField } from "@/components/ui/slug-field";
import { useToast } from "@/components/ui/toast";
import { slugify } from "@/lib/validations/tenant";
import { formatKES } from "@/lib/utils";

type Step = 0 | 1 | 2 | 3;

const MODULE_OPTIONS = [
  { key: "attendance", label: "Attendance", icon: CalendarCheck, on: true },
  { key: "finance", label: "Finance", icon: Wallet, on: true, locked: true },
  { key: "academics", label: "Academics", icon: BookOpen, on: true },
  { key: "staff", label: "Staff", icon: Users, on: true },
  { key: "hostel", label: "Hostel", icon: BedDouble, on: false },
  { key: "transport", label: "Transport", icon: Bus, on: false },
  { key: "library", label: "Library", icon: Library, on: false },
];

export function GetStartedWizard({ fromDemo = false, osKey = "school", quoteRequestId }: { fromDemo?: boolean; osKey?: "school" | "business" | "farm" | "creator"; quoteRequestId?: string }) {
  const { toast } = useToast();
  const [step, setStep] = React.useState<Step>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // form state
  const [schoolName, setSchoolName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [county, setCounty] = React.useState("");
  const [curriculum, setCurriculum] = React.useState<"CBC" | "8-4-4" | "BOTH">("CBC");
  const [modules, setModules] = React.useState<Record<string, boolean>>(
    Object.fromEntries(MODULE_OPTIONS.map((m) => [m.key, m.on]))
  );
  const [ownerName, setOwnerName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [ownerPhone, setOwnerPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  // Part V — Capacity-Based Pricing 2.0: real expected counts so a school
  // sees its real price the moment it launches (founder's own explicit
  // requirement — no waiting on a human for this first number). Only
  // students + staff are ever asked of a school — parent count (live or
  // dormant) is a real, silent NEYO-Ops-only pricing input, estimated
  // server-side, never a question shown to a school.
  const [expectedStudentCount, setExpectedStudentCount] = React.useState("");
  const [expectedStaffCount, setExpectedStaffCount] = React.useState("");

  function autoSlug(name: string) {
    setSchoolName(name);
    if (!slug || slug === slugify(schoolName)) setSlug(slugify(name));
  }

  function toggleModule(key: string) {
    const opt = MODULE_OPTIONS.find((m) => m.key === key);
    if (opt?.locked) return;
    setModules((m) => ({ ...m, [key]: !m[key] }));
  }

  // Part V — Capacity-Based Pricing 2.0: a real, honest, instant price the
  // moment real (or estimated) counts are entered — founder's own explicit
  // requirement: "so that they know the amount of money they would pay".
  const [instantPrice, setInstantPrice] = React.useState<{ monthlyPriceKes: number } | null>(null);
  const [instantPriceLoading, setInstantPriceLoading] = React.useState(false);
  React.useEffect(() => {
    const hasAnyCount = expectedStudentCount || expectedStaffCount;
    if (!hasAnyCount) { setInstantPrice(null); return; }
    const handle = setTimeout(async () => {
      setInstantPriceLoading(true);
      try {
        const res = await fetch("/api/quotes/instant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentCount: expectedStudentCount ? Number(expectedStudentCount) : 0,
            staffCount: expectedStaffCount ? Number(expectedStaffCount) : 0,
            // Parent count (live or dormant) is a real, silent pricing
            // input the school is never asked about here — the engine
            // estimates it from the student count on the server side.
            requestedEstimate: false,
          }),
        });
        const json = await res.json();
        if (json.ok) setInstantPrice(json.data);
      } catch {
        // best-effort live preview only
      } finally {
        setInstantPriceLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [expectedStudentCount, expectedStaffCount]);

  const canNext0 = schoolName.trim().length >= 2 && slug.length >= 3;
  const canSubmit =
    ownerName.trim().length >= 2 &&
    ownerEmail.includes("@") &&
    ownerPhone.trim().length >= 9 &&
    password.length >= 8;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const enabledModules = Object.entries(modules)
        .filter(([, on]) => on)
        .map(([k]) => k);
      const res = await fetch("/api/onboarding/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          osKey,
          schoolName,
          slug,
          county: county || undefined,
          curriculum,
          modules: enabledModules,
          ownerName,
          ownerEmail,
          ownerPhone,
          password,
          expectedStudentCount: expectedStudentCount ? Number(expectedStudentCount) : undefined,
          expectedStaffCount: expectedStaffCount ? Number(expectedStaffCount) : undefined,
          quoteRequestId: quoteRequestId || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        const msg =
          json.error?.fields
            ? (Object.values(json.error.fields)[0] as string)
            : json.error?.message || "Could not create your school.";
        setError(msg);
        return;
      }
      setStep(3);
      toast({ title: `Welcome to NEYO, ${json.data.ownerName}!`, tone: "success" });
      setTimeout(() => window.location.assign("/dashboard"), 1100);
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      {fromDemo && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300">
          You&apos;re converting from your demo. Enter your <strong>real</strong> school details below — your live school starts clean (the demo data stays in the sandbox).
        </div>
      )}
      {/* Brand + progress */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-lg font-bold text-white dark:bg-green-500">
          N
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          {step === 0 && "Set up your school"}
          {step === 1 && "Curriculum & modules"}
          {step === 2 && "Create your account"}
          {step === 3 && "You're all set"}
        </h1>
        {step < 3 && (
          <div className="mt-4 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-8 rounded-full ${
                  i <= step ? "bg-green-500" : "bg-navy-200 dark:bg-navy-700"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="school">School name</Label>
                <Input
                  id="school"
                  autoFocus
                  placeholder="Karibu High School"
                  leftAddon={<School className="h-4 w-4" />}
                  value={schoolName}
                  onChange={(e) => autoSlug(e.target.value)}
                />
              </div>
              <SlugField value={slug} onChange={setSlug} schoolName={schoolName} />
              <div>
                <Label htmlFor="county">County (optional)</Label>
                <Input
                  id="county"
                  placeholder="Kiambu"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={!canNext0} onClick={() => setStep(1)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label>Curriculum</Label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(["CBC", "8-4-4", "BOTH"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurriculum(c)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        curriculum === c
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "border-navy-200 text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300"
                      }`}
                    >
                      {c === "CBC" ? "CBE" : c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Modules to enable</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {MODULE_OPTIONS.map((m) => {
                    const Icon = m.icon;
                    const on = modules[m.key];
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => toggleModule(m.key)}
                        disabled={m.locked}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                          on
                            ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "border-navy-200 text-navy-500 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-400"
                        } ${m.locked ? "opacity-70" : ""}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {m.label}
                        {on && <Check className="ml-auto h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-navy-400">
                  Students & Finance are always on. You can change modules later.
                </p>
              </div>
              <div>
                <Label>Roughly how many people? (optional — see your real price now)</Label>
                <p className="mt-1 text-xs text-navy-400">
                  NEYO Complete: every real feature is included for every school, priced fairly by size. Leave these blank and we'll estimate for you later — but if you know your rough numbers, see your real price right now.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="w-students" className="text-xs text-navy-400">Number of students</Label>
                    <Input
                      id="w-students"
                      type="number"
                      min={0}
                      placeholder="e.g. 300"
                      value={expectedStudentCount}
                      onChange={(e) => setExpectedStudentCount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="w-staff" className="text-xs text-navy-400">Number of staff</Label>
                    <Input
                      id="w-staff"
                      type="number"
                      min={0}
                      placeholder="e.g. 20"
                      value={expectedStaffCount}
                      onChange={(e) => setExpectedStaffCount(e.target.value)}
                    />
                  </div>
                </div>
                {(instantPriceLoading || instantPrice) && (
                  <div className="mt-2 rounded-2xl border border-green-200/70 bg-green-50/60 px-4 py-3 text-sm dark:border-green-900 dark:bg-green-900/10">
                    {instantPriceLoading ? (
                      <span className="text-navy-500 dark:text-navy-400">Calculating your real price…</span>
                    ) : (
                      <>
                        <span className="font-bold text-green-700 dark:text-green-400">{formatKES(instantPrice!.monthlyPriceKes)}/month</span>
                        <span className="ml-1 text-navy-500 dark:text-navy-400">— every NEYO feature included, no setup fee.</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button className="flex-1" onClick={() => setStep(2)}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="oname">Your name</Label>
                <Input id="oname" autoFocus placeholder="Wanjiru Kamau" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="oemail">Email</Label>
                <Input id="oemail" type="email" placeholder="you@school.ac.ke" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ophone">Phone</Label>
                <Input id="ophone" type="tel" placeholder="0712 345 678" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="opass">Create a password</Label>
                <PasswordInput id="opass" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} error={error ?? undefined} />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" onClick={() => setStep(1)} disabled={loading}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button className="flex-1" onClick={submit} disabled={!canSubmit || loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Create school
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                <GraduationCap className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="mt-4 text-base font-semibold text-navy-900 dark:text-navy-50">
                {schoolName} is ready
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-navy-500 dark:text-navy-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Taking you to your dashboard…
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {step < 3 && (
        <p className="mt-6 text-center text-xs text-navy-400 dark:text-navy-600">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-green-700 dark:text-green-400">
            Sign in
          </a>
        </p>
      )}
    </div>
  );
}
