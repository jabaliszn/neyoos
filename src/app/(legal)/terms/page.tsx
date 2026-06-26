import { db } from "@/lib/db";

export const metadata = { title: "Terms of Service — NEYO" };

/** Terms of Service (A.14). */
export default async function TermsPage() {
  const setting = await db.platformSetting.findUnique({ where: { key: "terms_of_service" } }).catch(() => null);

  if (setting && setting.value) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-navy-900 dark:text-navy-50">Terms of Service</h1>
        <p className="text-xs text-navy-400">Dynamically Updated via NEYO Ops Control Panel</p>
        <div className="text-sm text-navy-700 dark:text-navy-200 whitespace-pre-wrap leading-relaxed">
          {setting.value}
        </div>
      </div>
    );
  }

  // Fallback to compliant original terms
  return (
    <>
      <h1 className="text-2xl font-semibold text-navy-900 dark:text-navy-50">Terms of Service</h1>
      <p className="text-navy-500 dark:text-navy-400">Last updated: 11 June 2026</p>

      <p>
        These terms govern your use of NEYO. By creating a school account or using the service,
        you agree to them.
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Accounts</h2>
      <p>
        You are responsible for the accuracy of information you enter and for keeping your login
        credentials secure. The school owner is responsible for managing staff access.
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Plans &amp; payments</h2>
      <p>
        NEYO offers Free Karibu, Pro and Elite plans. Paid plans are billed per term in KES via
        M-Pesa. Soft usage limits apply; exceeding them may prompt an upgrade. We honour the price
        agreed at sign-up (price grandfathering). Missing a payment starts a grace period during
        which your data is preserved.
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Acceptable use</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Use NEYO only for legitimate school administration.</li>
        <li>Do not attempt to access another school&rsquo;s data or disrupt the service.</li>
        <li>Comply with Kenyan law, including the Data Protection Act, 2019.</li>
      </ul>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Your data</h2>
      <p>
        Your school&rsquo;s data belongs to your school. You can export it at any time. If you
        stop using NEYO, you may request deletion of your data subject to legal retention
        requirements.
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Availability</h2>
      <p>
        We work hard to keep NEYO available and publish live status at /status. We are not liable
        for losses arising from circumstances beyond our reasonable control.
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Contact</h2>
      <p>Questions about these terms — hello@neyo.co.ke</p>
    </>
  );
}
