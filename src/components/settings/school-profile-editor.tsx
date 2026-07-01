"use client";

import * as React from "react";
import {
  Building2, Loader2, Plus, Trash2, ImagePlus, Save, ListChecks, MapPin, Palette,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/components/ui/toast";

interface Requirement {
  label: string;
  category: string;
  quantity?: string;
  mandatory: boolean;
}
interface Profile {
  name: string; slug: string; motto: string; vision: string; mission: string;
  about: string; county: string; phone: string; email: string; addressLine: string;
  curriculum: string; logoUrl: string; brandPrimary: string; brandAccent: string;
  socialLinks: Record<string, string>; joiningRequirements: Requirement[];
  gpsLat: number | null; gpsLng: number | null; gpsRadiusM: number | null;
  educationLevelsOffered: string[];
  schoolType: string;
  uniformSupplierName: string;
  uniformSupplierPhone: string;
}

const REQ_CATEGORIES = ["uniform", "books", "supplies", "fees", "documents", "other"];
const SOCIALS = ["website", "facebook", "instagram", "tiktok", "youtube"];
const EDUCATION_LEVELS = [
  { id: "ECDE", label: "ECDE / Pre-Primary" },
  { id: "PRIMARY", label: "Primary" },
  { id: "JUNIOR_SCHOOL", label: "Junior School" },
  { id: "SENIOR_SCHOOL", label: "Senior School" },
];

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm transition-colors duration-200 ease-apple focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900"
    />
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

export function SchoolProfileEditor() {
  const { toast } = useToast();
  const [p, setP] = React.useState<Profile | null>(null);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [liquidLevel, setLiquidLevel] = React.useState("2");
  const [liquidEnabled, setLiquidEnabled] = React.useState(true);
  const [liquidIntensity, setLiquidIntensity] = React.useState(50);
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const [appearanceSaving, setAppearanceSaving] = React.useState(false);
  const [customThemeOn, setCustomThemeOn] = React.useState(true);
  const [activationSummary, setActivationSummary] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const lvl = localStorage.getItem("neyo-liquid") || "2";
      setLiquidLevel(lvl);
      setLiquidEnabled(localStorage.getItem("neyo-liquid-enabled") !== "false");
      const savedIntensity = Number(localStorage.getItem("neyo-liquid-intensity") || 50);
      setLiquidIntensity(Number.isFinite(savedIntensity) ? Math.max(0, Math.min(100, savedIntensity)) : 50);
      const customOn = localStorage.getItem("neyo-custom-theme-active") !== "false";
      setCustomThemeOn(customOn);
    }
    fetch("/api/auth/me").then((r) => r.json()).then((j) => setIsSuperAdmin(j?.data?.user?.role === "SUPER_ADMIN")).catch(() => {});
    fetch("/api/platform/appearance").then((r) => r.json()).then((j) => {
      if (j.ok) {
        setLiquidLevel(j.data.liquidLevel);
        setLiquidEnabled(j.data.liquidEnabled !== false);
      }
    }).catch(() => {});
  }, []);

  function applyLiquidIntensity(value: number) {
    if (typeof window === "undefined") return;
    const next = Math.max(0, Math.min(100, Math.trunc(value)));
    localStorage.setItem("neyo-liquid-intensity", String(next));
    document.documentElement.style.setProperty("--lg-user-blur-boost", `${Math.round((next - 50) / 5)}px`);
    document.documentElement.style.setProperty("--lg-user-sheen-extra", `${Math.max(0, (next - 50) / 250).toFixed(2)}`);
  }

  function applyLiquid(enabled: boolean, level = liquidLevel) {
    if (typeof window === "undefined") return;
    localStorage.setItem("neyo-liquid", level);
    localStorage.setItem("neyo-liquid-enabled", String(enabled));
    document.documentElement.setAttribute("data-liquid", level);
    document.documentElement.classList.toggle("glass", enabled);
    document.documentElement.classList.toggle("flat", !enabled);
    applyLiquidIntensity(liquidIntensity);
  }

  async function savePlatformAppearance(input: { liquidLevel?: string; liquidEnabled?: boolean }) {
    if (!isSuperAdmin) {
      toast({ title: "Only NEYO company Super Admin can change platform Liquid Glass.", tone: "error" });
      return;
    }
    setAppearanceSaving(true);
    try {
      const res = await fetch("/api/platform/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not save platform appearance.");
      setLiquidLevel(json.data.liquidLevel);
      setLiquidEnabled(json.data.liquidEnabled);
      applyLiquid(json.data.liquidEnabled, json.data.liquidLevel);
      toast({ title: "Platform Liquid Glass setting saved", tone: "success" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not save platform appearance.", tone: "error" });
    } finally {
      setAppearanceSaving(false);
    }
  }

  function handleLiquidChange(val: string) {
    setLiquidLevel(val);
    savePlatformAppearance({ liquidLevel: val });
  }

  function handleCustomThemeToggle(val: boolean) {
    setCustomThemeOn(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("neyo-custom-theme-active", String(val));
      if (!val) {
        // Reset to platform default brand colors
        set("brandPrimary", "#1c2740");
        set("brandAccent", "#1f9d5f");
        toast({ title: "Custom theme disabled, reset to defaults", tone: "info" });
      } else {
        toast({ title: "Custom theme enabled", tone: "success" });
      }
    }
  }

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const [profileRes, activationRes] = await Promise.all([
        fetch("/api/school-profile"),
        fetch("/api/school-level-activation"),
      ]);
      const [profileJson, activationJson] = await Promise.all([profileRes.json(), activationRes.json()]);
      if (profileJson.ok) setP(profileJson.data.profile);
      else setError(true);
      if (activationJson.ok) setActivationSummary(activationJson.data.activation);
    } catch { setError(true); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setP((prev) => (prev ? { ...prev, [k]: v } : prev));
  }
  function setSocial(k: string, v: string) {
    setP((prev) => (prev ? { ...prev, socialLinks: { ...prev.socialLinks, [k]: v } } : prev));
  }
  function setReq(i: number, patch: Partial<Requirement>) {
    setP((prev) => {
      if (!prev) return prev;
      const list = [...prev.joiningRequirements];
      list[i] = { ...list[i], ...patch };
      return { ...prev, joiningRequirements: list };
    });
  }
  function addReq() {
    setP((prev) => prev ? { ...prev, joiningRequirements: [...prev.joiningRequirements, { label: "", category: "uniform", quantity: "", mandatory: true }] } : prev);
  }
  function removeReq(i: number) {
    setP((prev) => prev ? { ...prev, joiningRequirements: prev.joiningRequirements.filter((_, x) => x !== i) } : prev);
  }

  async function save() {
    if (!p) return;
    setSaving(true);
    try {
      const res = await fetch("/api/school-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name, motto: p.motto, vision: p.vision, mission: p.mission, about: p.about,
          county: p.county, phone: p.phone, email: p.email, addressLine: p.addressLine,
          logoUrl: p.logoUrl, brandPrimary: p.brandPrimary, brandAccent: p.brandAccent,
          socialLinks: p.socialLinks,
          joiningRequirements: p.joiningRequirements.filter((r) => r.label.trim()),
          gpsLat: p.gpsLat ?? "",
          gpsLng: p.gpsLng ?? "",
          gpsRadiusM: p.gpsRadiusM ?? "",
        }),
      });
      const json = await res.json();
      if (json.ok) { setP(json.data.profile); toast({ title: "School profile saved", tone: "success" }); }
      else {
        const msg = json.error?.fields ? Object.values(json.error.fields)[0] : json.error?.message;
        toast({ title: (msg as string) || "Could not save", tone: "error" });
      }
    } finally { setSaving(false); }
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
        Couldn&apos;t load the profile. <button onClick={load} className="font-medium underline">Retry</button>
      </div>
    );
  }
  if (!p) {
    return <div className="space-y-4">{[0,1,2].map((i)=><Skeleton key={i} className="h-40 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Identity & branding */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-navy-400" />Identity & branding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-navy-100 bg-navy-50 dark:border-navy-800 dark:bg-navy-900">
              {p.logoUrl
                ? <img src={p.logoUrl} alt="School logo" className="h-full w-full object-contain" />
                : <ImagePlus className="h-7 w-7 text-navy-300" />}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-navy-700 dark:text-navy-200">School badge / logo</p>
              <FileUpload category="logo" accept="image/*" label="Upload logo"
                onUploaded={(f) => set("logoUrl", f.url)} />
              <p className="text-xs text-navy-400">PNG/SVG, square works best. Used on receipts, reports & the public page.</p>
            </div>
          </div>

          <Field label="School name"><Input value={p.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Motto"><Input value={p.motto} onChange={(e) => set("motto", e.target.value)} placeholder="e.g. Knowledge is Light" /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary colour">
              <div className="flex items-center gap-2">
                <input type="color" value={p.brandPrimary || "#1c2740"} onChange={(e) => set("brandPrimary", e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-navy-200 dark:border-navy-700" />
                <Input value={p.brandPrimary} onChange={(e) => set("brandPrimary", e.target.value)} placeholder="#1c2740" />
              </div>
            </Field>
            <Field label="Accent colour">
              <div className="flex items-center gap-2">
                <input type="color" value={p.brandAccent || "#1f9d5f"} onChange={(e) => set("brandAccent", e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-navy-200 dark:border-navy-700" />
                <Input value={p.brandAccent} onChange={(e) => set("brandAccent", e.target.value)} placeholder="#1f9d5f" />
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 🔮 Liquid Glass & Custom Theme Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-green-600" />
            NEYO Platform Liquid Glass Control
          </CardTitle>
          <p className="text-xs text-navy-400">
            Company-wide Liquid Glass master switch. Only NEYO Super Admin can turn the glass engine ON/OFF for all schools; schools keep normal brand fields separate.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-green-200/70 bg-green-50/60 p-3.5 dark:border-green-900 dark:bg-green-900/10">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-navy-900 dark:text-navy-50">Company Liquid Glass Master Toggle</span>
              <p className="text-[10px] text-navy-500 dark:text-navy-400">
                {liquidEnabled ? "Liquid Glass is ON across the platform." : "Liquid Glass is OFF platform-wide; users see the plain theme surfaces."}
              </p>
            </div>
            <label className={`relative inline-flex items-center ${isSuperAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
              <input
                type="checkbox"
                checked={liquidEnabled}
                disabled={!isSuperAdmin || appearanceSaving}
                onChange={(e) => savePlatformAppearance({ liquidEnabled: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-navy-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-green-600 peer-checked:after:translate-x-5 dark:bg-navy-700" />
            </label>
          </div>

          {!isSuperAdmin && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              This is a NEYO Ops company control. Your school profile can still edit school branding below, but the Liquid Glass engine is controlled centrally.
            </div>
          )}

          {/* Transparency / Liquidity Level Selector */}
          <div className="space-y-1.5">
            <Label>Liquid Glass Transparency Level</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "1", label: "Subtle Matte", desc: "12px Blur (Lighter refraction)" },
                { val: "2", label: "Standard Frosted", desc: "22px Blur (Pre-paint balanced)" },
                { val: "3", label: "Deep Translucent", desc: "32px Blur (WWDC specular reflections)" },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  disabled={!isSuperAdmin || appearanceSaving}
                  onClick={() => handleLiquidChange(item.val)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    liquidLevel === item.val
                      ? "border-green-500 bg-green-500/10 text-navy-950 font-bold dark:text-white"
                      : "border-navy-100 bg-white hover:bg-navy-50 text-navy-600 dark:border-navy-800 dark:bg-navy-950"
                  }`}
                >
                  <span className="text-xs">{item.label}</span>
                  <span className="text-[10px] text-navy-400 font-normal mt-0.5">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-navy-100 bg-white/50 p-3.5 dark:border-navy-800 dark:bg-navy-950/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>My Liquid Glass Intensity</Label>
                <p className="mt-0.5 text-[10px] font-semibold text-navy-400">Per-device slider: increases/decreases blur and shine without changing the company master setting.</p>
              </div>
              <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-black text-green-700 dark:text-green-300">{liquidIntensity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={liquidIntensity}
              onChange={(e) => {
                const next = Number(e.target.value);
                setLiquidIntensity(next);
                applyLiquidIntensity(next);
              }}
              className="w-full accent-green-600"
            />
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-navy-400">
              <span>Matte</span><span>Balanced</span><span>Deep Glass</span>
            </div>
          </div>

          {/* Custom Styles Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-navy-50 bg-navy-50/20 dark:border-navy-800">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-navy-900 dark:text-navy-50">Enable Custom Theme Styles</span>
              <p className="text-[10px] text-navy-400">Toggle whether schools can override system brand colors.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={customThemeOn}
                onChange={(e) => handleCustomThemeToggle(e.target.checked)}
                className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500"
              />
            </label>
          </div>

          {customThemeOn && (
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl border border-dashed border-navy-100 dark:border-navy-800">
              <Field label="Custom Primary Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={p.brandPrimary || "#1c2740"}
                    onChange={(e) => set("brandPrimary", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-navy-200 dark:border-navy-700"
                  />
                  <Input
                    value={p.brandPrimary}
                    onChange={(e) => set("brandPrimary", e.target.value)}
                    placeholder="#1c2740"
                    className="h-9 text-xs"
                  />
                </div>
              </Field>

              <Field label="Custom Accent Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={p.brandAccent || "#1f9d5f"}
                    onChange={(e) => set("brandAccent", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-navy-200 dark:border-navy-700"
                  />
                  <Input
                    value={p.brandAccent}
                    onChange={(e) => set("brandAccent", e.target.value)}
                    placeholder="#1f9d5f"
                    className="h-9 text-xs"
                  />
                </div>
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vision, mission, about */}
      <Card>
        <CardHeader><CardTitle>Vision, mission & about</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Vision"><Textarea rows={2} value={p.vision} onChange={(e) => set("vision", e.target.value)} placeholder="To be a centre of excellence…" /></Field>
          <Field label="Mission"><Textarea rows={2} value={p.mission} onChange={(e) => set("mission", e.target.value)} placeholder="To provide a holistic education…" /></Field>
          <Field label="About / description"><Textarea rows={3} value={p.about} onChange={(e) => set("about", e.target.value)} placeholder="A short paragraph about your school." /></Field>
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><Input value={p.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0712 345 678" /></Field>
            <Field label="Email"><Input value={p.email} onChange={(e) => set("email", e.target.value)} placeholder="office@school.ac.ke" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="County"><Input value={p.county} onChange={(e) => set("county", e.target.value)} placeholder="e.g. Embu" /></Field>
            <Field label="Address"><Input value={p.addressLine} onChange={(e) => set("addressLine", e.target.value)} placeholder="P.O. Box / physical address" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SOCIALS.map((s) => (
              <Field key={s} label={s[0].toUpperCase() + s.slice(1)}>
                <Input value={p.socialLinks[s] ?? ""} onChange={(e) => setSocial(s, e.target.value)} placeholder={`https://…`} />
              </Field>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* G.17 GPS geofence for staff clock-in */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-navy-400" />Staff clock-in location (GPS)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-navy-500 dark:text-navy-400">
            When set, staff can only clock in while physically at school — their phone&apos;s GPS is
            checked against this point. Leave latitude and longitude empty to turn this off.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Latitude">
              <Input
                value={p.gpsLat ?? ""}
                onChange={(e) => setP({ ...p, gpsLat: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="-1.2921"
              />
            </Field>
            <Field label="Longitude">
              <Input
                value={p.gpsLng ?? ""}
                onChange={(e) => setP({ ...p, gpsLng: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="36.8219"
              />
            </Field>
            <Field label="Allowed radius (metres)">
              <Input
                type="number" min={50} max={5000}
                value={p.gpsRadiusM ?? ""}
                onChange={(e) => setP({ ...p, gpsRadiusM: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="300"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm" variant="secondary"
              onClick={() => {
                if (!navigator.geolocation) { toast({ title: "This device has no GPS available.", tone: "error" }); return; }
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setP((prev) => prev ? { ...prev, gpsLat: Number(pos.coords.latitude.toFixed(6)), gpsLng: Number(pos.coords.longitude.toFixed(6)), gpsRadiusM: prev.gpsRadiusM ?? 300 } : prev);
                    toast({ title: "Location captured — save to apply", tone: "success" });
                  },
                  () => toast({ title: "Could not get location. Allow location access and try again.", tone: "error" }),
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }}
            >
              <MapPin className="h-4 w-4" /> Use my current location (stand at the school gate)
            </Button>
            {p.gpsLat !== null && p.gpsLng !== null && (
              <Badge tone="green">Geofence on · {p.gpsRadiusM ?? 300} m radius</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Joining requirements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-navy-400" />New-student joining requirements</CardTitle>
          <Button size="sm" variant="secondary" onClick={addReq}><Plus className="h-4 w-4" /> Add item</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-navy-500 dark:text-navy-400">
            The master list shown to new parents (uniform, books, supplies, documents).
            At B.1 each new student gets a tick-off copy.
          </p>
          {p.joiningRequirements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy-200 px-4 py-6 text-center text-sm text-navy-400 dark:border-navy-700">
              No requirements yet. Add the first item (e.g. &quot;2 pairs of school uniform&quot;).
            </p>
          ) : (
            <ul className="space-y-2">
              {p.joiningRequirements.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 p-2.5 dark:border-navy-800">
                  <Input className="flex-1 min-w-[10rem]" value={r.label} onChange={(e) => setReq(i, { label: e.target.value })} placeholder="e.g. School uniform set" />
                  <select value={r.category} onChange={(e) => setReq(i, { category: e.target.value })} className="rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm capitalize dark:border-navy-700 dark:bg-navy-900">
                    {REQ_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input className="w-24" value={r.quantity ?? ""} onChange={(e) => setReq(i, { quantity: e.target.value })} placeholder="Qty" />
                  <button onClick={() => setReq(i, { mandatory: !r.mandatory })} title="Toggle required">
                    <Badge tone={r.mandatory ? "amber" : "neutral"}>{r.mandatory ? "Required" : "Optional"}</Badge>
                  </button>
                  <button onClick={() => removeReq(i)} className="rounded-full p-1.5 text-navy-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} className="shadow-card-hover">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </Button>
      </div>
    </div>
  );
}
