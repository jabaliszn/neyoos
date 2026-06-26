"use client";

import * as React from "react";
import { Activity, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

interface Item {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "signed in",
  "auth.logout": "signed out",
  "billing.subscribed": "changed the plan",
  "payment.received": "received a payment",
  "notification.sent": "sent a notification",
  "module.enabled": "enabled a module",
  "module.disabled": "disabled a module",
  "tenant.data_exported": "exported school data",
};

function label(a: string) {
  return ACTION_LABEL[a] ?? a.replace(/[._]/g, " ");
}
function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

/**
 * Reusable activity timeline (G.1). Pass an entity to scope it, or omit for
 * tenant-wide recent activity. Reads /api/activity (AuditLog).
 */
export function ActivityFeed({
  entityType,
  entityId,
  title = "Activity",
}: {
  entityType?: string;
  entityId?: string;
  title?: string;
}) {
  const [items, setItems] = React.useState<Item[] | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (entityType && entityId) {
      params.set("entityType", entityType);
      params.set("entityId", entityId);
    }
    fetch(`/api/activity?${params}`)
      .then((r) => r.json())
      .then((j) => setItems(j.ok ? j.data.items : []))
      .catch(() => setItems([]));
  }, [entityType, entityId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-2/3" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Actions like sign-ins, payments and changes will appear here."
          />
        ) : (
          <ul className="space-y-4">
            {items.map((it) => (
              <li key={it.id} className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy-400 dark:bg-navy-800 dark:text-navy-300">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-navy-800 dark:text-navy-100">
                    <span className="font-medium">{it.actorName ?? "System"}</span>{" "}
                    {label(it.action)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-navy-400 dark:text-navy-500">
                    <Clock className="h-3 w-3" /> {ago(it.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
