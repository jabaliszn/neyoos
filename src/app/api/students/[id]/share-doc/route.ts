/**
 * G.10 Document Set — Download + email any document (share to any printer).
 * POST -> application/json. Permission: student.view.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError, ok } from "@/lib/api/respond";
import { canViewStudent, StudentError } from "@/lib/services/student.service";
import { buildStudentIdCardPdf, buildStudentTranscriptPdf, buildTransferLetterPdf } from "@/lib/services/document.service";
import { sendEmail } from "@/lib/notifications/email";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.view");
    // Row-scoping check
    if (!(await canViewStudent(user, params.id)))
      throw new StudentError("NOT_FOUND", "Student not found.");

    const body = await req.json().catch(() => ({}));
    const { docType, emailAddress } = body;

    if (!docType || !emailAddress) {
      return new Response("Missing fields", { status: 422 });
    }

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });

    let fileName = "";
    let code = "";
    let docName = "";

    if (docType === "id-card") {
      const res = await buildStudentIdCardPdf(user.tenantId, params.id);
      fileName = res.fileName;
      code = res.code;
      docName = "Student ID Card";
    } else if (docType === "transcript") {
      const res = await buildStudentTranscriptPdf(user.tenantId, params.id);
      fileName = res.fileName;
      code = res.code;
      docName = "Academic Transcript";
    } else if (docType === "transfer-letter") {
      const res = await buildTransferLetterPdf(user.tenantId, params.id, user.fullName);
      fileName = res.fileName;
      code = res.code ?? ""; // code from transfer letter build
      docName = "Transfer leaving Letter";
    } else {
      return new Response("Unsupported document type", { status: 400 });
    }

    const subject = `[${tenant.name}] Shared ${docName} - Ref: ${code}`;
    const { buildBrandedEmailHtml } = await import("@/lib/notifications/email");
    const rawBody = `
      <p>Dear Recipient,</p>
      <p>The school office of <strong>${tenant.name}</strong> has shared a <strong>${docName}</strong> with you.</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0; font-family: monospace; font-size: 13px;">
        <strong>Document Particulars:</strong><br/>
        · Document Type: ${docName}<br/>
        · Verification Code: ${code}<br/>
        · File Name: ${fileName}
      </div>
      <p>You can download or print this document directly from our server.</p>
      <p>To verify its authenticity, please scan the document's QR code or visit:</p>
      <p><a href="${process.env.APP_BASE_URL || "http://localhost:3000"}/verify/${code}" style="color: #1f9d5f; font-weight: bold; text-decoration: underline;">Verify Document Authenticity</a></p>
      <p>Kind regards,<br/>The School Administration<br/><strong>${tenant.name}</strong></p>
    `;
    const emailBody = buildBrandedEmailHtml(tenant, subject, rawBody);

    await sendEmail(emailAddress, subject, emailBody);

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "document.shared",
        entityType: "student",
        entityId: params.id,
        metadata: JSON.stringify({ docType, emailAddress, code }),
      },
    });

    return ok({ success: true, emailSent: true, code });
  } catch (e) {
    return handleError(e);
  }
}
