/**
 * Shared API response helpers — one consistent JSON shape across all routes.
 * Success:  { ok: true, data }
 * Failure:  { ok: false, error: { code, message, fields? } }
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthServiceError } from "@/lib/services/auth.service";
import { AuthError } from "@/lib/core/session";
import { SlugError } from "@/lib/services/tenant.service";
import { ModuleError } from "@/lib/services/module.service";
import { BillingError } from "@/lib/services/billing.service";
import { PaymentError } from "@/lib/services/payment.service";
import { MessagingError } from "@/lib/services/messaging.service";
import { ContentModerationError } from "@/lib/services/content-moderation.service";
import { StorageError } from "@/lib/services/storage.service";
import { RecycleError } from "@/lib/services/recycle.service";
import { OnboardingError } from "@/lib/services/onboarding.service";
import { JobError } from "@/lib/jobs/jobs.service";
import { ApiKeyError } from "@/lib/services/api-key.service";
import { WebhookError } from "@/lib/services/webhook.service";
import { CalendarError } from "@/lib/services/calendar.service";
import { ReceptionError } from "@/lib/services/reception.service";
import { StudentError } from "@/lib/services/student.service";
import { ImportError } from "@/lib/services/student-import.service";
import { AttendanceError } from "@/lib/services/attendance.service";
import { PromotionError } from "@/lib/services/promotion.service";
import { AdmissionError } from "@/lib/services/admission.service";
import { EntranceExamPaperError } from "@/lib/services/entrance-exam.service";
import { StaffAttendanceError } from "@/lib/services/staff-attendance.service";
import { AcademicsError } from "@/lib/services/academics.service";
import { CurriculumError } from "@/lib/services/curriculum.service";
import { AssessmentError } from "@/lib/services/assessment.service";
import { CompetencyError } from "@/lib/services/competency.service";
import { ExamError } from "@/lib/services/exam.service";
import { CbcError } from "@/lib/services/cbc.service";
import { FinanceError } from "@/lib/services/finance.service";
import { PayrollError } from "@/lib/services/payroll.service";
import { HrError } from "@/lib/services/hr.service";
import { PortalError } from "@/lib/services/parent-portal.service";
import { TeacherPortalError } from "@/lib/services/teacher-portal.service";
import { LmsError } from "@/lib/services/lms.service";
import { CommsError } from "@/lib/services/comms.service";
import { LibraryError } from "@/lib/services/library.service";
import { ClassChatError } from "@/lib/services/class-chat.service";
import { ClassVoiceError } from "@/lib/services/class-voice.service";
import { HostelError } from "@/lib/services/hostel.service";
import { TransportError } from "@/lib/services/transport.service";
import { InventoryError } from "@/lib/services/inventory.service";
import { SupplierError } from "@/lib/services/supplier.service";
import { ProcurementError } from "@/lib/services/procurement.service";
import { ExpenseError } from "@/lib/services/expense.service";
import { FamilyError } from "@/lib/services/family.service";
import { MzaziError } from "@/lib/services/mzazi.service";
import { CafeteriaError } from "@/lib/services/cafeteria.service";
import { FlagError } from "@/lib/services/platform-flags.service";
import { AppearanceError } from "@/lib/services/platform-appearance.service";
import { UniformError } from "@/lib/services/uniform.service";
import { DisciplineError } from "@/lib/services/discipline.service";
import { ClinicError } from "@/lib/services/clinic.service";
import { PrintError } from "@/lib/services/print-queue.service";
import { PrintLimitError } from "@/lib/services/print-limits.service";
import { NavVisibilityError } from "@/lib/services/nav-visibility.service";
import { OwnerApprovalError } from "@/lib/services/owner-approval.service";
import { SecurityError } from "@/lib/services/security.service";
import { PublicSiteError } from "@/lib/services/public-site.service";
import { FounderOpsError } from "@/lib/services/founder-ops.service";
import { StaffImportError } from "@/lib/services/staff-import.service";
import { SyllabusError } from "@/lib/services/syllabus.service";
import { ExamTimetableError } from "@/lib/services/exam-timetable.service";
import { ExamMaterialError } from "@/lib/services/exam-material.service";
import { PromiseError } from "@/lib/services/promise-to-pay.service";
import { LearningVideoError } from "@/lib/services/learning-video.service";
import { HardwareRegistryError } from "@/lib/services/hardware-registry.service";
import { DutyRosterError } from "@/lib/services/duty-roster.service";
import { DelegationError } from "@/lib/services/delegation.service";
import { IntercomError } from "@/lib/services/intercom.service";
import { OnlineClassError } from "@/lib/services/online-class.service";
import { RubricError } from "@/lib/services/rubric.service";
import { SkillsPassportError } from "@/lib/services/skills-passport.service";
import { PortfolioError } from "@/lib/services/portfolio.service";
import { LearnerJourneyError } from "@/lib/services/learner-journey.service";
import { TenantIsolationError } from "@/lib/core/tenant-db";
import { captureError } from "@/lib/observability/capture";
import { RateLimitError } from "@/lib/security/rate-limit";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string>
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(fields ? { fields } : {}) } },
    { status }
  );
}

/** Turn any thrown error into the right HTTP response. */
export function handleError(err: unknown) {
  // Zod validation failures -> 422 with per-field messages.
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "form";
      if (!fields[key]) fields[key] = issue.message;
    }
    return fail("VALIDATION_ERROR", "Please check the form.", 422, fields);
  }

  // Auth service domain errors -> meaningful status codes.
  if (err instanceof AuthServiceError) {
    const statusByCode: Record<string, number> = {
      RATE_LIMITED: 429,
      NO_PENDING_CODE: 400,
      CODE_EXPIRED: 400,
      TOO_MANY_ATTEMPTS: 429,
      INVALID_CODE: 400,
      USER_INACTIVE: 403,
      INVALID_CREDENTIALS: 401,
    };
    return fail(err.code, err.message, statusByCode[err.code] ?? 400);
  }

  // Tenant slug problems -> 409/422 with a friendly message.
  if (err instanceof SlugError) {
    return fail(err.reason, err.message, err.reason === "TAKEN" ? 409 : 422);
  }

  // Module toggle problems.
  if (err instanceof ModuleError) {
    return fail(err.reason, err.message, err.reason === "MODULE_LOCKED" ? 409 : 400);
  }

  // Billing problems.
  if (err instanceof BillingError) {
    return fail(err.code, err.message, err.code === "UNKNOWN_PLAN" ? 404 : 400);
  }

  // Payment routing problems.
  if (err instanceof PaymentError) {
    const status =
      err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : 400;
    return fail(err.code, err.message, status);
  }

  // Shared content moderation problems.
  if (err instanceof ContentModerationError) {
    return fail(err.code, err.message, 422);
  }

  // Messaging problems.
  if (err instanceof MessagingError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "CONTENT_MODERATED"
        ? 422
        : 403;
    return fail(err.code, err.message, status);
  }

  // File storage problems.
  if (err instanceof StorageError) {
    const status =
      err.code === "NOT_FOUND" ? 404 : err.code === "TOO_LARGE" ? 413 : 415;
    return fail(err.code, err.message, status);
  }

  // Recycle bin problems.
  if (err instanceof RecycleError) {
    return fail(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 400);
  }

  // Onboarding problems.
  if (err instanceof OnboardingError) {
    return fail(err.code, err.message, 409);
  }

  // Background job problems.
  if (err instanceof JobError) {
    return fail(err.code, err.message, 400);
  }

  // API key problems (A.16).
  if (err instanceof ApiKeyError) {
    return fail(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 400);
  }

  // Webhook subscription problems (A.16).
  if (err instanceof WebhookError) {
    return fail(err.code, err.message, 404);
  }

  // Calendar problems (A.17).
  if (err instanceof CalendarError) {
    return fail(err.code, err.message, 404);
  }

  // Reception problems (A.18).
  if (err instanceof ReceptionError) {
    return fail(err.code, err.message, err.code === "DUPLICATE" ? 409 : 404);
  }

  // Student problems (B.1).
  if (err instanceof StudentError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : 403;
    return fail(err.code, err.message, status);
  }

  // Bulk import problems (B.1) — all user-fixable -> 422.
  if (err instanceof ImportError) {
    return fail(err.code, err.message, 422);
  }

  // Attendance problems (B.3).
  if (err instanceof AttendanceError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // Promotion / reshuffle problems (G.16).
  if (err instanceof PromotionError) {
    const status = err.code === "NOT_FOUND" ? 404 : 422;
    return fail(err.code, err.message, status);
  }

  // Admissions problems (B.2).
  if (err instanceof AdmissionError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Admissions entrance exam paper vault (I.11).
  if (err instanceof EntranceExamPaperError) {
    const status = err.code === "FORBIDDEN" ? 403 : 404;
    return fail(err.code, err.message, status);
  }

  // Staff clock in/out (B.3).
  if (err instanceof StaffAttendanceError) {
    return fail(err.code, err.message, 422);
  }

  // Academics (B.4).
  if (err instanceof AcademicsError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // Part J.2 curriculum engine.
  if (err instanceof CurriculumError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "DUPLICATE" ? 409 :
      err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // Part J.3 flexible assessment engine.
  if (err instanceof AssessmentError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "DUPLICATE" ? 409 :
      err.code === "FORBIDDEN" ? 403 :
      err.code === "STATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Part J.4 competency framework.
  if (err instanceof CompetencyError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "DUPLICATE" ? 409 :
      err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // Exams (B.5).
  if (err instanceof ExamError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // CBC (B.6).
  if (err instanceof CbcError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : 403;
    return fail(err.code, err.message, status);
  }

  // Finance (B.7).
  if (err instanceof FinanceError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Payroll (B.8).
  if (err instanceof PayrollError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // HR (B.9).
  if (err instanceof HrError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // I.6 Principal delegation tasks.
  if (err instanceof DelegationError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // Parent portal (B.10).
  if (err instanceof PortalError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // Teacher portal (B.12).
  if (err instanceof TeacherPortalError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // LMS (B.13).
  if (err instanceof LmsError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 :
      err.code === "ALREADY_DONE" || err.code === "CLOSED" || err.code === "LOCKED" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Communication (B.14).
  if (err instanceof CommsError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "QUOTA" ? 402 :
      err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // Library (B.15).
  if (err instanceof LibraryError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "DUPLICATE" || err.code === "ALREADY_RETURNED" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Class group chat (G.19).
  if (err instanceof ClassChatError) {
    return fail(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 403);
  }

  // I.9 class-group disappearing voice rooms.
  if (err instanceof ClassVoiceError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 :
      err.code === "STATE" || err.code === "EXPIRED" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Hostel (B.16).
  if (err instanceof HostelError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "DUPLICATE" || err.code === "ALREADY" || err.code === "FULL" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Transport (B.17).
  if (err instanceof TransportError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "DUPLICATE" || err.code === "ALREADY" || err.code === "FULL" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Inventory (B.18).
  if (err instanceof InventoryError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "DUPLICATE" ? 409 :
      err.code === "INSUFFICIENT" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Suppliers (B.25).
  if (err instanceof SupplierError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Procurement (B.25).
  if (err instanceof ProcurementError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 :
      err.code === "STATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  if (err instanceof ExpenseError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 :
      err.code === "DUPLICATE" ? 409 :
      err.code === "STATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  if (err instanceof FamilyError) {
    return fail(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 422);
  }

  if (err instanceof MzaziError) {
    return fail(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 422);
  }

  // Platform flags (G.22).
  if (err instanceof FlagError) {
    return fail(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 403);
  }

  // Platform appearance (G.33 2.0).
  if (err instanceof AppearanceError) {
    return fail(err.code, err.message, 422);
  }

  // Uniform catalogue (G.24).
  if (err instanceof UniformError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "ALREADY" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Discipline (B.20).
  if (err instanceof DisciplineError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 :
      err.code === "ALREADY" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Clinic (B.21).
  if (err instanceof ClinicError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "ALREADY" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Print queue (G.31).
  if (err instanceof PrintError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 409;
    return fail(err.code, err.message, status);
  }

  // H.2 Role-Based Settings & Module Visibility.
  if (err instanceof NavVisibilityError) {
    return fail(err.code, err.message, err.code === "FORBIDDEN" ? 403 : 422);
  }

  // H.2 Multi-Owner joint approvals.
  if (err instanceof OwnerApprovalError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : err.code === "SELF" ? 403 : 409;
    return fail(err.code, err.message, status);
  }

  // H.2 Customized Printing Limits.
  if (err instanceof PrintLimitError) {
    const status =
      err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : err.code === "LIMIT_REACHED" ? 429 : 422;
    return fail(err.code, err.message, status);
  }

  // Security (B.22).
  if (err instanceof SecurityError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : err.code === "ALREADY" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // Cafeteria (B.19).
  if (err instanceof CafeteriaError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "DUPLICATE" || err.code === "ALREADY" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // G.11 public school landing site.
  if (err instanceof PublicSiteError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // F.1 NEYO founder operations.
  if (err instanceof FounderOpsError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "DUPLICATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // H.3/I.93 staff import validation.
  if (err instanceof StaffImportError) {
    return fail(err.code, err.message, 422);
  }

  // I.97 syllabus coverage.
  if (err instanceof SyllabusError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // I.28 dedicated exam timetable.
  if (err instanceof ExamTimetableError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "CONFLICT" || err.code === "DUPLICATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // I.21 exam applications/material records.
  if (err instanceof ExamMaterialError) {
    return fail(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 422);
  }

  // G.28/I.24 promise-to-pay automation.
  if (err instanceof PromiseError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : err.code === "QUOTA" ? 402 : 422;
    return fail(err.code, err.message, status);
  }

  // I.27 YouTube learning integration.
  if (err instanceof LearningVideoError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "EXTERNAL_UNAVAILABLE" ? 503 : 422;
    return fail(err.code, err.message, status);
  }

  // I.47 hardware connection registry.
  if (err instanceof HardwareRegistryError) {
    return fail(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 422);
  }

  // I.78 teacher duty roster.
  if (err instanceof DutyRosterError) {
    return fail(err.code, err.message, err.code === "NOT_FOUND" ? 404 : 422);
  }

  // I.89 online live classes.
  if (err instanceof OnlineClassError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // I.69/I.95 Intercom call signalling.
  if (err instanceof IntercomError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 :
      err.code === "OFFLINE" || err.code === "BUSY" || err.code === "STATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // J.5 Rubrics & Evidence.
  if (err instanceof RubricError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 :
      err.code === "DUPLICATE" ? 409 : 422;
    return fail(err.code, err.message, status);
  }

  // J.6 Skills Passport.
  if (err instanceof SkillsPassportError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // J.7 Student Portfolio System.
  if (err instanceof PortfolioError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 :
      err.code === "TOO_LARGE" ? 413 : 422;
    return fail(err.code, err.message, status);
  }

  // J.8 Learning Journey Timeline.
  if (err instanceof LearnerJourneyError) {
    const status =
      err.code === "NOT_FOUND" ? 404 :
      err.code === "FORBIDDEN" ? 403 : 422;
    return fail(err.code, err.message, status);
  }

  // Rate limiting (A.14) -> 429.
  if (err instanceof RateLimitError) {
    return fail("RATE_LIMITED", err.message, 429);
  }

  // Cross-tenant access attempt -> 403 (should never reach a normal user).
  if (err instanceof TenantIsolationError) {
    return fail("FORBIDDEN", "You do not have access to this resource.", 403);
  }

  // Session/permission guard errors.
  if (err instanceof AuthError) {
    return fail(err.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", err.message, err.status);
  }

  // Unexpected error: capture for observability (Sentry seam) + log.
  captureError(err, { scope: "api" });
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}
