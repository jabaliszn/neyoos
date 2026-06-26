"use client";

import * as React from "react";
import {
  Newspaper,
  ImagePlus,
  Users,
  Quote,
  Trophy,
  Save,
  Plus,
  Trash2,
  Pencil,
  Eye,
  Globe2,
  Loader2,
  Search,
  MapPin,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUpload } from "@/components/ui/file-upload";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

const TABS = ["Story", "News", "Gallery", "People", "Activities", "SEO"] as const;
type Tab = (typeof TABS)[number];

type WhyItem = { title: string; detail: string };
type Settings = {
  heroHeadline: string;
  heroSubheading: string;
  heroImageUrl: string;
  history: string;
  whyChooseUs: WhyItem[];
  mapEmbedUrl: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
};
type Row = Record<string, any> & { id: string; published?: boolean; status?: string; sortOrder?: number };
type Payload = {
  school?: { name: string; slug: string };
  settings: Settings;
  leaders: Row[];
  testimonials: Row[];
  gallery: Row[];
  activities: Row[];
  news: Row[];
};

const EMPTY_SETTINGS: Settings = {
  heroHeadline: "Nurturing Excellence & Character",
  heroSubheading: "",
  heroImageUrl: "",
  history: "",
  whyChooseUs: [],
  mapEmbedUrl: "",
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: "",
  primaryCtaLabel: "Begin Application",
  secondaryCtaLabel: "Parent Portal",
};

const emptyNews = () => ({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  imageFileUrl: "",
  status: "PUBLISHED",
  featured: false,
  publishedAt: new Date().toISOString(),
});
const emptyGallery = () => ({ title: "", caption: "", imageUrl: "", category: "School life", sortOrder: 0, published: true });
const emptyLeader = () => ({ name: "", title: "", bio: "", photoUrl: "", email: "", phone: "", sortOrder: 0, published: true });
const emptyTestimonial = () => ({ quote: "", guardianName: "", relationship: "", studentName: "", photoUrl: "", sortOrder: 0, published: true });
const emptyActivity = () => ({ title: "", description: "", iconName: "graduation-cap", sortOrder: 0, published: true });

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 transition-colors duration-200 ease-apple placeholder:text-navy-300 focus:border-navy-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-50"
    />
  );
}
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-navy-400 dark:text-navy-500">{hint}</p> : null}
    </div>
  );
}
function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}
function rowStatus(row: Row) {
  if (row.status) return row.status === "PUBLISHED" ? "Published" : "Draft";
  return row.published ? "Published" : "Hidden";
}
function statusTone(row: Row): "green" | "neutral" | "amber" {
  if (row.status) return row.status === "PUBLISHED" ? "green" : "amber";
  return row.published ? "green" : "neutral";
}
function toDatetimeLocal(value: string | Date | null | undefined) {
  const date = value ? new Date(value) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PublicSiteEditor() {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("Story");
  const [data, setData] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [news, setNews] = React.useState<any>(emptyNews());
  const [gallery, setGallery] = React.useState<any>(emptyGallery());
  const [leader, setLeader] = React.useState<any>(emptyLeader());
  const [testimonial, setTestimonial] = React.useState<any>(emptyTestimonial());
  const [activity, setActivity] = React.useState<any>(emptyActivity());
  const [editing, setEditing] = React.useState<{ type: string; id: string } | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/public-site");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not load");
      setData(json.data.site);
    } catch {
      setError(true);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  function setSettings<K extends keyof Settings>(key: K, value: Settings[K]) {
    setData((prev) => prev ? { ...prev, settings: { ...prev.settings, [key]: value } } : prev);
  }
  function setWhy(index: number, patch: Partial<WhyItem>) {
    setData((prev) => {
      if (!prev) return prev;
      const list = [...prev.settings.whyChooseUs];
      list[index] = { ...list[index], ...patch };
      return { ...prev, settings: { ...prev.settings, whyChooseUs: list } };
    });
  }
  function addWhy() {
    setData((prev) => prev ? { ...prev, settings: { ...prev.settings, whyChooseUs: [...prev.settings.whyChooseUs, { title: "", detail: "" }] } } : prev);
  }
  function removeWhy(index: number) {
    setData((prev) => prev ? { ...prev, settings: { ...prev.settings, whyChooseUs: prev.settings.whyChooseUs.filter((_, i) => i !== index) } } : prev);
  }

  async function saveSettings() {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public-site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data.settings,
          whyChooseUs: data.settings.whyChooseUs.filter((x) => x.title.trim() && x.detail.trim()),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(Object.values(json.error?.fields || {})[0] as string || json.error?.message || "Could not save");
      toast({ title: "Public site settings saved", tone: "success" });
      await load();
    } catch (err: any) {
      toast({ title: err.message || "Could not save public site", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function action(action: string, payload?: any, id?: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/public-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, data: payload }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(Object.values(json.error?.fields || {})[0] as string || json.error?.message || "Could not save");
      toast({ title: "Public site updated", tone: "success" });
      setEditing(null);
      if (action.includes("news")) setNews(emptyNews());
      if (action.includes("gallery")) setGallery(emptyGallery());
      if (action.includes("leader")) setLeader(emptyLeader());
      if (action.includes("testimonial")) setTestimonial(emptyTestimonial());
      if (action.includes("activity")) setActivity(emptyActivity());
      await load();
    } catch (err: any) {
      toast({ title: err.message || "Could not update", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(section: string, id: string) {
    if (!confirm("Remove this item from the public site?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/public-site/${section}/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Could not remove");
      toast({ title: "Item removed", tone: "success" });
      await load();
    } catch (err: any) {
      toast({ title: err.message || "Could not remove", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/80 p-5 dark:border-red-900 dark:bg-red-950/20">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">Could not load public-site content.</p>
        <Button onClick={load} className="mt-3" variant="secondary">Retry</Button>
      </Card>
    );
  }
  if (!data) {
    return <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>;
  }

  const settings = data.settings || EMPTY_SETTINGS;
  const counts = {
    news: data.news.length,
    gallery: data.gallery.length,
    leaders: data.leaders.length,
    testimonials: data.testimonials.length,
    activities: data.activities.length,
    proof: settings.whyChooseUs.length,
  };
  const missing = [
    counts.news === 0 ? "one school update" : "",
    counts.gallery === 0 ? "one gallery photo" : "",
    counts.leaders === 0 ? "a principal/leader profile" : "",
    counts.testimonials === 0 ? "one parent testimonial" : "",
    counts.activities === 0 ? "one activity or club" : "",
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="green">G.11</Badge>
              <span className="text-sm font-semibold text-navy-900 dark:text-navy-50">Public school website</span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-navy-500 dark:text-navy-400">
              Edit what parents see before they sign in: admissions, school story, gallery, leaders and updates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.open(`/?tenant=${data.school?.slug || "karibu-high"}`, "_blank", "noopener,noreferrer")}><Eye className="mr-2 h-4 w-4" />Preview</Button>
            <Button onClick={saveSettings} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save story</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-navy-900 text-white shadow-card dark:bg-white dark:text-navy-950" : "border border-navy-200 bg-white/70 text-navy-600 hover:bg-white dark:border-navy-800 dark:bg-navy-900/60 dark:text-navy-300"}`}>
            {t}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">Publishing readiness</p>
            <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
              The public page works immediately. Add the missing sections below when the school is ready.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={counts.news > 0 ? "green" : "neutral"}>{counts.news} news</Badge>
            <Badge tone={counts.gallery > 0 ? "green" : "neutral"}>{counts.gallery} gallery</Badge>
            <Badge tone={counts.leaders > 0 ? "green" : "neutral"}>{counts.leaders} leaders</Badge>
            <Badge tone={counts.testimonials > 0 ? "green" : "neutral"}>{counts.testimonials} testimonials</Badge>
            <Badge tone={counts.activities > 0 ? "green" : "neutral"}>{counts.activities} activities</Badge>
            {missing.length > 0 ? <Badge tone="amber">Missing: {missing.slice(0, 2).join(", ")}{missing.length > 2 ? "…" : ""}</Badge> : <Badge tone="green">Ready for parents</Badge>}
          </div>
        </CardContent>
      </Card>

      {tab === "Story" && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-green-600" />Hero & school story</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Hero headline"><Input value={settings.heroHeadline} onChange={(e) => setSettings("heroHeadline", e.target.value)} /></Field>
              <Field label="Hero subheading"><Textarea rows={3} value={settings.heroSubheading} onChange={(e) => setSettings("heroSubheading", e.target.value)} /></Field>
              <Field label="School history / story"><Textarea rows={6} value={settings.history} onChange={(e) => setSettings("history", e.target.value)} placeholder="Founded in…, known for…, serving families from…" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Primary CTA"><Input value={settings.primaryCtaLabel} onChange={(e) => setSettings("primaryCtaLabel", e.target.value)} /></Field>
                <Field label="Secondary CTA"><Input value={settings.secondaryCtaLabel} onChange={(e) => setSettings("secondaryCtaLabel", e.target.value)} /></Field>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-green-600" />Hero image & proof points</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-navy-100 bg-navy-50 dark:border-navy-800 dark:bg-navy-900">
                {settings.heroImageUrl ? <img src={settings.heroImageUrl} alt="Landing hero" className="h-40 w-full object-cover" /> : <div className="flex h-40 items-center justify-center text-sm text-navy-400">No hero image yet</div>}
              </div>
              <FileUpload category="public-site" accept="image/*" label="Upload hero image" onUploaded={(f) => setSettings("heroImageUrl", f.url)} />
              <Field label="Hero image URL"><Input value={settings.heroImageUrl} onChange={(e) => setSettings("heroImageUrl", e.target.value)} /></Field>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label>Why choose us</Label><Button size="sm" variant="secondary" onClick={addWhy}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div>
                {settings.whyChooseUs.map((w, i) => (
                  <div key={i} className="rounded-2xl border border-navy-100 p-3 dark:border-navy-800">
                    <Input value={w.title} onChange={(e) => setWhy(i, { title: e.target.value })} placeholder="e.g. Weekly fee updates" />
                    <Textarea className="mt-2" rows={2} value={w.detail} onChange={(e) => setWhy(i, { detail: e.target.value })} placeholder="Specific proof point parents understand." />
                    <button onClick={() => removeWhy(i)} className="mt-2 text-xs font-semibold text-red-600">Remove</button>
                  </div>
                ))}
                {settings.whyChooseUs.length === 0 ? <p className="text-xs text-navy-400">Add up to 6 specific reasons parents choose the school.</p> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "News" && (
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-green-600" />{editing?.type === "news" ? "Edit update" : "New update"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Title"><Input value={news.title} onChange={(e) => setNews((p: any) => ({ ...p, title: e.target.value, slug: p.slug || slugify(e.target.value) }))} /></Field>
              <Field label="Slug"><Input value={news.slug} onChange={(e) => setNews((p: any) => ({ ...p, slug: slugify(e.target.value) }))} /></Field>
              <Field label="Short summary"><Textarea rows={2} value={news.excerpt} onChange={(e) => setNews((p: any) => ({ ...p, excerpt: e.target.value }))} /></Field>
              <Field label="Full story"><Textarea rows={6} value={news.content} onChange={(e) => setNews((p: any) => ({ ...p, content: e.target.value }))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status"><select className="h-10 w-full rounded-full border border-navy-200 bg-white px-3 text-sm dark:border-navy-800 dark:bg-navy-900" value={news.status} onChange={(e) => setNews((p: any) => ({ ...p, status: e.target.value }))}><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option></select></Field>
                <Field label="Publish date"><Input type="datetime-local" value={toDatetimeLocal(news.publishedAt)} onChange={(e) => setNews((p: any) => ({ ...p, publishedAt: new Date(e.target.value).toISOString() }))} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={news.featured} onChange={(e) => setNews((p: any) => ({ ...p, featured: e.target.checked }))} /> Feature on landing page</label>
              <FileUpload category="public-site" accept="image/*" label="Upload news image" onUploaded={(f) => setNews((p: any) => ({ ...p, imageFileUrl: f.url }))} />
              <Field label="Image URL"><Input value={news.imageFileUrl} onChange={(e) => setNews((p: any) => ({ ...p, imageFileUrl: e.target.value }))} /></Field>
              <div className="flex gap-2">
                <Button disabled={saving} onClick={() => action(editing?.type === "news" ? "update_news" : "create_news", news, editing?.id)}><Save className="mr-2 h-4 w-4" />{editing?.type === "news" ? "Update" : "Publish"}</Button>
                {editing?.type === "news" ? <Button variant="secondary" onClick={() => { setEditing(null); setNews(emptyNews()); }}>Cancel</Button> : null}
              </div>
            </CardContent>
          </Card>
          <RowsCard title="Updates" icon={<Newspaper className="h-5 w-5 text-green-600" />} rows={data.news} empty="No school updates yet." onEdit={(r) => { setEditing({ type: "news", id: r.id }); setNews({ ...r, imageFileUrl: r.imageFileUrl || "", excerpt: r.excerpt || "", publishedAt: r.publishedAt || new Date().toISOString() }); }} onDelete={(r) => remove("news", r.id)} />
        </div>
      )}

      {tab === "Gallery" && (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ImagePlus className="h-5 w-5 text-green-600" />{editing?.type === "gallery" ? "Edit image" : "Add image"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Title"><Input value={gallery.title} onChange={(e) => setGallery((p: any) => ({ ...p, title: e.target.value }))} /></Field>
              <Field label="Caption"><Textarea rows={2} value={gallery.caption} onChange={(e) => setGallery((p: any) => ({ ...p, caption: e.target.value }))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Category"><select className="h-10 w-full rounded-full border border-navy-200 bg-white px-3 text-sm dark:border-navy-800 dark:bg-navy-900" value={gallery.category} onChange={(e) => setGallery((p: any) => ({ ...p, category: e.target.value }))}>{["School life", "Academics", "Sports", "Clubs", "Boarding", "Community", "Facilities"].map((x)=><option key={x}>{x}</option>)}</select></Field><Field label="Order"><Input type="number" value={gallery.sortOrder} onChange={(e) => setGallery((p: any) => ({ ...p, sortOrder: Number(e.target.value) }))} /></Field></div>
              <FileUpload category="public-site" accept="image/*" label="Upload gallery image" onUploaded={(f) => setGallery((p: any) => ({ ...p, imageUrl: f.url }))} />
              <Field label="Image URL"><Input value={gallery.imageUrl} onChange={(e) => setGallery((p: any) => ({ ...p, imageUrl: e.target.value }))} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={gallery.published} onChange={(e) => setGallery((p: any) => ({ ...p, published: e.target.checked }))} /> Visible on public site</label>
              <Button disabled={saving} onClick={() => action(editing?.type === "gallery" ? "update_gallery" : "create_gallery", gallery, editing?.id)}><Save className="mr-2 h-4 w-4" />Save image</Button>
            </CardContent>
          </Card>
          <RowsCard title="Gallery" icon={<ImagePlus className="h-5 w-5 text-green-600" />} rows={data.gallery} empty="No gallery images yet." imageKey="imageUrl" onEdit={(r) => { setEditing({ type: "gallery", id: r.id }); setGallery({ ...emptyGallery(), ...r, caption: r.caption || "" }); }} onDelete={(r) => remove("gallery", r.id)} />
        </div>
      )}

      {tab === "People" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <PeopleForm title="Leadership" icon={<Users className="h-5 w-5 text-green-600" />} value={leader} setValue={setLeader} editing={editing?.type === "leader"} onSave={() => action(editing?.type === "leader" ? "update_leader" : "create_leader", leader, editing?.id)} />
          <PeopleForm title="Testimonials" icon={<Quote className="h-5 w-5 text-green-600" />} value={testimonial} setValue={setTestimonial} testimonial editing={editing?.type === "testimonial"} onSave={() => action(editing?.type === "testimonial" ? "update_testimonial" : "create_testimonial", testimonial, editing?.id)} />
          <RowsCard title="Leaders" icon={<Users className="h-5 w-5 text-green-600" />} rows={data.leaders} empty="No leaders yet." imageKey="photoUrl" onEdit={(r) => { setEditing({ type: "leader", id: r.id }); setLeader({ ...emptyLeader(), ...r }); }} onDelete={(r) => remove("leaders", r.id)} />
          <RowsCard title="Testimonials" icon={<Quote className="h-5 w-5 text-green-600" />} rows={data.testimonials} empty="No testimonials yet." imageKey="photoUrl" onEdit={(r) => { setEditing({ type: "testimonial", id: r.id }); setTestimonial({ ...emptyTestimonial(), ...r }); }} onDelete={(r) => remove("testimonials", r.id)} />
        </div>
      )}

      {tab === "Activities" && (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-green-600" />{editing?.type === "activity" ? "Edit activity" : "Add activity"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Title"><Input value={activity.title} onChange={(e) => setActivity((p: any) => ({ ...p, title: e.target.value }))} /></Field>
              <Field label="Description"><Textarea rows={3} value={activity.description} onChange={(e) => setActivity((p: any) => ({ ...p, description: e.target.value }))} /></Field>
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Icon"><select className="h-10 w-full rounded-full border border-navy-200 bg-white px-3 text-sm dark:border-navy-800 dark:bg-navy-900" value={activity.iconName} onChange={(e) => setActivity((p: any) => ({ ...p, iconName: e.target.value }))}>{["book-open", "graduation-cap", "trophy", "music", "palette", "users", "heart-handshake", "leaf", "shield-check"].map((x)=><option key={x}>{x}</option>)}</select></Field><Field label="Order"><Input type="number" value={activity.sortOrder} onChange={(e) => setActivity((p: any) => ({ ...p, sortOrder: Number(e.target.value) }))} /></Field></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={activity.published} onChange={(e) => setActivity((p: any) => ({ ...p, published: e.target.checked }))} /> Visible on public site</label>
              <Button disabled={saving} onClick={() => action(editing?.type === "activity" ? "update_activity" : "create_activity", activity, editing?.id)}><Save className="mr-2 h-4 w-4" />Save activity</Button>
            </CardContent>
          </Card>
          <RowsCard title="Activities & clubs" icon={<Trophy className="h-5 w-5 text-green-600" />} rows={data.activities} empty="No activities yet." onEdit={(r) => { setEditing({ type: "activity", id: r.id }); setActivity({ ...emptyActivity(), ...r }); }} onDelete={(r) => remove("activities", r.id)} />
        </div>
      )}

      {tab === "SEO" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-green-600" />Search & sharing</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="SEO title" hint="Shown in Google and browser tabs. Keep it under 70 characters."><Input value={settings.seoTitle} onChange={(e) => setSettings("seoTitle", e.target.value)} /></Field>
              <Field label="SEO description" hint="Shown under the school result in search engines."><Textarea rows={3} value={settings.seoDescription} onChange={(e) => setSettings("seoDescription", e.target.value)} /></Field>
              <FileUpload category="public-site" accept="image/*" label="Upload sharing image" onUploaded={(f) => setSettings("ogImageUrl", f.url)} />
              <Field label="Open Graph image URL"><Input value={settings.ogImageUrl} onChange={(e) => setSettings("ogImageUrl", e.target.value)} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-green-600" />Map</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Map embed URL" hint="Paste a Google Maps or OpenStreetMap embed URL. Leave blank if you do not want a map."><Input value={settings.mapEmbedUrl} onChange={(e) => setSettings("mapEmbedUrl", e.target.value)} /></Field>
              <Button onClick={saveSettings} disabled={saving}><Save className="mr-2 h-4 w-4" />Save SEO & map</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function RowsCard({ title, icon, rows, empty, imageKey, onEdit, onDelete }: { title: string; icon: React.ReactNode; rows: Row[]; empty: string; imageKey?: string; onEdit: (r: Row) => void; onDelete: (r: Row) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <EmptyState icon={Plus} title={empty} description="Add the first item using the form beside this list." /> : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="flex gap-3 rounded-2xl border border-navy-100 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-900/60">
                {imageKey && row[imageKey] ? <img src={row[imageKey]} alt="" className="h-16 w-20 rounded-xl object-cover" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-navy-900 dark:text-navy-50">{row.title || row.name || row.guardianName}</p><Badge tone={statusTone(row)}>{rowStatus(row)}</Badge>{row.featured ? <Badge tone="amber">Featured</Badge> : null}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-navy-500 dark:text-navy-400">{row.excerpt || row.caption || row.bio || row.quote || row.description || row.slug}</p>
                  <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" onClick={() => onEdit(row)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="ghost" onClick={() => onDelete(row)} className="text-red-600 hover:text-red-700"><Trash2 className="mr-1 h-3.5 w-3.5" />Remove</Button></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PeopleForm({ title, icon, value, setValue, testimonial = false, editing, onSave }: { title: string; icon: React.ReactNode; value: any; setValue: React.Dispatch<React.SetStateAction<any>>; testimonial?: boolean; editing?: boolean; onSave: () => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{icon}{editing ? `Edit ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {testimonial ? (
          <>
            <Field label="Parent quote"><Textarea rows={4} value={value.quote} onChange={(e) => setValue((p: any) => ({ ...p, quote: e.target.value }))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Guardian name"><Input value={value.guardianName} onChange={(e) => setValue((p: any) => ({ ...p, guardianName: e.target.value }))} /></Field><Field label="Relationship"><Input value={value.relationship} onChange={(e) => setValue((p: any) => ({ ...p, relationship: e.target.value }))} /></Field></div>
            <Field label="Learner name (optional)"><Input value={value.studentName} onChange={(e) => setValue((p: any) => ({ ...p, studentName: e.target.value }))} /></Field>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Name"><Input value={value.name} onChange={(e) => setValue((p: any) => ({ ...p, name: e.target.value }))} /></Field><Field label="Title"><Input value={value.title} onChange={(e) => setValue((p: any) => ({ ...p, title: e.target.value }))} /></Field></div>
            <Field label="Bio"><Textarea rows={4} value={value.bio} onChange={(e) => setValue((p: any) => ({ ...p, bio: e.target.value }))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Email"><Input value={value.email} onChange={(e) => setValue((p: any) => ({ ...p, email: e.target.value }))} /></Field><Field label="Phone"><Input value={value.phone} onChange={(e) => setValue((p: any) => ({ ...p, phone: e.target.value }))} /></Field></div>
          </>
        )}
        <FileUpload category="public-site" accept="image/*" label="Upload photo" onUploaded={(f) => setValue((p: any) => ({ ...p, photoUrl: f.url }))} />
        <Field label="Photo URL"><Input value={value.photoUrl} onChange={(e) => setValue((p: any) => ({ ...p, photoUrl: e.target.value }))} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Order"><Input type="number" value={value.sortOrder} onChange={(e) => setValue((p: any) => ({ ...p, sortOrder: Number(e.target.value) }))} /></Field><label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" checked={value.published} onChange={(e) => setValue((p: any) => ({ ...p, published: e.target.checked }))} /> Visible</label></div>
        <Button onClick={onSave}><Save className="mr-2 h-4 w-4" />Save</Button>
      </CardContent>
    </Card>
  );
}
