/**
 * N.3 — Dynamic Newsletter Printing.
 * POST { studentIds, title, body, personalized?, format?, signOffLabel? }
 *   -> application/pdf attachment.
 * Permission: student.view + comms.send (this sends a school communication,
 * not just a data export).
 *
 * REPLACES the old client-side window.print() HTML generator with a real
 * server-rendered PDF (see src/lib/documents/newsletter-pdf.tsx for the two
 * real bug fixes this closes: hardcoded cut-lines shown even in 1-up mode,
 * and a fixed-height content box that never collapsed blank space for short
 * newsletters).
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { canViewStudent, StudentError } from "@/lib/services/student.service";
import { printNewsletterSchema } from "@/lib/validations/newsletter";
import { renderNewsletterPdf, type NewsletterCardData } from "@/lib/documents/newsletter-pdf";

export const dynamic = "force-dynamic";

function substitute(template: string, name: string, admissionNo: string): string {
  return template
    .replace(/\{\{student_name\}\}/g, name)
    .replace(/\{\{admission_no\}\}/g, admissionNo);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.view", "comms.send");
    const input = printNewsletterSchema.parse(await req.json().catch(() => ({})));

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });

    const cards: NewsletterCardData[] = [];
    for (const id of input.studentIds) {
      if (!(await canViewStudent(user, id))) continue;
      const student = await db.student.findFirst({ where: { id, tenantId: user.tenantId } });
      if (!student) continue;

      const name = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
      const bodyText = input.personalized
        ? substitute(input.body, name, student.admissionNo)
        : substitute(input.body, "Parent/Guardian", "Student");
      const recipientLabel = input.personalized
        ? `${name} · Adm ${student.admissionNo}`
        : "To the Parent/Guardian of a NEYO-registered learner";

      cards.push({ recipientLabel, bodyText });
    }

    if (cards.length === 0) {
      throw new StudentError("NOT_FOUND", "No accessible students found.");
    }

    const pdf = await renderNewsletterPdf(
      {
        schoolName: tenant.name,
        motto: tenant.motto,
        county: tenant.county,
        addressLine: tenant.addressLine,
        brandPrimary: tenant.brandPrimary || "#1c2740",
        logoUrl: tenant.logoUrl,
        title: input.title,
        signOffLabel: input.signOffLabel,
      },
      cards,
      { format: input.format }
    );

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "students.newsletter_printed",
        entityType: "student",
        entityId: "bulk",
        metadata: JSON.stringify({ count: cards.length, format: input.format, personalized: input.personalized }),
      },
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Newsletter-${cards.length}-${input.format}.pdf"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
