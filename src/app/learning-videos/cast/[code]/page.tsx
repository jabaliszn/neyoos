import { notFound } from "next/navigation";
import { publicCastSession } from "@/lib/services/learning-video.service";

export const dynamic = "force-dynamic";

export default async function CastPage({ params }: { params: { code: string } }) {
  const session = await publicCastSession(params.code).catch(() => null);
  if (!session) notFound();
  return <main className="min-h-screen bg-navy-950 p-6 text-white"><div className="mx-auto max-w-6xl space-y-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-green-300">NEYO class screen</p><h1 className="text-2xl font-black">{session.title}</h1><p className="text-sm text-white/60">{session.tenant.name}{session.classLabel ? ` · ${session.classLabel}` : ""} · Cast code {session.castCode}</p></div>{session.tenant.logoUrl && <img src={session.tenant.logoUrl} alt="School badge" className="h-12 w-12 rounded-2xl bg-white object-contain p-1" />}</div><div className="aspect-video overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl"><iframe src={session.embedUrl} title={session.title} className="h-full w-full" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><p className="text-xs text-white/50">NEYO keeps the lesson in one class-screen surface with privacy-enhanced embedding. For zero-ad lessons, use school-owned uploaded videos when available.</p></div></main>;
}
