"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, ChevronRight, Download, Layers, Loader2, Lock, Mail, Menu, PlayCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LinkItem = { label: string; href: string };
type StatItem = { value: string; label: string; note?: string };
type ProductItem = { key: string; name: string; status: "LIVE" | "WAITLIST" | "COMING_SOON"; description: string; features: string[]; mediaUrl?: string };
type MediaItem = { label: string; type: "image" | "video" | "embed"; url?: string; caption?: string };
type LandingContent = {
  nav: LinkItem[];
  heroEyebrow: string;
  heroHeadline: string;
  heroSubheadline: string;
  primaryCta: LinkItem;
  secondaryCta: LinkItem;
  launchBanner?: string;
  trustStats: StatItem[];
  products: ProductItem[];
  industries: string[];
  whyNeyo: string[];
  mediaShowcase: MediaItem[];
  securityPoints: string[];
  finalHeadline: string;
  finalSubheadline: string;
  footerLinks: LinkItem[];
  socialLinks: LinkItem[];
};

interface LandingClientProps {
  customLogoUrl?: string | null;
  brandPrimary?: string;
  brandAccent?: string;
  landingContent: LandingContent;
}

const PRODUCT_ICONS: Record<string, string> = {
  school: "S",
  farm: "F",
  business: "B",
  creator: "C",
};

function waitlistValue(key: string): "school_os_demo" | "farm_os" | "business_os" | "creator_os" {
  if (key === "farm") return "farm_os";
  if (key === "business") return "business_os";
  if (key === "creator") return "creator_os";
  return "school_os_demo";
}

function openHref(href: string, router: ReturnType<typeof useRouter>) {
  if (href.startsWith("#")) document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  else router.push(href);
}

export function NeyoLandingClient({ customLogoUrl, brandPrimary = "#121a2e", brandAccent = "#1f9d5f", landingContent }: LandingClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalType, setModalType] = React.useState<"select" | "waitlist">("select");
  const [selectedOs, setSelectedOs] = React.useState<"school_os_demo" | "farm_os" | "business_os" | "creator_os">("school_os_demo");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [pwaPrompt, setPwaPrompt] = React.useState<any>(null);

  React.useEffect(() => {
    function handleBeforeInstall(e: any) { e.preventDefault(); setPwaPrompt(e); }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  async function handlePwaInstall() {
    if (!pwaPrompt) { toast({ title: "App install not available yet", description: "If NEYO is already installed, open it from your device home screen.", tone: "info" }); return; }
    pwaPrompt.prompt();
    const choice = await pwaPrompt.userChoice;
    if (choice.outcome === "accepted") toast({ title: "NEYO installed", tone: "success" });
    setPwaPrompt(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, os: selectedOs }) });
      const json = await res.json();
      if (json.ok) { toast({ title: "Request received", description: "NEYO will follow up with the right product path.", tone: "success" }); setModalOpen(false); setName(""); setEmail(""); setPhone(""); }
      else toast({ title: json.error?.message || "Could not register.", tone: "error" });
    } catch { toast({ title: "Network problem during request.", tone: "error" }); }
    finally { setLoading(false); }
  }

  function requestProduct(product?: ProductItem) {
    if (!product || product.key === "school") { router.push("/os/school/login"); return; }
    setSelectedOs(waitlistValue(product.key));
    setModalType("waitlist");
    setModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#fbf8f1] text-navy-950 antialiased selection:bg-green-500/15">
      <nav className="sticky top-0 z-40 border-b border-navy-950/10 bg-[#fbf8f1]/94 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <button onClick={() => router.push("/")} className="flex items-center gap-3 text-left">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy-950 text-white shadow-sm">
              {customLogoUrl ? <img src={customLogoUrl} alt="NEYO" className="h-full w-full rounded-2xl object-contain" /> : "N"}
            </span>
            <span className="text-lg font-black tracking-tight" style={{ color: brandPrimary }}>NEYO</span>
          </button>
          <div className="hidden items-center gap-7 lg:flex">
            {landingContent.nav.map((item) => <a key={`${item.label}-${item.href}`} href={item.href} className="text-[12px] font-black uppercase tracking-[0.18em] text-navy-500 transition hover:text-navy-950">{item.label}</a>)}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePwaInstall} className="hidden rounded-full border border-navy-950/10 bg-white/80 px-4 py-2 text-xs font-bold text-navy-700 shadow-sm sm:inline-flex"><Download className="mr-1.5 h-3.5 w-3.5" />Install</button>
            <button onClick={() => router.push("/login")} className="hidden rounded-full px-4 py-2 text-xs font-bold text-navy-700 hover:bg-white/70 sm:inline-flex">Login</button>
            <button onClick={() => { setModalType("select"); setModalOpen(true); }} className="hidden rounded-full px-5 py-2.5 text-xs font-black text-white shadow-sm sm:inline-flex" style={{ backgroundColor: brandPrimary }}>Request demo</button>
            <button aria-label="Open landing navigation" onClick={() => setMobileMenuOpen((open) => !open)} className="rounded-full border border-navy-950/10 bg-white/80 p-2 text-navy-800 shadow-sm lg:hidden"><Menu className="h-5 w-5" /></button>
          </div>
        </div>
        {mobileMenuOpen ? (
          <div className="mx-auto mt-4 max-w-7xl rounded-3xl border border-navy-950/10 bg-white p-3 shadow-card lg:hidden">
            <div className="grid gap-1">
              {landingContent.nav.map((item) => <a key={`mobile-${item.label}-${item.href}`} href={item.href} onClick={() => setMobileMenuOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-black text-navy-700 hover:bg-navy-50">{item.label}</a>)}
              <button onClick={() => { setMobileMenuOpen(false); router.push("/login"); }} className="rounded-2xl px-4 py-3 text-left text-sm font-black text-navy-700 hover:bg-navy-50">Login</button>
              <button onClick={() => { setMobileMenuOpen(false); setModalType("select"); setModalOpen(true); }} className="rounded-2xl px-4 py-3 text-left text-sm font-black text-white" style={{ backgroundColor: brandPrimary }}>Request demo</button>
            </div>
          </div>
        ) : null}
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-navy-950/10 px-5 py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div className="space-y-7">
              {landingContent.launchBanner ? <div className="inline-flex max-w-full rounded-full border border-green-700/20 bg-white/80 px-4 py-2 text-xs font-bold text-green-800 shadow-sm">{landingContent.launchBanner}</div> : null}
              <p className="text-xs font-black uppercase tracking-[0.28em] text-green-700">{landingContent.heroEyebrow}</p>
              <h1 className="max-w-4xl text-5xl font-black leading-[0.96] tracking-[-0.05em] text-navy-950 sm:text-7xl lg:text-8xl">
                {landingContent.heroHeadline}
              </h1>
              <p className="max-w-2xl text-lg font-semibold leading-relaxed text-navy-600">{landingContent.heroSubheadline}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button onClick={() => openHref(landingContent.primaryCta.href, router)} className="rounded-full px-7 py-3.5 text-sm font-black text-white shadow-card" style={{ backgroundColor: brandPrimary }}>{landingContent.primaryCta.label}<ArrowRight className="ml-2 inline h-4 w-4" /></button>
                <button onClick={() => openHref(landingContent.secondaryCta.href, router)} className="rounded-full border border-navy-950/15 bg-white px-7 py-3.5 text-sm font-black text-navy-900 shadow-sm">{landingContent.secondaryCta.label}</button>
              </div>
            </div>
            <div className="rounded-[2rem] border border-navy-950/10 bg-white p-5 shadow-pop">
              <div className="rounded-[1.5rem] border border-navy-950/10 bg-[#f6f3ec] p-4">
                <div className="mb-4 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.2em] text-green-700">NEYO apps</span><Layers className="h-5 w-5 text-green-700" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {landingContent.products.slice(0, 4).map((p) => <AppTile key={p.key} product={p} />)}
                </div>
                <div className="mt-4 rounded-2xl border border-green-700/15 bg-white p-4 text-sm font-semibold leading-relaxed text-navy-700">Pick the operating system your organization needs today. Add more when NEYO opens them.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-navy-950/10 bg-white px-5 py-12">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
            {landingContent.trustStats.map((stat) => <div key={stat.label} className="rounded-3xl border border-navy-950/10 bg-[#fbf8f1] p-6 shadow-sm"><p className="text-4xl font-black tracking-tight text-navy-950">{stat.value}</p><p className="mt-2 font-black text-navy-900">{stat.label}</p>{stat.note ? <p className="mt-1 text-sm text-navy-500">{stat.note}</p> : null}</div>)}
          </div>
        </section>

        <section id="products" className="border-b border-navy-950/10 bg-[#fbf8f1] px-5 py-20">
          <div className="mx-auto max-w-7xl space-y-10">
            <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.25em] text-green-700">Product ecosystem</p><h2 className="mt-3 text-4xl font-black tracking-tight text-navy-950">Start with one NEYO app. Grow into a complete operating system.</h2></div>
            <div className="grid gap-5 md:grid-cols-2">
              {landingContent.products.map((product) => <ProductCard key={product.key} product={product} onSelect={() => requestProduct(product)} />)}
            </div>
          </div>
        </section>

        <section id="showcase" className="border-b border-navy-950/10 bg-white px-5 py-20">
          <div className="mx-auto max-w-7xl space-y-10">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-green-700">Product proof</p><h2 className="mt-3 text-4xl font-black tracking-tight text-navy-950">Show the real product while people are deciding.</h2></div><p className="max-w-md text-sm text-navy-500">These slots are editable from NEYO Ops, so the page can show real screenshots and videos as the platform improves.</p></div>
            <div className="grid gap-5 lg:grid-cols-3">
              {landingContent.mediaShowcase.map((item) => <MediaSlot key={item.label} item={item} />)}
            </div>
          </div>
        </section>

        <section id="industries" className="border-b border-navy-950/10 bg-[#fbf8f1] px-5 py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_1.3fr]"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-green-700">Industries</p><h2 className="mt-3 text-4xl font-black tracking-tight text-navy-950">Kenyan roots. Global operating discipline.</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{landingContent.industries.map((x) => <div key={x} className="rounded-2xl border border-navy-950/10 bg-white p-4 text-sm font-black text-navy-800 shadow-sm">{x}</div>)}</div></div>
        </section>

        <section id="bundi" className="border-b border-navy-950/10 bg-white px-5 py-20">
          <div className="mx-auto grid max-w-7xl gap-10 rounded-[2rem] border border-navy-950/10 bg-[#fbf8f1] p-8 md:grid-cols-[1fr_0.75fr] md:p-10">
            <div><Badge tone="amber">Coming soon</Badge><h2 className="mt-4 text-4xl font-black tracking-tight text-navy-950">Bundi will help across every NEYO OS.</h2><p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy-600">Bundi is NEYO’s future operating assistant for reports, summaries, task help, recommendations and natural language search. It stays paused until NEYO launches it officially.</p></div>
            <div className="flex items-center justify-center rounded-[2rem] border border-navy-950/10 bg-white p-8"><div className="flex h-36 w-36 items-center justify-center rounded-[2rem] bg-navy-950 text-5xl shadow-card">🦉</div></div>
          </div>
        </section>

        <section className="border-b border-navy-950/10 bg-[#fbf8f1] px-5 py-20">
          <div className="mx-auto max-w-7xl space-y-8"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.25em] text-green-700">Customer stories</p><h2 className="mt-3 text-4xl font-black tracking-tight text-navy-950">Prepared for real case studies.</h2><p className="mt-3 text-sm text-navy-500">No fake reviews. These cards are placeholders for future schools and organizations after approvals.</p></div><div className="grid gap-5 md:grid-cols-3">{["School launch story", "Farm cooperative story", "Business growth story"].map((story) => <div key={story} className="rounded-[2rem] border border-dashed border-navy-200 bg-white p-6"><p className="font-black text-navy-950">{story}</p><p className="mt-2 text-sm text-navy-500">Reserved for a verified NEYO customer story.</p></div>)}</div></div>
        </section>

        <section id="security" className="border-b border-navy-950/10 bg-navy-950 px-5 py-20 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-green-300">Why NEYO</p><h2 className="mt-3 text-4xl font-black tracking-tight">Calm, modular software for organizations that need control.</h2><div className="mt-6 grid gap-2 sm:grid-cols-2">{landingContent.whyNeyo.map((point) => <div key={point} className="rounded-2xl border border-white/10 bg-white/7 p-3 text-sm font-bold text-white/80"><CheckCircle className="mr-2 inline h-4 w-4 text-green-300" />{point}</div>)}</div></div><div className="rounded-[2rem] border border-white/10 bg-white/7 p-6"><div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-green-300" /><p className="font-black">Security and trust</p></div><div className="space-y-3">{landingContent.securityPoints.map((point) => <div key={point} className="rounded-2xl border border-white/10 bg-navy-900 p-4 text-sm text-white/75"><Lock className="mr-2 inline h-4 w-4 text-green-300" />{point}</div>)}</div></div></div>
        </section>

        <section className="bg-white px-5 py-20 text-center"><div className="mx-auto max-w-3xl"><h2 className="text-4xl font-black tracking-tight text-navy-950 sm:text-6xl">{landingContent.finalHeadline}</h2><p className="mx-auto mt-4 max-w-xl text-base text-navy-500">{landingContent.finalSubheadline}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><button onClick={() => { setModalType("select"); setModalOpen(true); }} className="rounded-full px-7 py-3.5 text-sm font-black text-white" style={{ backgroundColor: brandPrimary }}>Request demo</button><a href="mailto:hello@neyo.co.ke" className="rounded-full border border-navy-950/15 bg-white px-7 py-3.5 text-sm font-black text-navy-800">Contact sales</a></div></div></section>
      </main>

      <footer className="bg-black px-5 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div><p className="text-lg font-black">NEYO</p><p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">Operating systems for schools, farms, businesses and creators. Built in Kenya with global standards.</p><div className="mt-6 flex gap-2">{landingContent.socialLinks.map((link) => <a key={link.label} href={link.href} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">{link.label}</a>)}</div></div>
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-white/50">Links</p><div className="mt-4 grid gap-2">{landingContent.footerLinks.map((link) => <a key={`${link.label}-${link.href}`} href={link.href} className="text-sm text-white/75 hover:text-white">{link.label}</a>)}</div></div>
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-white/50">Stay close</p><p className="mt-4 text-sm text-white/65">Get product updates and launch notes. No clutter.</p><div className="mt-4 flex rounded-full border border-white/10 bg-white/5 p-1"><input placeholder="Email address" className="min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/35" /><button className="rounded-full px-4 py-2 text-xs font-black text-white" style={{ backgroundColor: brandAccent }}><Mail className="mr-1 inline h-3.5 w-3.5" />Join</button></div></div>
        </div>
        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} NEYO. Built for Kenyan organizations.</p><p>Features only. No private integration details exposed.</p></div>
      </footer>

      {modalOpen && <WaitlistModal modalType={modalType} selectedOs={selectedOs} setSelectedOs={setSelectedOs} setModalType={setModalType} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} loading={loading} name={name} email={email} phone={phone} setName={setName} setEmail={setEmail} setPhone={setPhone} products={landingContent.products} />}
    </div>
  );
}

function AppTile({ product }: { product: ProductItem }) {
  return <div className="rounded-2xl border border-navy-950/10 bg-white p-4 shadow-sm"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-sm font-black text-green-800">{PRODUCT_ICONS[product.key] || product.name.slice(0, 1)}</div><p className="font-black text-navy-950">{product.name}</p><p className="mt-1 line-clamp-3 text-xs leading-relaxed text-navy-500">{product.description}</p></div>;
}

function ProductCard({ product, onSelect }: { product: ProductItem; onSelect: () => void }) {
  const live = product.status === "LIVE";
  return <div className="rounded-[2rem] border border-navy-950/10 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"><div className="flex items-start justify-between gap-3"><div><p className="text-xl font-black text-navy-950">{product.name}</p><p className="mt-2 text-sm leading-relaxed text-navy-500">{product.description}</p></div><Badge tone={live ? "green" : "amber"}>{live ? "Live" : "Waitlist"}</Badge></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{product.features.map((f) => <div key={f} className="rounded-2xl bg-navy-50 p-3 text-xs font-bold text-navy-700">✓ {f}</div>)}</div>{product.mediaUrl ? <div className="mt-5 rounded-2xl border border-navy-100 bg-navy-50 p-3 text-xs text-navy-500">Media ready: {product.mediaUrl}</div> : <div className="mt-5 rounded-2xl border border-dashed border-navy-200 bg-navy-50/60 p-6 text-center text-xs font-bold text-navy-400">Screenshot / video slot</div>}<button onClick={onSelect} className="mt-5 flex h-11 w-full items-center justify-center rounded-full bg-navy-950 text-xs font-black text-white">{live ? "Enter School OS" : "Join waitlist"}<ArrowRight className="ml-2 h-4 w-4" /></button></div>;
}

function MediaSlot({ item }: { item: MediaItem }) {
  const canRenderImage = Boolean(item.url && (item.url.startsWith("/") || item.url.startsWith("http")) && item.type === "image");
  return (
    <div className="rounded-[2rem] border border-navy-950/10 bg-[#fbf8f1] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="overflow-hidden rounded-[1.5rem] border border-navy-950/10 bg-white">
        <div className="flex h-8 items-center gap-1.5 border-b border-navy-950/10 bg-navy-50 px-4"><span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-green-300" /><span className="ml-2 text-[10px] font-black uppercase tracking-[0.18em] text-navy-300">NEYO preview</span></div>
        <div className="aspect-video overflow-hidden bg-white">{canRenderImage ? <img src={item.url} alt={item.label} className="h-full w-full object-cover" /> : item.url ? <div className="flex h-full flex-col items-center justify-center p-5 text-center text-xs font-bold text-navy-500">{item.type === "video" || item.type === "embed" ? <PlayCircle className="mb-2 h-7 w-7 text-green-700" /> : null}<span className="max-w-[18rem] break-words">{item.url}</span></div> : <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs font-black uppercase tracking-[0.2em] text-navy-300"><PlayCircle className="h-7 w-7" />Media slot</div>}</div>
      </div><p className="mt-4 font-black text-navy-950">{item.label}</p>{item.caption ? <p className="mt-1 text-sm text-navy-500">{item.caption}</p> : null}
    </div>
  );
}

function WaitlistModal(props: any) {
  const { modalType, selectedOs, setSelectedOs, setModalType, onClose, onSubmit, loading, name, email, phone, setName, setEmail, setPhone, products } = props;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/45 px-4 backdrop-blur-sm" onClick={onClose}><div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h3 className="font-black text-navy-950">{modalType === "select" ? "Choose a NEYO OS" : "Join the waitlist"}</h3><button onClick={onClose}><X className="h-4 w-4" /></button></div>{modalType === "select" ? <div className="space-y-2">{products.map((p: ProductItem) => <button key={p.key} onClick={() => { if (p.key === "school") window.location.assign("/os/school/login"); else { setSelectedOs(waitlistValue(p.key)); setModalType("waitlist"); } }} className="flex w-full items-center justify-between rounded-2xl border border-navy-100 p-4 text-left"><span><span className="block text-sm font-black text-navy-950">{p.name}</span><span className="text-xs text-navy-500">{p.status === "LIVE" ? "Live portal" : "Early access waitlist"}</span></span><ChevronRight className="h-4 w-4" /></button>)}</div> : <form onSubmit={onSubmit} className="space-y-4"><p className="text-sm text-navy-500">You are requesting access for <strong>{selectedOs.replace(/_/g, " ")}</strong>.</p><div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div><div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div><div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div><Button className="w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Submit request</Button></form>}</div></div>;
}
