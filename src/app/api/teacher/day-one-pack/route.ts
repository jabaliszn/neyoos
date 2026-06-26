/**
 * G.27 — Mwalimu Day-One Pack PDF download.
 * GET -> application/pdf attachment. Permission: portal.teacher.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { buildMwalimuPackPdf } from "@/lib/services/document.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const user = await requirePermission("portal.teacher");
    const { pdf, fileName } = await buildMwalimuPackPdf(user);
    
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
