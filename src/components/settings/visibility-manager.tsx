"use client";

import * as React from "react";
import { EyeOff, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/core/roles";

// Curated set of items an owner can hide (label + href). Essentials
// (Dashboard, Settings hub, Security) are intentionally NOT listed — they can
// never be hidden so staff always keep their password & language.
const HIDEABLE: { href: string; label: string; group: string }[] = [
  { href: "/owner", label: "My School (owner metrics)", group: "Overview" },
  { href: "/finance", label: "Finance", group: "School OS" },
  { href: "/payroll", label: "Payroll", group: "School OS" },
  { href: "/staff", label: "Staff / HR", group: "School OS" },
  { href: "/students", label: "Students", group: "School OS" },
  { href: "/exams", label: "Exams", group: "School OS" },
  { href: "/discipline", label: "Discipline", group: "School OS" },
  { href: "/inventory", label: "Inventory", group: "School OS" },
  { href: "/settings/billing", label: "Settings · Billing", group: "Admin settings" },
  { href: "/settings/payments", label: "Settings · Payments", group: "Admin settings" },
  { href: "/settings/modules", label: "Settings · Modules", group: "Admin settings" },
  { href: "/settings/developer", label: "Settings · Developer", group: "Admin settings" },
  { href: "/settings/data", label: "Settings · Data export", group: "Admin settings" },
  { href: "/settings/printing", label: "Settings · Printing limits", group: "Admin settings" },
];

// Roles worth restricting. For most admin/settings pages, owners/principals must
// keep access so they can undo mistakes. I.5 specifically allows the owner to
// hide the My School metrics from owners/principals too, while /settings stays
// always visible so the rule can be reversed.
const STAFF_RESTRICTABLE_ROLES = ROLES.filter(
  (r) => !["SCHOOL_OWNER", "PRINCIPAL", "SUPER_ADMIN", "PARENT", "STUDENT"].includes(r)
);
const OWNER_VIEW_RESTRICTABLE_ROLES = ROLES.filter(
  (r) => !["SUPER_ADMIN", "PARENT", "STUDENT"].includes(r)
);

export function VisibilityManager() {
  const { toast } = useToast();
  const [map, setMap] = React.useState<Record<string, string[]> | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/settings/visibility");
      const json = await res.json();
      if (json.ok) setMap(json.data.map ?? {});
      else setMap({});
    } catch { setMap({}); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function toggle(href: string, role: Role) {
    if (!map) return;
    const current = map[href] ?? [];
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    setSaving(href + role);
    try {
      const res = await fetch("/api/settings/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ href, hiddenRoles: next }),
      });
      const json = await res.json();
      if (json.ok) {
        setMap(json.data.map ?? {});
      } else {
        toast({ title: json.error?.message || "Couldn't update", tone: "error" });
      }
    } catch { toast({ title: "Network error", tone: "error" }); }
    finally { setSaving(null); }
  }

  if (!map) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>;
  }

  const groups = Array.from(new Set(HIDEABLE.map((h) => h.group)));

  return (
    <div className="space-y-6">
      <p className="rounded-2xl border border-navy-100 bg-warm-50/60 px-4 py-3 text-xs text-navy-600 dark:border-navy-800 dark:bg-navy-900/40 dark:text-navy-300">
        Tick a role to <strong>hide</strong> that menu from it. Hidden items vanish from the sidebar for those staff. To reduce a role to just password &amp; language, hide everything else from it.
      </p>
      {groups.map((group) => (
        <Card key={group}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><EyeOff className="h-4 w-4 text-navy-500" /> {group}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {HIDEABLE.filter((h) => h.group === group).map((item) => {
              const hidden = map[item.href] ?? [];
              return (
                <div key={item.href} className="border-b border-navy-50 pb-3 last:border-0 last:pb-0 dark:border-navy-800">
                  <p className="mb-2 text-sm font-semibold text-navy-900 dark:text-navy-50">
                    {item.label}
                    {hidden.length > 0 && <span className="ml-2 text-xs font-normal text-amber-600">hidden from {hidden.length} role{hidden.length === 1 ? "" : "s"}</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(item.href === "/owner" ? OWNER_VIEW_RESTRICTABLE_ROLES : STAFF_RESTRICTABLE_ROLES).map((role) => {
                      const on = hidden.includes(role);
                      return (
                        <button
                          key={role}
                          onClick={() => toggle(item.href, role)}
                          disabled={saving === item.href + role}
                          className={
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 " +
                            (on
                              ? "bg-amber-500 text-white"
                              : "border border-navy-200 text-navy-500 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800")
                          }
                        >
                          {on && <Check className="h-3 w-3" />}
                          {ROLE_LABELS[role as Role]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
