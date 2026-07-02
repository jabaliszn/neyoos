import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import {
  getReferralRules,
  saveReferralRules,
  getSmsMarginConfig,
  saveSmsMarginConfig,
  referralDashboard,
  smsMarginDashboard,
  expireReferralCredit,
  markSmsLedgerInvoiced,
} from "@/lib/services/revenue-ops.service";
import { referralActionSchema } from "@/lib/validations/revenue-ops";

export const dynamic = "force-dynamic";

/**
 * PART M — NEYO Ops Revenue console (M.1 Referral Engine + M.2 SMS Margins).
 * SUPER_ADMIN only — company-level configuration + dashboards, never
 * tenant-scoped (this is NEYO's own business data, not a school's).
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");
    const view = req.nextUrl.searchParams.get("view") || "dashboard";

    if (view === "referral_rules") return ok({ rules: await getReferralRules() });
    if (view === "sms_margin_config") return ok({ config: await getSmsMarginConfig() });
    if (view === "referral_dashboard") return ok({ dashboard: await referralDashboard() });
    if (view === "sms_margin_dashboard") return ok({ dashboard: await smsMarginDashboard() });

    // default: everything at once for the NEYO Ops Revenue tab.
    const [rules, config, referrals, smsMargins] = await Promise.all([
      getReferralRules(),
      getSmsMarginConfig(),
      referralDashboard(),
      smsMarginDashboard(),
    ]);
    return ok({ rules, config, referrals, smsMargins });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const body = referralActionSchema.parse(await req.json());
    const actor = { id: user.id, fullName: user.fullName, tenantId: user.tenantId };

    if (body.action === "update_referral_rules") {
      const rules = await saveReferralRules(body.data, actor);
      return ok({ rules });
    }
    if (body.action === "update_sms_margin_config") {
      const config = await saveSmsMarginConfig(body.data, actor);
      return ok({ config });
    }
    if (body.action === "apply_credit") {
      return fail("INVALID", "Referral credits are applied automatically at the next NEYO subscription charge, not manually.", 422);
    }
    if (body.action === "expire_credit") {
      const credit = await expireReferralCredit(body.creditId, actor);
      return ok({ credit });
    }
    if (body.action === "mark_sms_ledger_invoiced") {
      const rowsUpdated = await markSmsLedgerInvoiced(body.tenantId, actor);
      return ok({ rowsUpdated });
    }

    return fail("INVALID", "Unknown action.", 422);
  } catch (err) {
    return handleError(err);
  }
}
