"use client";

/**
 * B.2.1 public online application form. No login. Mobile-first 360px.
 * Success state shows the application number for the parent to keep.
 */
import * as React from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function ApplyForm({ schoolName }: { schoolName: string }) {
  const [f, setF] = React.useState({
    firstName: "", middleName: "", lastName: "", gender: "M", dateOfBirth: "",
    gradeWanted: "", curriculum: "CBC", previousSchool: "",
    guardianName: "", guardianPhone: "", guardianEmail: "", notes: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ applicationNo: string } | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admissions/apply${window.location.search}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const json = await res.json();
      if (json.ok) setDone(json.data);
      else setErrorMsg(json.error?.message ?? "Something went wrong. Please try again.");
    } catch {
      setErrorMsg("Network problem — check your connection and try again.");
    } finally { setSaving(false); }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </span>
          <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Application received</h2>
          <p className="text-sm text-navy-500 dark:text-navy-400">
            Your application number is
          </p>
          <p className="rounded-xl bg-warm-50 px-4 py-2 font-mono text-base font-semibold text-navy-900 dark:bg-navy-800 dark:text-navy-50">
            {done.applicationNo}
          </p>
          <p className="max-w-sm text-xs text-navy-400">
            Keep this number. {schoolName} will call the guardian phone number you provided about the next steps.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">The learner</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="fn">First name</Label><Input id="fn" required value={f.firstName} onChange={set("firstName")} /></div>
            <div><Label htmlFor="ln">Last name</Label><Input id="ln" required value={f.lastName} onChange={set("lastName")} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="g">Gender</Label>
              <select id="g" value={f.gender} onChange={set("gender")} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                <option value="M">Boy</option><option value="F">Girl</option>
              </select>
            </div>
            <div><Label htmlFor="dob">Date of birth</Label><Input id="dob" type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} /></div>
            <div>
              <Label htmlFor="cur">Curriculum</Label>
              <select id="cur" value={f.curriculum} onChange={set("curriculum")} className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800">
                <option value="CBC">CBE</option><option value="8-4-4">8-4-4</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="gw">Class applying for</Label><Input id="gw" required placeholder="e.g. Grade 4 or Form 1" value={f.gradeWanted} onChange={set("gradeWanted")} /></div>
            <div><Label htmlFor="ps">Previous school (optional)</Label><Input id="ps" value={f.previousSchool} onChange={set("previousSchool")} /></div>
          </div>

          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Parent / guardian</p>
          <div><Label htmlFor="gn">Full name</Label><Input id="gn" required value={f.guardianName} onChange={set("guardianName")} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="gp">Phone</Label><Input id="gp" required placeholder="07XX XXX XXX" value={f.guardianPhone} onChange={set("guardianPhone")} /></div>
            <div><Label htmlFor="ge">Email (optional)</Label><Input id="ge" type="email" value={f.guardianEmail} onChange={set("guardianEmail")} /></div>
          </div>
          <div>
            <Label htmlFor="nt">Anything the school should know? (optional)</Label>
            <textarea id="nt" rows={3} value={f.notes} onChange={set("notes")}
              className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-100" />
          </div>

          {errorMsg && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{errorMsg}</p>}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit application
          </Button>
          <p className="text-center text-[11px] text-navy-400">
            By submitting you agree to be contacted by {schoolName} about this application.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}
