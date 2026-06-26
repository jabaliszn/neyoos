/**
 * B.8.2 payslip PDF. Staff can download their OWN payslip; payroll admins any.
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { handleError, fail } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { issueVerification } from "@/lib/services/document.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const slip = await db.payslip.findUnique({ where: { id: params.id }, include: { run: true } });
    if (!slip || slip.run.tenantId !== user.tenantId) return fail("NOT_FOUND", "Payslip not found.", 404);
    const isAdmin = can(user.role as Role, "staff.manage") || can(user.role as Role, "finance.manage_structure");
    if (!isAdmin && slip.userId !== user.id) return fail("FORBIDDEN", "You can only download your own payslip.", 403);

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const { renderPayslipPdf } = await import("@/lib/documents/payslip-pdf");
    const { qrDataUrl, verifyUrl } = await import("@/lib/documents/qr");
    const letterNo = `PAY-${slip.id.slice(-8).toUpperCase()}`;
    const code = await issueVerification(
      user.tenantId, "payslip",
      `${letterNo} — ${slip.userName} ${slip.run.period}: net KES ${slip.netKes.toLocaleString("en-KE")}`,
      { letterNo, period: slip.run.period, net: slip.netKes }
    );
    const pdf = await renderPayslipPdf({
      schoolName: tenant.name, motto: tenant.motto, county: tenant.county,
      brandPrimary: tenant.brandPrimary || "#1c2740",
      logoUrl: tenant.logoUrl,
      period: slip.run.period, staffName: slip.userName, role: slip.role,
      basicKes: slip.basicKes, allowancesKes: slip.allowancesKes, overtimeKes: slip.overtimeKes,
      grossKes: slip.grossKes, payeKes: slip.payeKes, shifKes: slip.shifKes,
      nssfKes: slip.nssfKes, housingLevyKes: slip.housingLevyKes,
      saccoKes: slip.saccoKes, loanKes: slip.loanKes, netKes: slip.netKes,
      letterNo, verifyCode: code, qrDataUrl: await qrDataUrl(verifyUrl(code)),
      issuedDate: new Date().toISOString().slice(0, 10),
    });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="payslip-${slip.run.period}-${slip.userName.replaceAll(" ", "-")}.pdf"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
