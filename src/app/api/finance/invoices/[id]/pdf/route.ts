/**
 * B.7+ invoice PDF download — print-tracked (copy # + audit). finance.view.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { buildInvoicePdf } from "@/lib/services/finance.service";
import { assertCanPrint, recordPrint } from "@/lib/services/print-limits.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("finance.view");
    // H.2 Customized Printing Limits — gate non-privileged roles per day.
    await assertCanPrint(user, "INVOICE", params.id);
    const { pdf, fileName } = await buildInvoicePdf(user, params.id);
    await recordPrint(user);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
