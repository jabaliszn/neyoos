"use client";

import * as React from "react";
import { Lock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface ModuleState {
  key: string;
  label: string;
  description: string;
  href: string;
  core: boolean;
  enabled: boolean;
}

/** Settings → Modules. Toggle which modules this school uses (A.2.6). */
export function ModulesManager({
  initial,
  canManage,
}: {
  initial: ModuleState[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [modules, setModules] = React.useState(initial);
  const [pending, setPending] = React.useState<string | null>(null);

  async function toggle(key: string, next: boolean) {
    setPending(key);
    // Optimistic update.
    const prev = modules;
    setModules((ms) => ms.map((m) => (m.key === key ? { ...m, enabled: next } : m)));
    try {
      const res = await fetch(`/api/modules/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (!json.ok) {
        setModules(prev); // revert
        toast({ title: json.error?.message || "Could not update.", tone: "error" });
        return;
      }
      setModules(json.data.modules);
      toast({
        title: `${json.data.modules.find((m: ModuleState) => m.key === key)?.label} ${
          next ? "enabled" : "disabled"
        }`,
        tone: "success",
      });
    } catch {
      setModules(prev);
      toast({ title: "Network problem. Try again.", tone: "error" });
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-navy-100 dark:divide-navy-800">
          {modules.map((m) => (
            <li
              key={m.key}
              className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-navy-900 dark:text-navy-50">
                    {m.label}
                  </p>
                  {m.core && (
                    <Badge tone="neutral">
                      <Lock className="h-3 w-3" /> Core
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-navy-500 dark:text-navy-400">
                  {m.description}
                </p>
              </div>
              <div className="flex items-center">
                {pending === m.key ? (
                  <Loader2 className="h-4 w-4 animate-spin text-navy-400" />
                ) : (
                  <Toggle
                    checked={m.enabled}
                    disabled={m.core || !canManage}
                    onChange={(next) => toggle(m.key, next)}
                    aria-label={`Toggle ${m.label}`}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
