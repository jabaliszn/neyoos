"use client";

import * as React from "react";
import { RotateCcw, Trash2, Loader2, Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useBiometricGate } from "@/components/auth/biometric-gate";

interface Item {
  kind: string;
  id: string;
  label: string;
  detail: string;
  deletedAt: string;
}

export function RecycleBin() {
  const { toast } = useToast();
  const { requireBiometric } = useBiometricGate();
  const [items, setItems] = React.useState<Item[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/recycle-bin");
    const json = await res.json();
    setItems(json.ok ? json.data.items : []);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function doAct(it: Item, action: "restore" | "purge") {
    setBusy(it.id);
    try {
      const res = await fetch("/api/recycle-bin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, kind: it.kind, id: it.id }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Action failed.", tone: "error" });
        return;
      }
      setItems((xs) => (xs ?? []).filter((x) => x.id !== it.id));
      toast({
        title: action === "restore" ? "Restored" : "Permanently deleted",
        tone: action === "restore" ? "success" : "info",
      });
    } finally {
      setBusy(null);
    }
  }

  function act(it: Item, action: "restore" | "purge") {
    // H.2 Biometric-gated critical action: permanent deletion requires a
    // fingerprint / Face ID confirmation — no password can bypass it.
    if (action === "purge") {
      requireBiometric(`Permanently delete "${it.label}"`, () => doAct(it, "purge"));
      return;
    }
    doAct(it, "restore");
  }

  if (items === null) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Archive}
        title="Recycle bin is empty"
        description="Deleted records appear here for 30 days before they're cleared."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-navy-100 dark:divide-navy-800">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">
                {it.label}
              </p>
              <p className="text-xs text-navy-400 dark:text-navy-500">
                {it.detail} · deleted{" "}
                {new Date(it.deletedAt).toLocaleDateString("en-KE", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => act(it, "restore")}
                disabled={busy === it.id}
              >
                {busy === it.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Restore
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => act(it, "purge")}
                disabled={busy === it.id}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
