"use client";

/**
 * R.4 — Multi-School Parent Accounts: the real school switcher for PARENT
 * accounts. Only ever fetched/rendered for PARENT role users (the topbar
 * button itself is real-role-gated). One-click switch between real, already
 * OTP-linked accounts, plus a real "Add another school" linking flow.
 */
import * as React from "react";
import { ChevronDown, Building2, Check, Plus, Loader2, Fingerprint, X, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface LinkedSchool {
  userId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  fullName: string;
  role: string;
}

export function SchoolSwitcher({ userRole, currentTenantName }: { userRole: string; currentTenantName: string }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [schools, setSchools] = React.useState<LinkedSchool[] | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [switching, setSwitching] = React.useState<string | null>(null);
  const [linkOpen, setLinkOpen] = React.useState(false);

  const isParent = userRole === "PARENT" || userRole === "Parent";

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/multi-school");
      const json = await res.json();
      if (json.ok) {
        setSchools(json.data.schools);
        setCurrentUserId(json.data.currentUserId);
      }
    } catch { /* silent — this is a convenience switcher, not core nav */ }
  }, []);

  React.useEffect(() => {
    if (isParent) load();
  }, [isParent, load]);

  if (!isParent) return null;

  async function switchTo(targetUserId: string) {
    if (targetUserId === currentUserId) { setOpen(false); return; }
    setSwitching(targetUserId);
    try {
      const res = await fetch("/api/multi-school", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch", targetUserId }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `Switched to ${json.data.tenantName}`, tone: "success" });
        window.location.href = "/portal";
      } else {
        toast({ title: json.error?.message || "Could not switch schools.", tone: "error" });
      }
    } catch {
      toast({ title: "Network problem — try again.", tone: "error" });
    } finally {
      setSwitching(null);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold text-navy-800 hover:bg-navy-100 dark:text-navy-100 dark:hover:bg-navy-800 sm:flex"
      >
        {currentTenantName}
        {schools && schools.length > 1 && (
          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
            {schools.length} schools
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-navy-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-navy-200/70 bg-white p-2 shadow-pop dark:border-navy-700 dark:bg-navy-900">
            <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-400">Your NEYO schools</p>
            {schools === null ? (
              <div className="space-y-1.5 p-2">
                <div className="h-9 animate-pulse rounded-xl bg-navy-100 dark:bg-navy-800" />
              </div>
            ) : (
              <div className="space-y-0.5">
                {schools.map((s) => (
                  <button
                    key={s.userId}
                    onClick={() => switchTo(s.userId)}
                    disabled={switching === s.userId}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-navy-50 disabled:opacity-60 dark:hover:bg-navy-800"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-navy-500 dark:bg-navy-800 dark:text-navy-300">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy-900 dark:text-navy-50">{s.tenantName}</span>
                      <span className="block text-[11px] text-navy-400">{s.fullName}</span>
                    </span>
                    {switching === s.userId ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-navy-400" />
                    ) : s.userId === currentUserId ? (
                      <Check className="h-4 w-4 shrink-0 text-green-600" />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-1 border-t border-navy-100 pt-1 dark:border-navy-800">
              <button
                onClick={() => { setOpen(false); setLinkOpen(true); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  <Plus className="h-4 w-4" />
                </span>
                Add another school
              </button>
            </div>
          </div>
        </>
      )}

      {linkOpen && <LinkSchoolDialog onClose={() => setLinkOpen(false)} onLinked={() => { setLinkOpen(false); load(); }} />}
    </div>
  );
}

function LinkSchoolDialog({ onClose, onLinked }: { onClose: () => void; onLinked: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = React.useState<"phone" | "code">("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function sendCode() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/multi-school", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_link", phone }),
      });
      const json = await res.json();
      if (json.ok) {
        setStep("code");
        setDevCode(json.data.devCode ?? null);
        toast({ title: "Code sent — check that phone for a text from NEYO", tone: "success" });
      } else {
        setError(json.error?.message || "Could not send code.");
      }
    } catch {
      setError("Network problem — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function verifyCode() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/multi-school", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_link", phone, code }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: `Linked to ${json.data.linkedSchool.tenantName}`, tone: "success" });
        onLinked();
      } else {
        setError(json.error?.message || "That code is not correct.");
      }
    } catch {
      setError("Network problem — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-6 shadow-card dark:border-navy-800 dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-navy-900 dark:text-navy-50">
            <Building2 className="h-5 w-5 text-green-600" /> Add another school
          </h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "phone" ? (
          <div className="space-y-3">
            <p className="text-sm text-navy-500 dark:text-navy-400">
              Enter the phone number registered as your NEYO parent account at your OTHER child&apos;s school. We&apos;ll text a code to that phone to confirm it&apos;s really you.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-600 dark:text-navy-300">Other school&apos;s phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              onClick={sendCode}
              disabled={saving || phone.trim().length < 9}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send code
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => setStep("phone")} className="flex items-center gap-1 text-xs text-navy-400 hover:text-navy-700">
              <ArrowLeft className="h-3.5 w-3.5" /> Change number
            </button>
            <p className="text-sm text-navy-500 dark:text-navy-400">Enter the 6-digit code we texted to {phone}.</p>
            {devCode && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                Dev mode only — code: <span className="font-mono font-bold">{devCode}</span>
              </p>
            )}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-center font-mono text-lg tracking-widest focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              onClick={verifyCode}
              disabled={saving || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              Verify & link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
