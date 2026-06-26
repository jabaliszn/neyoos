import { requirePageUser } from "@/lib/core/page-guards";
import { db } from "@/lib/db";
import { TwoFactorCard } from "@/components/settings/two-factor-card";
import { PasskeysCard } from "@/components/settings/passkeys-card";
import { ConnectedAccountsCard } from "@/components/settings/connected-accounts-card";
import { DeviceAppUnlockCard } from "@/components/settings/device-app-unlock-card";
import { listPasskeys } from "@/lib/services/passkey.service";

export const dynamic = "force-dynamic";

/**
 * Settings → Security. Sectioned settings density (Principle 7).
 * Reads the real 2FA status for the signed-in user.
 */
export default async function SecuritySettingsPage() {
  const user = await requirePageUser({ isSecurityPage: true });

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true },
  });

  const passkeys = (await listPasskeys(user.id)).map((p) => ({
    id: p.id,
    deviceLabel: p.deviceLabel,
    createdAt: p.createdAt.toISOString(),
    lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
  }));

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 dark:text-navy-50">
          Security
        </h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Manage how you sign in and protect your NEYO account.
        </p>
      </div>

      <PasskeysCard initial={passkeys} />
      <DeviceAppUnlockCard hasPasskey={passkeys.length > 0} />
      <ConnectedAccountsCard />
      <TwoFactorCard initialEnabled={dbUser?.totpEnabled ?? false} />
    </div>
  );
}
