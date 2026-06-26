import { runHealthChecks, type Check } from "@/lib/observability/health";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const OVERALL = {
  operational: { label: "All systems operational", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30", Icon: CheckCircle2 },
  degraded: { label: "Some systems degraded", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30", Icon: AlertTriangle },
  down: { label: "Major outage", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/30", Icon: XCircle },
} as const;

function StatusRow({ check }: { check: Check }) {
  const map = {
    operational: { label: "Operational", color: "text-green-600", Icon: CheckCircle2 },
    degraded: { label: "Degraded", color: "text-amber-600", Icon: AlertTriangle },
    down: { label: "Down", color: "text-red-600", Icon: XCircle },
    not_configured: { label: "Not configured", color: "text-navy-400", Icon: MinusCircle },
  }[check.status];
  const Icon = map.Icon;
  return (
    <div className="flex items-center justify-between border-b border-navy-100 py-4 last:border-0 dark:border-navy-800">
      <div>
        <p className="text-sm font-medium text-navy-900 dark:text-navy-50">{check.name}</p>
        {check.detail && (
          <p className="text-xs text-navy-400 dark:text-navy-500">{check.detail}</p>
        )}
      </div>
      <span className={`flex items-center gap-1.5 text-sm font-medium ${map.color}`}>
        <Icon className="h-4 w-4" />
        {map.label}
        {check.latencyMs != null && (
          <span className="ml-1 text-xs text-navy-400">{check.latencyMs}ms</span>
        )}
      </span>
    </div>
  );
}

/** Public status page (A.13). No auth — anyone can check NEYO's health. */
export default async function StatusPage() {
  const health = await runHealthChecks();
  const o = OVERALL[health.status];

  return (
    <div className="min-h-screen bg-warm-100 px-4 py-16 dark:bg-navy-950">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy-900 text-sm font-bold text-white dark:bg-green-500">
            N
          </div>
          <span className="text-sm font-semibold text-navy-700 dark:text-navy-200">
            NEYO Status
          </span>
        </div>

        <div className={`mb-6 flex items-center gap-3 rounded-2xl ${o.bg} p-5`}>
          <o.Icon className={`h-7 w-7 ${o.color}`} />
          <div>
            <p className={`text-base font-semibold ${o.color}`}>{o.label}</p>
            <p className="text-xs text-navy-500 dark:text-navy-400">
              Updated {new Date(health.time).toLocaleString("en-KE")}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-navy-100 bg-white px-5 dark:border-navy-800 dark:bg-navy-900">
          {health.checks.map((c) => (
            <StatusRow key={c.name} check={c} />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-navy-400 dark:text-navy-600">
          Built for Kenyan schools · NEYO
        </p>
      </div>
    </div>
  );
}
