"use client";

/**
 * T.8 (founder-requested 2026-07-06) — real parent-portal card: request a
 * transport route/shift change for this child. Only rendered as an active
 * request-flow when the school has explicitly opted in via
 * Tenant.allowParentTransportRequests (server-enforced regardless — this
 * card just honestly hides the "request" action when the school hasn't
 * turned it on, and shows the real current route + real request history
 * either way).
 */
import * as React from "react";
import { Bus, Loader2, Plus, X, MapPin } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const selectCls = "w-full rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm dark:border-navy-700 dark:bg-navy-900";

interface ShiftOpt { id: string; name: string; seatsLeft: number; full: boolean; effectiveCapacity: number | null }
interface RouteOpt { id: string; name: string; stops: string[]; seatsLeft: number | null; shifts: ShiftOpt[] }
interface RequestRow {
  id: string; status: string; createdAt: string;
  currentRouteId: string | null; requestedRouteId: string; requestedShiftId: string | null;
  requestedPickupStop: string | null; reason: string | null;
  declineReason: string | null; billingNote: string | null;
}
interface Info {
  allowParentTransportRequests: boolean;
  current: { routeId: string; routeName: string; shiftId: string | null; shiftName: string | null; pickupStop: string | null } | null;
  routes: RouteOpt[];
  requests: RequestRow[];
}

const STATUS_TONE: Record<string, "amber" | "green" | "neutral"> = { PENDING: "amber", APPROVED: "green", DECLINED: "neutral", CANCELLED: "neutral" };

export function TransportRequestCard({ studentId }: { studentId: string }) {
  const { toast } = useToast();
  const [info, setInfo] = React.useState<Info | null>(null);
  const [requesting, setRequesting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/transport?view=info&studentId=${studentId}`);
      const json = await res.json();
      if (json.ok) setInfo(json.data);
    } catch { /* non-blocking card */ }
  }, [studentId]);
  React.useEffect(() => { load(); }, [load]);

  // Nothing real to show at all — no current route and school hasn't
  // opted in — the card stays out of the way instead of showing an empty box.
  if (info !== null && !info.current && info.routes.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bus className="h-4 w-4 text-navy-400" /> Transport</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {info === null ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : (
            <>
              {info.current ? (
                <div className="rounded-2xl bg-warm-50 px-3 py-2.5 dark:bg-navy-800">
                  <p className="text-sm font-medium text-navy-900 dark:text-navy-50">{info.current.routeName}{info.current.shiftName ? ` — ${info.current.shiftName}` : ""}</p>
                  {info.current.pickupStop && <p className="text-xs text-navy-400"><MapPin className="mr-1 inline h-3 w-3" />Picks up at {info.current.pickupStop}</p>}
                </div>
              ) : (
                <p className="py-1 text-sm text-navy-400">Not on a transport route yet.</p>
              )}

              {info.allowParentTransportRequests ? (
                <Button size="sm" variant="secondary" onClick={() => setRequesting(true)}>
                  <Plus className="h-3.5 w-3.5" /> Request a route/shift change
                </Button>
              ) : (
                <p className="text-xs text-navy-400">Route/shift change requests aren&apos;t open from the portal — contact the school office.</p>
              )}

              {info.requests.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-400">Your requests</p>
                  <ul className="space-y-1.5">
                    {info.requests.map((r) => {
                      const route = info.routes.find((rt) => rt.id === r.requestedRouteId);
                      const shift = route?.shifts.find((s) => s.id === r.requestedShiftId);
                      return (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-100 px-3 py-2 text-xs dark:border-navy-800">
                          <span className="text-navy-700 dark:text-navy-200">
                            {route?.name ?? "—"}{shift ? ` — ${shift.name}` : ""}
                            {r.status === "DECLINED" && r.declineReason ? ` — ${r.declineReason}` : ""}
                            {r.status === "APPROVED" && r.billingNote ? ` — ${r.billingNote}` : ""}
                          </span>
                          <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.toLowerCase()}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Rendered as a SIBLING of Card, never nested inside it — Card's own
          `hover:-translate-y-0.5` transform would otherwise become this
          fixed-position dialog's containing block and break full-viewport
          centering (confirmed via live Playwright screenshot this build;
          matches the exact pattern PickupPersonDialog/AltPickupDialog
          already use one level up in parent-portal-client.tsx). */}
      {requesting && info && (
        <RequestDialog
          studentId={studentId}
          routes={info.routes}
          onClose={() => setRequesting(false)}
          onDone={() => { setRequesting(false); toast({ title: "Request sent to the school ✓", tone: "success" }); load(); }}
        />
      )}
    </>
  );
}

function RequestDialog({ studentId, routes, onClose, onDone }: { studentId: string; routes: RouteOpt[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [routeId, setRouteId] = React.useState("");
  const [shiftId, setShiftId] = React.useState("");
  const [pickupStop, setPickupStop] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const route = routes.find((r) => r.id === routeId) ?? null;

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/transport", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId, requestedRouteId: routeId,
          requestedShiftId: route && route.shifts.length ? (shiftId || undefined) : undefined,
          requestedPickupStop: pickupStop || undefined,
          reason: reason || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) onDone();
      else toast({ title: json.error?.message || "Could not send the request", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-base font-semibold text-navy-900 dark:text-navy-50">Request a transport change</h3>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50 dark:hover:bg-navy-800" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>New route</Label>
            <select value={routeId} onChange={(e) => { setRouteId(e.target.value); setShiftId(""); }} className={selectCls}>
              <option value="">Pick a route…</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {route && route.shifts.length > 0 && (
            <div>
              <Label>Shift (leave blank and the school will auto-allocate a free seat)</Label>
              <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={selectCls}>
                <option value="">Auto-allocate…</option>
                {route.shifts.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.full}>
                    {s.name}{s.full ? " (full)" : ` — ${s.seatsLeft} seats left`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {route && route.stops.length > 0 && (
            <div>
              <Label>Pickup stop (optional)</Label>
              <select value={pickupStop} onChange={(e) => setPickupStop(e.target.value)} className={selectCls}>
                <option value="">Same as before…</option>
                {route.stops.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div><Label>Reason (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. We've moved house" /></div>
          <Button onClick={submit} disabled={saving || !routeId} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Send request
          </Button>
        </div>
      </div>
    </div>
  );
}
