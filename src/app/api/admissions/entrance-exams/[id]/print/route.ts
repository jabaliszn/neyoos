import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { markEntranceExamPaperPrinted } from "@/lib/services/entrance-exam.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admissions/entrance-exams/[id]/print
 * Tracks that staff opened/printed the entrance paper, then redirects to the stored file.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.view");
    const paper = await markEntranceExamPaperPrinted(user, params.id);
    return NextResponse.redirect(new URL(paper.fileUrl, req.url));
  } catch (err) {
    return handleError(err);
  }
}
