/**
 * Part V — NEYO Capacity-Based Pricing System 2.0 (founder-confirmed pivot,
 * 2026-07-06). The real "demo → quote → accept → self-serve live" flow
 * (V.6). Founder's own confirmed answer: self-serve automatic activation
 * once a quotation is accepted, PLUS a real, optional, non-blocking offer
 * of human onboarding assistance (data import, staff training, a guide
 * into the NEYO systems) — never a blocker to going live.
 */
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import {
  type CreateQuoteRequestInput,
  type SendFormalQuoteInput,
} from "@/lib/validations/pricing-engine";
import { getPricingEngineConfig, quotePriceForCounts, estimateParentCountForSchool } from "@/lib/services/pricing-engine.service";

export class SchoolQuoteError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "STATE", message: string) {
    super(message);
    this.name = "SchoolQuoteError";
  }
}

/** A "typical school this size" real fallback used when a prospect
 * genuinely doesn't know their exact numbers yet (V.6's honest "estimate
 * for me" option) — a real, sensible starting assumption, not a guess
 * presented as precise. */
const TYPICAL_STUDENT_COUNT = 300;
const TYPICAL_STAFF_RATIO = 1 / 15; // ~1 staff member per 15 students, a common real KE ratio
const TYPICAL_PARENT_RATIO = 1.3; // most learners have 1+ guardian on file, some share one across siblings

function typicalCountsFor(studentCount?: number): { studentCount: number; staffCount: number; parentCount: number } {
  const s = studentCount && studentCount > 0 ? studentCount : TYPICAL_STUDENT_COUNT;
  return {
    studentCount: s,
    staffCount: Math.max(3, Math.round(s * TYPICAL_STAFF_RATIO)),
    parentCount: Math.max(2, Math.round(s * TYPICAL_PARENT_RATIO)),
  };
}

/**
 * A real, instant, honest price for a prospective school — the founder's
 * own explicit requirement: "so that they know the amount of money they
 * would pay," with zero waiting on a human for this first number.
 */
export async function instantQuote(input: {
  studentCount?: number;
  staffCount?: number;
  parentCount?: number;
  requestedEstimate: boolean;
}) {
  const config = await getPricingEngineConfig();
  // A school only ever enters/sees its real student + staff counts (V.0's
  // "just all parents either live or dormant" answer is an internal NEYO
  // Ops pricing input, never a school-facing question). When a real parent
  // count isn't explicitly supplied (the normal case from the public quote
  // page / onboarding wizard, which only ask for students + staff), parent
  // count is silently estimated from the real student count via the same
  // typical-ratio fallback used for the "estimate for me" path — the
  // school never sees this number or is asked for it.
  const counts = input.requestedEstimate
    ? typicalCountsFor(input.studentCount)
    : {
        studentCount: input.studentCount ?? 0,
        staffCount: input.staffCount ?? 0,
        parentCount: input.parentCount ?? estimateParentCountForSchool(input.studentCount ?? 0),
      };
  const result = quotePriceForCounts(counts.studentCount, counts.staffCount, counts.parentCount, config);
  return {
    studentCount: counts.studentCount,
    staffCount: counts.staffCount,
    // Parent count is a real, silent pricing input — never surfaced to a
    // school-facing caller. Ops-facing callers get it via listSchoolsWithPricing()/
    // getPricingHistoryForTenant() (real TenantPricingSnapshot rows), never here.
    ...result,
    usedEstimate: input.requestedEstimate,
  };
}

/** Create a real quote-request row — a genuinely prospective school may not
 * have a real Tenant yet at all. */
export async function createQuoteRequest(input: CreateQuoteRequestInput) {
  const instant = await instantQuote({
    studentCount: input.declaredStudentCount,
    staffCount: input.declaredStaffCount,
    parentCount: input.declaredParentCount,
    requestedEstimate: input.requestedEstimate,
  });

  const request = await db.schoolQuoteRequest.create({
    data: {
      schoolName: input.schoolName,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      declaredStudentCount: input.declaredStudentCount ?? null,
      declaredStaffCount: input.declaredStaffCount ?? null,
      declaredParentCount: input.declaredParentCount ?? null,
      requestedEstimate: input.requestedEstimate,
      instantQuotedPriceKes: instant.monthlyPriceKes,
      formalQuoteRequested: input.formalQuoteRequested,
      onboardingAssistanceRequested: input.onboardingAssistanceRequested,
      onboardingAssistanceNote: input.onboardingAssistanceNote ?? null,
      status: "REQUESTED",
    },
  });

  // Best-effort: notify NEYO Ops a new (possibly formal) quote request came
  // in, reusing the real, existing notification cascade — never a new
  // notification system.
  try {
    const { notify } = await import("@/lib/services/notification.service");
    const opsUsers = await db.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true, tenantId: true } });
    for (const u of opsUsers) {
      await notify({
        tenantId: u.tenantId,
        recipientId: u.id,
        title: `New quote request — ${input.schoolName}`,
        body: `${input.contactName} requested a quote (instant estimate: KES ${instant.monthlyPriceKes}/month).${input.formalQuoteRequested ? " A formal quotation was requested." : ""}`,
        category: "billing",
        href: "/founder",
      });
    }
  } catch {
    // best-effort only — never block the real quote request itself
  }

  return { request, instant };
}

export async function listQuoteRequests() {
  return db.schoolQuoteRequest.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getQuoteRequest(id: string) {
  const request = await db.schoolQuoteRequest.findUnique({ where: { id } });
  if (!request) throw new SchoolQuoteError("NOT_FOUND", "Quote request not found.");
  return request;
}

/** NEYO Ops reviews and sends a real, human-confirmed formal quotation —
 * may adjust the price for a real, justified reason (always audit-logged). */
export async function sendFormalQuote(user: SessionUser, input: SendFormalQuoteInput) {
  const request = await getQuoteRequest(input.requestId);
  if (request.status !== "REQUESTED") {
    throw new SchoolQuoteError("STATE", `This request is already ${request.status.toLowerCase()}, not awaiting a quote.`);
  }
  const updated = await db.schoolQuoteRequest.update({
    where: { id: input.requestId },
    data: {
      finalQuotedPriceKes: input.finalQuotedPriceKes,
      quotedById: user.id,
      quotedByName: user.fullName,
      quotedAt: new Date(),
      status: "QUOTED",
    },
  });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "platform.formal_quote_sent",
      entityType: "SchoolQuoteRequest",
      entityId: request.id,
      metadata: JSON.stringify({ schoolName: request.schoolName, finalQuotedPriceKes: input.finalQuotedPriceKes, note: input.note ?? null }),
    },
  });
  return updated;
}

/** The real, self-serve "accept & go live" moment (V.6, founder-confirmed:
 * "option 2" — no NEYO Ops manual gate blocking activation). Marks the real
 * quote request accepted; the actual account creation happens via the
 * existing, real `signupSchool()` — this function only records the real
 * acceptance event and hands back the price to seed the new school's first
 * `TenantPricingSnapshot` with. */
export async function acceptQuote(id: string) {
  const request = await getQuoteRequest(id);
  if (!["REQUESTED", "QUOTED"].includes(request.status)) {
    throw new SchoolQuoteError("STATE", `This request is already ${request.status.toLowerCase()}.`);
  }
  return db.schoolQuoteRequest.update({
    where: { id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
}

/** Called once the accepted school has genuinely gone live via
 * `signupSchool()` — links the real new tenant back to its quote request
 * for a complete real audit trail. */
export async function markQuoteRequestLive(id: string, tenantId: string) {
  return db.schoolQuoteRequest.update({
    where: { id },
    data: { status: "LIVE", tenantId },
  });
}

/** NEYO Ops marks the real, optional onboarding-assistance follow-up done. */
export async function markOnboardingAssistanceDone(user: SessionUser, id: string) {
  const request = await getQuoteRequest(id);
  const updated = await db.schoolQuoteRequest.update({
    where: { id },
    data: { onboardingAssistanceDoneAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "platform.onboarding_assistance_completed",
      entityType: "SchoolQuoteRequest",
      entityId: request.id,
      metadata: JSON.stringify({ schoolName: request.schoolName }),
    },
  });
  return updated;
}
