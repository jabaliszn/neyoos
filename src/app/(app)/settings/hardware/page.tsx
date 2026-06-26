import { requirePagePermission } from "@/lib/core/page-guards";
import HardwareSettingsClient from "@/components/settings/hardware-settings-client";

export const dynamic = "force-dynamic";

/** I.5: hardware/device admin settings are visible only to school leadership. */
export default async function HardwareSettingsPage() {
  await requirePagePermission("tenant.manage_settings");
  return <HardwareSettingsClient />;
}
