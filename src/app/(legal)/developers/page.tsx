import { getDeveloperCenterConfig } from "@/lib/services/developer-center.service";
import { WEBHOOK_EVENTS } from "@/lib/validations/api-keys";

export const metadata = { title: "Developer Center — NEYO" };
export const dynamic = "force-dynamic";

/**
 * Part X — Developer Center 2.0 (founder-requested 2026-07-06). Public
 * developer docs — "Not because every school will use it, but because it
 * allows NEYO to become the PLATFORM that other education software
 * connects to." Real, honest publish gate: NEYO Ops controls whether this
 * page is announced publicly via `docsPublished` (default off).
 */
export default async function DevelopersPage() {
  const config = await getDeveloperCenterConfig();

  if (!config.docsPublished) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-navy-900 dark:text-navy-50">Developer Center</h1>
        <p className="text-navy-500 dark:text-navy-400">
          NEYO&apos;s public developer platform is coming soon. In the meantime, a school&apos;s own API keys and webhooks are already available from Settings → Developer inside NEYO.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-navy-900 dark:text-navy-50">NEYO Developer Center</h1>
      <p>
        NEYO is more than a school management system — it&apos;s a real, open platform other software can build on. Whether you&apos;re a school&apos;s own IT department, a third-party integration partner, or a developer building a specialized tool, this is where you connect.
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Getting started</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Ask your school&apos;s NEYO administrator to create an API key from <strong>Settings → Developer</strong>.</li>
        <li>Start with a <strong>Sandbox</strong> key — it gives you a real, isolated demo school to build and test against, never real student data.</li>
        <li>Call the API with your key as a Bearer token: <code className="rounded-md bg-navy-50 px-1.5 py-0.5 text-xs dark:bg-navy-800">Authorization: Bearer neyo_sandbox_…</code></li>
        <li>Subscribe to real-time <strong>webhooks</strong> so your system reacts the moment something happens in NEYO — no polling needed.</li>
        <li>When ready, switch to a <strong>Live</strong> key to connect to the school&apos;s real, live data.</li>
      </ol>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Authentication</h2>
      <p>
        Every request must include a real Bearer token. NEYO never exposes the database directly — every request is authenticated, authorized against the key&apos;s granted scopes, rate-limited, and logged.
      </p>
      <pre className="overflow-x-auto rounded-xl bg-navy-900 p-4 text-xs text-white dark:bg-navy-950">
{`curl -H "Authorization: Bearer neyo_sk_..." \\
  https://your-school.neyo.co.ke/api/v1/me`}
      </pre>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Example endpoints</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-navy-500 dark:text-navy-400">
            <th className="pb-2">Endpoint</th>
            <th className="pb-2">Description</th>
            <th className="pb-2">Scope</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
          <tr>
            <td className="py-2 font-mono text-xs">GET /api/v1/me</td>
            <td className="py-2">Confirm your credentials and see real tenant identity + counts.</td>
            <td className="py-2 font-mono text-xs">reports.view</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-navy-400">More endpoints are added as real NEYO Ops needs and partner integrations grow — this list always reflects what genuinely exists today, never an aspirational roadmap.</p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Real-time webhook events</h2>
      <p>Subscribe to any of these from Settings → Developer. Every delivery is HMAC-signed and automatically retried with backoff if your endpoint is briefly unavailable.</p>
      <ul className="list-disc space-y-1 pl-5">
        {WEBHOOK_EVENTS.map((e) => (
          <li key={e}><code className="rounded-md bg-navy-50 px-1.5 py-0.5 text-xs dark:bg-navy-800">{e}</code></li>
        ))}
      </ul>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">What you can build</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Connect a school&apos;s existing finance/accounting system so fee payments sync both ways.</li>
        <li>Bring your own fingerprint or biometric attendance device.</li>
        <li>Feed live school-bus GPS data so parents see real-time arrival updates.</li>
        <li>Link an RFID library system so borrowed books and fines show inside a student&apos;s NEYO account.</li>
        <li>Build a parent mobile app on top of NEYO&apos;s real data, without direct database access.</li>
        <li>Connect a student ID card printer that reacts the moment a new student is registered.</li>
      </ul>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Security</h2>
      <p>
        Every request is authenticated, authorized against real scopes, rate-limited per key, logged, and encrypted in transit. A key can never see another school&apos;s data — tenant boundaries are enforced at the database layer, not just the API layer.
      </p>
    </>
  );
}
