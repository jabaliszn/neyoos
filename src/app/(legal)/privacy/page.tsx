import { db } from "@/lib/db";

export const metadata = { title: "Privacy Policy — NEYO" };

/** Privacy Policy (A.14). KE Data Protection Act 2019 aware. */
export default async function PrivacyPage() {
  const setting = await db.platformSetting.findUnique({ where: { key: "privacy_policy" } }).catch(() => null);

  if (setting && setting.value) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-navy-900 dark:text-navy-50">Privacy Policy</h1>
        <p className="text-xs text-navy-400">Dynamically Updated via NEYO Ops Control Panel</p>
        <div className="text-sm text-navy-700 dark:text-navy-200 whitespace-pre-wrap leading-relaxed">
          {setting.value}
        </div>
      </div>
    );
  }

  // Fallback to compliant original text
  return (
    <>
      <h1 className="text-2xl font-semibold text-navy-900 dark:text-navy-50">Privacy Policy</h1>
      <p className="text-navy-500 dark:text-navy-400">Last updated: 11 June 2026</p>

      <p>
        NEYO (&ldquo;we&rdquo;) provides school management software to institutions in Kenya.
        This policy explains how we handle personal data in line with the Kenya Data
        Protection Act, 2019.
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Who controls your data</h2>
      <p>
        Each school using NEYO is the <strong>data controller</strong> for its students, parents
        and staff. NEYO acts as the <strong>data processor</strong>, handling data on the
        school&rsquo;s instructions. NEYO is registered with the Office of the Data Protection
        Commissioner (ODPC) and has designated a Data Protection Officer (DPO).
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">What we collect</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Account details (name, phone, email, role).</li>
        <li>School records you enter (students, attendance, fees, results).</li>
        <li>Payment references from M-Pesa (we never store full card or PIN data).</li>
        <li>Security logs (sign-ins) to protect accounts.</li>
      </ul>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">How we protect it</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Strict per-school data isolation — one school can never see another&rsquo;s data.</li>
        <li>Passwords hashed with Argon2id; sensitive credentials encrypted (AES-256-GCM) with per-school keys.</li>
        <li>Encrypted connections (HTTPS), security headers, and rate limiting.</li>
        <li>An immutable audit log of sensitive actions.</li>
      </ul>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Your rights</h2>
      <p>
        You may request access, correction, erasure, or a portable copy of your data. Schools can
        export their full data at any time from Settings → Data. To exercise rights, contact your
        school administrator or NEYO&rsquo;s DPO at <strong>dpo@neyo.co.ke</strong>.
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Data breaches</h2>
      <p>
        If a breach affecting personal data occurs, we will notify the ODPC and affected schools
        within 72 hours of becoming aware, as required by law.
      </p>

      <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">Contact</h2>
      <p>NEYO Data Protection Officer — dpo@neyo.co.ke</p>
    </>
  );
}
