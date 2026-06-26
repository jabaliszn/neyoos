import { GetStartedWizard } from "@/components/onboarding/get-started-wizard";
import { getOperatingSystem, isOperatingSystemKey, type OperatingSystemKey } from "@/lib/core/operating-systems";

export const metadata = { title: "Get started — NEYO" };

/** Public first-run setup wizard (G.3/I.50). ?from=demo nudges demo→real conversion; ?os=... keeps OS context explicit. */
export default function GetStartedPage({ searchParams }: { searchParams: { from?: string; os?: string } }) {
  const osKey: OperatingSystemKey = searchParams.os && isOperatingSystemKey(searchParams.os) ? searchParams.os : "school";
  const os = getOperatingSystem(osKey);
  if (os.status !== "LIVE") {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
        <div className="rounded-3xl border border-navy-100 bg-white/80 p-8 shadow-card dark:border-navy-800 dark:bg-navy-900/70">
          <p className="text-xs font-black uppercase tracking-widest text-green-700">{os.shortName}</p>
          <h1 className="mt-3 text-2xl font-black text-navy-950 dark:text-white">{os.name} onboarding opens soon</h1>
          <p className="mt-2 text-sm text-navy-500 dark:text-navy-400">{os.tagline}</p>
          <a href={`/?waitlist=${os.key}`} className="mt-6 inline-flex rounded-full bg-navy-950 px-5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-navy-950">Join waitlist</a>
        </div>
      </div>
    );
  }
  return <GetStartedWizard fromDemo={searchParams.from === "demo"} osKey={osKey} />;
}
