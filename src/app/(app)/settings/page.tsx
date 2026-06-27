import Link from "next/link";
import {
  Building2, SlidersHorizontal, CreditCard, Smartphone, Database,
  Trash2, Webhook, ShieldCheck, Globe2, ChevronRight, Printer, EyeOff, Users, Compass, type LucideIcon,
} from "lucide-react";
import { requirePageUser } from "@/lib/core/page-guards";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { type Permission } from "@/lib/core/permissions";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface SettingItem {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
}

const ITEMS: SettingItem[] = [
  { label: "School profile", description: "Name, motto, vision, logo, colours, contacts & joining requirements.", href: "/settings/school", icon: Building2, permission: "tenant.manage_settings" },
  { label: "Curriculum", description: "Configure curricula, levels, grade bands and learning areas without hardcoding.", href: "/settings/curriculum", icon: Compass, permission: "academics.view" },
  { label: "Public website", description: "Hero, news, gallery, leaders, testimonials, activities, SEO and map.", href: "/settings/public-site", icon: Globe2, permission: "tenant.manage_settings" },
  { label: "Modules", description: "Turn features on or off for your school.", href: "/settings/modules", icon: SlidersHorizontal, permission: "tenant.manage_modules" },
  { label: "Billing", description: "Your NEYO subscription, plan and invoices.", href: "/settings/billing", icon: CreditCard, permission: "owner.dashboard" },
  { label: "Payments", description: "M-Pesa / Daraja credentials for collecting fees.", href: "/settings/payments", icon: Smartphone, permission: "tenant.manage_settings" },
  { label: "Data", description: "Export all of your school's data.", href: "/settings/data", icon: Database, permission: "tenant.export_data" },
  { label: "Printing limits", description: "Set a daily print limit; approve staff print requests.", href: "/settings/printing", icon: Printer },
  { label: "Menu & access visibility", description: "Hide menus and admin pages from staff who don't need them.", href: "/settings/visibility", icon: EyeOff, permission: "tenant.manage_settings" },
  { label: "Owners & joint approvals", description: "Register multiple owners; require a second owner for critical actions.", href: "/settings/owners", icon: Users, permission: "tenant.manage_settings" },
  { label: "Recycle Bin", description: "Restore or permanently remove deleted records.", href: "/settings/recycle-bin", icon: Trash2, permission: "tenant.manage_settings" },
  { label: "Developer", description: "API keys and webhooks for integrations.", href: "/settings/developer", icon: Webhook, permission: "api.manage" },
  { label: "Security", description: "Your password, 2FA, passkeys and sessions.", href: "/settings/security", icon: ShieldCheck },
];

/** Settings hub (G.9) — the index page that links every settings area. */
export default async function SettingsHubPage() {
  const user = await requirePageUser();

  // Non-concerned roles should NOT see administrative or school configurations.
  // They only get to see Security (passwords, language, 2FA).
  const nonConcernedRoles = ["TEACHER", "CLASS_TEACHER", "LIBRARIAN", "HOSTEL_MASTER", "SUPPORT_STAFF", "PARENT", "STUDENT"];
  const isNonConcerned = nonConcernedRoles.includes(user.role) && (!user.secondaryRole || nonConcernedRoles.includes(user.secondaryRole));

  const effectivePermissions = await effectivePermissionsForUser(user);
  let items = ITEMS.filter((i) => {
    if (!i.permission) return true;
    return effectivePermissions.includes(i.permission);
  });

  if (isNonConcerned) {
    // Forcefully strip out everything except their personal security credentials panel
    items = items.filter((i) => i.href === "/settings/security");
  }

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Manage your school, its branding, billing and access.
        </p>
      </div>

      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-navy-500 dark:text-navy-400">
          No settings configurations are available for your current role.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <Link key={it.href} href={it.href}>
              <Card className="group flex h-full items-start gap-3 p-4 transition-all duration-300 ease-apple hover:shadow-card-hover">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500 dark:bg-navy-800 dark:text-navy-300">
                  <it.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-navy-900 dark:text-navy-50">{it.label}</span>
                    <ChevronRight className="h-4 w-4 text-navy-300 transition-transform duration-200 ease-apple group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-0.5 text-sm text-navy-500 dark:text-navy-400">{it.description}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
