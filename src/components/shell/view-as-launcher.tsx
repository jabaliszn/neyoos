"use client";

import * as React from "react";
import { Eye, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Recipient {
  id: string;
  fullName: string;
  roleLabel: string;
}

/** Launcher dialog to pick a staff member to preview as (G.5). */
export function ViewAsLauncher({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [people, setPeople] = React.useState<Recipient[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/conversations/recipients")
      .then((r) => r.json())
      .then((j) => setPeople(j.ok ? j.data.recipients : []))
      .catch(() => setPeople([]));
  }, []);

  async function start(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: id }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Could not start preview.", tone: "error" });
        setBusy(null);
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm animate-fade-in rounded-2xl border border-navy-100 bg-white shadow-pop dark:border-navy-700 dark:bg-navy-900">
        <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <Eye className="h-4.5 w-4.5 text-blue-600" />
            <h2 className="text-sm font-semibold text-navy-900 dark:text-navy-50">
              View as staff (read-only)
            </h2>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700 dark:hover:text-navy-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {people === null ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : people.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-navy-400">
              No staff to preview.
            </p>
          ) : (
            people.map((p) => (
              <button
                key={p.id}
                onClick={() => start(p.id)}
                disabled={busy !== null}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-navy-50 disabled:opacity-50 dark:hover:bg-navy-800"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {p.fullName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-900 dark:text-navy-50">
                    {p.fullName}
                  </p>
                  <p className="text-xs text-navy-400 dark:text-navy-500">{p.roleLabel}</p>
                </div>
                {busy === p.id && <Loader2 className="h-4 w-4 animate-spin text-navy-400" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
