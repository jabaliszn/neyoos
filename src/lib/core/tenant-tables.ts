/**
 * Registry of which Prisma models are directly tenant-owned (carry `tenantId`).
 * `tenantDb()` uses this to auto-scope reads and stamp writes.
 *
 * As future features add tenant-owned models (Student, Invoice, AttendanceRecord,
 * ...), ADD THEM HERE so isolation is enforced automatically.
 *
 * NOT listed (intentionally):
 *  - Tenant: the root table itself.
 *  - Session/Credential/RecoveryCode/TotpChallenge: scoped via userId -> User.
 *  - OtpCode/MagicLink/WebAuthnChallenge: pre-authentication (no tenant yet).
 *  - CalendarFeedToken (M.3): the public webcal:// feed route looks this up
 *    with NO session at all (a phone's Calendar app polls it unauthenticated,
 *    like OtpCode/MagicLink) — queried directly via `db`, never `tenantDb()`.
 *  - BundiImportUnlockCode (M.5): minted by NEYO Ops (no tenant context at
 *    creation for company-wide codes) and redeemed by CODE lookup, not by
 *    tenant — queried directly via `db`, same reasoning as API keys/webhooks.
 */
export const TENANT_OWNED_MODELS = [
  "user",
  "idSequence",
  "auditLog",
  "tenantModule",
  "subscription",
  "usageCounter",
  "paymentCredential",
  "payment",
  "notification",
  "webPushSubscription",
  "notificationTemplate",
  "conversation",
  "message",
  "messageAcknowledgement",
  "messageDeliveryReport",
  "intercomCall",
  "storedFile",
  "documentVerification",
  "qrScanEvent", // N.2 — QR hardware scan audit trail + duplicate-scan guard
  "apiKey",
  "webhookSubscription",
  "webhookDelivery",
  // NOTE: "apiUsageLog" (Part X — Developer Center 2.0) is DELIBERATELY NOT
  // tenant-owned — a genuinely failed/unauthenticated real API request has
  // no resolved tenant at all (tenantId: null), same "no single active
  // tenant" reasoning as schoolQuoteRequest/storageOptimizerRun above —
  // queried directly via the raw `db` client, never tenantDb().
  "calendarEvent",
  "visitorLog",
  "admissionInquiry",
  "phoneMessage",
  "schoolClass",
  "student",
  "guardian",
  "studentGuardian",
  "studentDocument",
  "studentRequirement",
  "studentImport",
  "studentCustomField", // M.4 — school-defined extra import fields per student
  "bundiFieldTemplate", // M.5 — school-described register field mapping
  "bundiImportSession", // M.5 — Bundi handwritten import sessions (cost/usage tracked)
  "studentTransfer",
  "attendanceRecord",
  "principalDelegationTask",
  "promotionRun",
  "classGroupingRule",
  "teacherWorkloadRule",
  "teacherContinuityAssignment",
  "teacherTransferImpact",
  "admissionApplication",
  "staffAttendance",
  "department",
  "subject",
  "academicTerm",
  "curriculum",
  "educationLevel",
  "gradeBand",
  "learningArea",
  "timetableSlot",
  "dutyRosterEntry",
  "lessonPlan",
  "lessonObservation",
  "lessonResource",
  "homework",
  "classNote",
  "homeworkSubmission",
  "quiz",
  "quizQuestion",
  "quizAttempt",
  "forumThread",
  "forumPost",
  "bulkMessage",
  "teacherCommsApprovalRequest",
  "libraryBook",
  "bookIssue",
  "hostel",
  "hostelRoom",
  "hostelAllocation",
  "hostelAttendance",
  "transportRoute",
  "driver",
  "vehicle",
  "gpsBusLocation",
  "cctvCamera",
  "hardwareDeviceConnection",
  "vehicleMaintenance",
  "fuelLog",
  "transportAssignment",
  "transportShift", // T.8 — per-route real shifts (morning/afternoon, own vehicle/driver/capacity)
  "transportRouteChangeRequest", // T.8 — real parent-initiated route/shift change requests
  "substituteAssignment", // T.12 — real date-scoped substitute-teacher coverage overlays for approved leave
  "store",
  "stockItem",
  "stockBatch",
  "stockMovement",
  "asset",
  "mealPlanEntry",
  "mealCard",
  "uniformOrder",
  "uniformSize", // B.25 per-size uniform stock
  "assetMaintenance", // B.25 asset service/repair log
  "supplier", // B.25 supplier records
  "supplierContract", // B.25 supply contracts w/ expiry
  "purchaseRequest", // B.25 procurement
  "purchaseQuote",
  "purchaseOrder",
  "expenseCategory", // B.25 expenses
  "costCenter",
  "expense",
  "disciplineIncident",
  "suspension",
  "counselingNote",
  "studentMedical",
  "clinicVisit",
  "medicationPlan",
  "medicationDose",
  "printJob",
  "printApprovalRequest",
  "cafeteriaTable",
  "cafeteriaQueueEntry",
  "gatePass",
  "pickupPerson",
  "altPickupAuthorization",
  "ownerApprovalRequest",
  "panicAlert",
  // NOTE: PlatformFlag is deliberately NOT here — it is NEYO-company global.
  "exam",
  "examResult",
  "examReleaseApprovalRequest",
  "assessmentType",
  "assessmentPlan",
  "assessmentRecord",
  "assessmentEvidence",
  "competencyGroup",
  "competency",
  "competencyEvidence",
  "rubric",
  "rubricLevel",
  "skillsPassportEntry",
  "portfolioItem",
  "learnerJourneyPin",
  "cbcStrand",
  "cbcAssessment",
  "feeStructure",
  "invoice",
  "staffSalary",
  "payrollRun",
  "staffProfile",
  "leaveRequest",
  "jobPosting",
  "appraisal",
  "disciplinaryRecord",
  "trainingRecord",
  "termPulse", // G.15 Term Trends Pulse (weekly leadership digest)
  "savedView", // G.8 Saved filters / saved views per list
  "teacherSubject",
  "classSubjectNeed",
  "timetableConfig",
  "masterReportCard",
  "combinationGroup",
  "combinationGroupClass",
  "timetableConstraint",
  "teacherTimeOff",
  "timetableGenerationJob",
  "onlineClassSession",
  "onlineClassParticipant",
  "onlineClassSignal",
  "onlineClassQuestion",
  "learningVideo",
  "learningVideoSession",
  "classVoiceRoom",
  "classVoiceParticipant",
  "classVoiceSignal",
  "syllabusTopic",
  "examTimetableGeneratorRun",
  "examTimetableSlot",
  "examMaterialRecord",
  "promiseToPay",
  "reportCardDayCheckIn",
  "publicSiteSettings",
  "publicSiteLeader",
  "publicSiteTestimonial",
  "publicSiteGalleryImage",
  "publicSiteActivity",
  "newsPost",
  "smsMarginLedger", // M.2 SMS margin revenue ledger
  "referralCredit", // M.1 referral engine credit ledger
  "schoolActivity", // R.6 — School Activities/Trips ("Form 4 trip"-style optional fee tracker)
  "schoolActivityClass", // R.6 — which real classes an activity's roster is drawn from
  "activityParticipant", // R.6 — one real roster row per real student per activity
  "tenantPricingSnapshot", // Part V — Capacity-Based Pricing 2.0: real per-school price-calculation history
  // NOTE: "schoolQuoteRequest" is DELIBERATELY NOT tenant-owned — a quote
  // request can exist for a genuinely prospective school with NO real
  // tenantId yet (before they've ever signed up), so it is queried directly
  // via the raw `db` client (same pattern as PlatformSetting/PlatformFlag),
  // never via tenantDb()/withTenant(), which requires an active tenant.
  // NOTE: "storageOptimizerRun" (W.1) is ALSO DELIBERATELY NOT tenant-owned
  // — a real nightly Storage Intelligence Engine sweep runs CROSS-TENANT
  // (tenantId: null for a company-wide run) as well as being triggerable
  // per-school by NEYO Ops (a real tenantId in that case) — queried
  // directly via the raw `db` client for the same "no single active tenant
  // context" reason as schoolQuoteRequest above.
] as const;

export type TenantOwnedModel = (typeof TENANT_OWNED_MODELS)[number];

export function isTenantOwnedModel(model: string): model is TenantOwnedModel {
  return (TENANT_OWNED_MODELS as readonly string[]).includes(model);
}

/**
 * Models that support soft-delete (G.6). For these, tenantDb() auto-excludes
 * rows where deletedAt != null on reads, and turns delete/deleteMany into a
 * soft-delete (sets deletedAt). Add B.1 "student" here when it lands.
 */
export const SOFT_DELETE_MODELS = ["payment", "student"] as const;

export function isSoftDeleteModel(model: string): boolean {
  return (SOFT_DELETE_MODELS as readonly string[]).includes(model);
}
