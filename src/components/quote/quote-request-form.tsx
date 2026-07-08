"use client";

/**
 * Part V — NEYO Capacity-Based Pricing System 2.0 (founder-confirmed pivot,
 * 2026-07-06). The real PUBLIC "demo → quote → accept → self-serve live"
 * flow (V.6). A prospective school:
 *   1. Sees a real, instant, honest price the moment it enters (or asks
 *      NEYO to estimate) its student/staff/parent counts.
 *   2. Can request a real, human-reviewed formal quotation, optionally
 *      asking for real onboarding assistance (data import, staff
 *      training, a guide into NEYO).
 *   3. Once ready, accepts and is handed straight into the real, existing
 *      self-serve signup flow (/get-started) — no NEYO Ops manual gate
 *      blocking activation, per the founder's own confirmed answer.
 */
import * as React from "react";
import { Sparkles, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { formatKES } from "@/lib/utils";

type InstantQuoteResult = {
  studentCount: number;
  staffCount: number;
  parentCount: number;
  rawScore: number;
  monthlyPriceKes: number;
  estimatedStorageGb: number;
  estimatedAiOcrUsage: number;
  usedEstimate: boolean;
};

export function QuoteRequestForm() {
  const { toast } = useToast();
  const [studentCount, setStudentCount] = React.useState("");
  const [staffCount, setStaffCount] = React.useState("");
  const [unsure, setUnsure] = React.useState(false);
  const [quote, setQuote] = React.useState<InstantQuoteResult | null>(null);
  const [loadingQuote, setLoadingQuote] = React.useState(false);

  const [showRequestForm, setShowRequestForm] = React.useState(false);
  const [schoolName, setSchoolName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [formalQuoteRequested, setFormalQuoteRequested] = React.useState(false);
  const [onboardingAssistanceRequested, setOnboardingAssistanceRequested] = React.useState(false);
  const [onboardingAssistanceNote, setOnboardingAssistanceNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [accepted, setAccepted] = React.useState(false);

  async function getInstantQuote() {
    setLoadingQuote(true);
    try {
      const res = await fetch("/api/quotes/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          unsure
            ? { requestedEstimate: true, studentCount: studentCount ? Number(studentCount) : undefined }
            : {
                studentCount: Number(studentCount) || 0,
                staffCount: Number(staffCount) || 0,
                // Parent count is a real, silent pricing input the school
                // is never asked about — the engine estimates it from the
                // student count on the server side.
                requestedEstimate: false,
              }
        ),
      });
      const json = await res.json();
      if (json.ok) setQuote(json.data);
      else toast({ title: json.error?.message || "Could not calculate a price", tone: "error" });
    } catch {
      toast({ title: "Network problem. Please try again.", tone: "error" });
    } finally {
      setLoadingQuote(false);
    }
  }

  async function submitRequest() {
    if (!schoolName.trim() || !contactName.trim() || !contactEmail.includes("@") || contactPhone.trim().length < 9) {
      toast({ title: "Fill in your school name, name, email and phone first.", tone: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName,
          contactName,
          contactEmail,
          contactPhone,
          declaredStudentCount: quote && !unsure ? quote.studentCount : undefined,
          declaredStaffCount: quote && !unsure ? quote.staffCount : undefined,
          requestedEstimate: unsure,
          formalQuoteRequested,
          onboardingAssistanceRequested,
          onboardingAssistanceNote: onboardingAssistanceNote || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setRequestId(json.data.requestId);
        toast({ title: "Request sent — NEYO will follow up shortly.", tone: "success" });
      } else {
        toast({ title: json.error?.message || "Could not submit your request", tone: "error" });
      }
    } catch {
      toast({ title: "Network problem. Please try again.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptAndGoLive() {
    if (!requestId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/${requestId}/accept`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setAccepted(true);
        setTimeout(() => window.location.assign(`/get-started?quoteRequestId=${requestId}`), 900);
      } else {
        toast({ title: json.error?.message || "Could not accept", tone: "error" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-lg space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">See your real NEYO price</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          NEYO Complete — every real feature included for every school, priced fairly by your size. No setup fee.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="q-students" className="text-xs text-navy-400">Number of students</Label>
              <Input id="q-students" type="number" min={0} placeholder="e.g. 300" disabled={unsure} value={studentCount} onChange={(e) => setStudentCount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="q-staff" className="text-xs text-navy-400">Number of staff</Label>
              <Input id="q-staff" type="number" min={0} placeholder="e.g. 20" disabled={unsure} value={staffCount} onChange={(e) => setStaffCount(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300">
            <input type="checkbox" checked={unsure} onChange={(e) => setUnsure(e.target.checked)} className="h-4 w-4 rounded border-navy-300" />
            Not sure yet — estimate for a typical school this size
          </label>
          <Button className="w-full" disabled={loadingQuote} onClick={getInstantQuote}>
            {loadingQuote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            See my price
          </Button>

          {quote && (
            <div className="rounded-2xl border border-green-200/70 bg-green-50/60 p-5 text-center dark:border-green-900 dark:bg-green-900/10">
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">{formatKES(quote.monthlyPriceKes)}</p>
              <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">per month · every NEYO feature included · no setup fee</p>
              {quote.usedEstimate && (
                <p className="mt-1 text-xs text-navy-400">Estimated for {quote.studentCount} students, {quote.staffCount} staff — a typical school this size.</p>
              )}
              {!showRequestForm && (
                <Button variant="secondary" className="mt-4 w-full" onClick={() => setShowRequestForm(true)}>
                  Request a quotation <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showRequestForm && !requestId && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <Label htmlFor="q-school">School name</Label>
              <Input id="q-school" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Karibu High School" />
            </div>
            <div>
              <Label htmlFor="q-name">Your name</Label>
              <Input id="q-name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Wanjiru Kamau" />
            </div>
            <div>
              <Label htmlFor="q-email">Email</Label>
              <Input id="q-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@school.ac.ke" />
            </div>
            <div>
              <Label htmlFor="q-phone">Phone</Label>
              <Input id="q-phone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="0712 345 678" />
            </div>
            <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300">
              <input type="checkbox" checked={formalQuoteRequested} onChange={(e) => setFormalQuoteRequested(e.target.checked)} className="h-4 w-4 rounded border-navy-300" />
              Send me a formal, human-reviewed quotation
            </label>
            <label className="flex items-center gap-2 text-sm text-navy-600 dark:text-navy-300">
              <input type="checkbox" checked={onboardingAssistanceRequested} onChange={(e) => setOnboardingAssistanceRequested(e.target.checked)} className="h-4 w-4 rounded border-navy-300" />
              I'd like help — data import, staff training, or a guide into NEYO
            </label>
            {onboardingAssistanceRequested && (
              <Input placeholder="Anything specific we should know? (optional)" value={onboardingAssistanceNote} onChange={(e) => setOnboardingAssistanceNote(e.target.value)} />
            )}
            <Button className="w-full" disabled={submitting} onClick={submitRequest}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Send request
            </Button>
          </CardContent>
        </Card>
      )}

      {requestId && !accepted && (
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            <p className="text-sm text-navy-600 dark:text-navy-300">
              Request sent{formalQuoteRequested ? " — NEYO will follow up with a formal quotation." : "."} Ready to go live now? You can set up your account immediately with the price shown above.
            </p>
            <Button className="w-full" disabled={submitting} onClick={acceptAndGoLive}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Accept &amp; set up my school
            </Button>
          </CardContent>
        </Card>
      )}

      {accepted && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-green-600" />
          <p className="text-sm text-navy-500 dark:text-navy-400">Taking you to set up your school…</p>
        </div>
      )}
    </div>
  );
}
