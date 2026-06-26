import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { initiateStkPush } from "@/lib/services/payment.service";
import { normalizeKePhone } from "@/lib/validations/auth";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  verifyCode: z.string().min(1),
  amount: z.coerce.number().int().positive("Enter a valid amount"),
  phone: z.string().min(1, "Phone is required"),
});

/** POST /api/payments/public-stk — Public parent payment trigger supporting both Legacy & NEYO generated IDs */
export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json().catch(() => ({})));
    const phone = normalizeKePhone(input.phone);
    if (!phone) return fail("VALIDATION_ERROR", "Enter a valid Kenyan phone.", 422);

    // Load the verification record to get student and tenant info
    const rec = await db.documentVerification.findUnique({
      where: { code: input.verifyCode.toUpperCase() },
    });
    if (!rec || rec.docType !== "student_id") {
      return fail("NOT_FOUND", "Valid student verification code required.", 404);
    }

    // Extract student Name and Admission Number from summary: "Student ID Card — <Name> (<Adm No>)"
    const summary = rec.summary;
    const match = summary.match(/Student ID Card — (.*?) \((.*?)\)/);
    const extractedName = match ? match[1] : "Student";
    const extractedNo = match ? match[2] : "FEES";

    // Double-check lookup against BOTH NEYO and legacy admission columns to match with 100% precision
    const student = await db.student.findFirst({
      where: {
        tenantId: rec.tenantId,
        OR: [
          { admissionNo: extractedNo },
          { legacyAdmissionNo: extractedNo }
        ]
      }
    });

    const studentName = student ? `${student.firstName} ${student.lastName}` : extractedName;
    const finalAdmissionNo = student ? student.admissionNo : extractedNo;

    // Initiate the STK Push transaction with M-Pesa
    const result = await initiateStkPush(rec.tenantId, {
      amount: input.amount,
      phone,
      accountRef: finalAdmissionNo.slice(0, 20),
      description: `Fees for ${studentName}`.slice(0, 60),
    });

    return ok({
      success: true,
      message: "M-Pesa STK push initiated!",
      checkoutRequestId: result.checkoutRequestId,
    });
  } catch (err) {
    return handleError(err);
  }
}
