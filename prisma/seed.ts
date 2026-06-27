/**
 * NEYO seed — one real Kenyan school + a realistic staff list across roles.
 * Real Kenyan names & normalized +254 phones (Principle 4: never "John Doe").
 * Idempotent: safe to run repeatedly.  Run:  npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import { hash as argonHash } from "@node-rs/argon2";
import { normalizeKePhone } from "../src/lib/validations/auth";
import { initialiseModules } from "../src/lib/services/module.service";
import { ensureTenantDek } from "../src/lib/services/encryption.service";
import { subscribeToPlan } from "../src/lib/services/billing.service";
import { recordUsage } from "../src/lib/services/limits.service";
import { nextTenantId, generateNeyoLoginId } from "../src/lib/services/identity.service";

const db = new PrismaClient();

/** First Monday on/after July 1 of the given year, as YYYY-MM-DD (for the weekly briefing seed). */
function nextMondayIso(year: number): string {
  const d = new Date(Date.UTC(year, 6, 1)); // July 1
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); // 1 = Monday
  return d.toISOString().slice(0, 10);
}

// Dev password for ALL seeded staff so email+password login is testable.
// Change/remove for production seeds.
const DEV_PASSWORD = "Karibu2026!";

// Helper: assert a phone normalizes, so a typo here fails loudly at seed time.
function phone(input: string): string {
  const n = normalizeKePhone(input);
  if (!n) throw new Error(`Seed phone is not a valid KE number: ${input}`);
  return n;
}

// The school (tenant). Slug "karibu-high" drives the ID prefix KH (A.4).
const TENANT = {
  name: "Karibu High School",
  slug: "karibu-high",
  county: "Kiambu",
  phone: phone("0712 345 678"),
  email: "office@karibuhigh.ac.ke",
  schoolType: "DAY_AND_BOARDING", // G.21 — Karibu has boarders + day scholars
  uniformSupplierName: "Mama Wanjiku Tailors", // G.24
  uniformSupplierPhone: "+254722334455",
};

// Staff across roles. neyoLoginId follows KH-U-00000N (two-ID system, A.4).
const STAFF: Array<{
  neyoLoginId: string;
  fullName: string;
  phone: string;
  email: string;
  role: string;
}> = [
  {
    neyoLoginId: "KHU1",
    fullName: "Wanjiru Kamau",
    phone: phone("0712 345 678"),
    email: "principal@karibuhigh.ac.ke",
    role: "PRINCIPAL",
  },
  {
    neyoLoginId: "KHU2",
    fullName: "Achieng Mary",
    phone: phone("0733 221 100"),
    email: "bursar@karibuhigh.ac.ke",
    role: "BURSAR",
  },
  {
    neyoLoginId: "KHU3",
    fullName: "Otieno Brian",
    phone: phone("0720 998 877"),
    email: "deputy@karibuhigh.ac.ke",
    role: "DEPUTY_PRINCIPAL",
  },
  {
    neyoLoginId: "KHU4",
    fullName: "Njoroge Peter",
    phone: phone("0711 456 789"),
    email: "p.njoroge@karibuhigh.ac.ke",
    role: "TEACHER",
  },
  {
    neyoLoginId: "KHU5",
    fullName: "Chebet Faith",
    phone: phone("0758 112 233"),
    email: "f.chebet@karibuhigh.ac.ke",
    role: "CLASS_TEACHER",
  },
  {
    neyoLoginId: "KHU6",
    fullName: "Mwangi Susan",
    phone: phone("0729 334 455"),
    email: "frontoffice@karibuhigh.ac.ke",
    role: "RECEPTIONIST",
  },
  {
    neyoLoginId: "KHU7",
    fullName: "Hassan Abdille",
    phone: phone("0701 667 788"),
    email: "accounts@karibuhigh.ac.ke",
    role: "ACCOUNTANT",
  },
  {
    neyoLoginId: "KHU8",
    fullName: "Wambui Grace",
    phone: phone("0768 909 010"),
    email: "library@karibuhigh.ac.ke",
    role: "LIBRARIAN",
  },
  {
    neyoLoginId: "KHU9",
    fullName: "Barasa Wekesa",
    phone: phone("0792 445 566"),
    email: "hostel@karibuhigh.ac.ke",
    role: "HOSTEL_MASTER",
  },
];

async function main() {
  const tenant = await db.tenant.upsert({
    where: { slug: TENANT.slug },
    update: {
      name: TENANT.name,
      county: TENANT.county,
      phone: TENANT.phone,
      email: TENANT.email,
      schoolType: TENANT.schoolType, // G.21
      uniformSupplierName: TENANT.uniformSupplierName, // G.24
      uniformSupplierPhone: TENANT.uniformSupplierPhone,
    },
    create: TENANT,
  });

  const passwordHash = await argonHash(DEV_PASSWORD);

  for (const s of STAFF) {
    await db.user.upsert({
      where: { neyoLoginId: s.neyoLoginId },
      // Keep phones/roles/password in sync on re-run.
      update: {
        fullName: s.fullName,
        phone: s.phone,
        email: s.email,
        role: s.role,
        isActive: true,
        passwordHash,
      },
      create: { tenantId: tenant.id, passwordHash, ...s },
    });
  }

  // Keep the IdSequence counter ahead of the seeded users (A.4 atomic counter).
  await db.idSequence.upsert({
    where: { tenantId_entityType: { tenantId: tenant.id, entityType: "USER" } },
    update: { lastValue: STAFF.length },
    create: { tenantId: tenant.id, entityType: "USER", lastValue: STAFF.length },
  });

  console.log(`✓ Seeded "${tenant.name}" with ${STAFF.length} staff:`);
  for (const s of STAFF) {
    console.log(
      `   ${s.role.padEnd(18)} ${s.fullName.padEnd(16)} ${s.phone}  ${s.email}`
    );
  }
  // Modules: Karibu is a full boarding school -> enable everything we've built
  // (hostel, library, transport, LMS, inventory) so the demo shows it all.
  await initialiseModules(tenant.id);
  for (const mk of ["hostel", "library", "transport", "lms", "inventory", "cafeteria"]) {
    await db.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: mk } },
      update: { enabled: true },
      create: { tenantId: tenant.id, moduleKey: mk, enabled: true },
    });
  }

  console.log(`\n   All staff dev password: ${DEV_PASSWORD}`);

  // ---- A SECOND school, to prove tenant isolation (A.2) ----
  const tenant2 = await db.tenant.upsert({
    where: { slug: "uhuru-academy" },
    update: { name: "Uhuru Academy", county: "Nakuru" },
    create: {
      name: "Uhuru Academy",
      slug: "uhuru-academy",
      county: "Nakuru",
      phone: phone("0790 111 222"),
      email: "office@uhuruacademy.ac.ke",
    },
  });

  const tenant2Staff = [
    {
      neyoLoginId: "UA-U-000001",
      fullName: "Kiprono David",
      phone: phone("0790 111 222"),
      email: "principal@uhuruacademy.ac.ke",
      role: "PRINCIPAL",
    },
    {
      neyoLoginId: "UA-U-000002",
      fullName: "Atieno Linet",
      phone: phone("0723 444 555"),
      email: "bursar@uhuruacademy.ac.ke",
      role: "BURSAR",
    },
  ];

  for (const s of tenant2Staff) {
    await db.user.upsert({
      where: { neyoLoginId: s.neyoLoginId },
      update: { fullName: s.fullName, phone: s.phone, email: s.email, role: s.role, passwordHash },
      create: { tenantId: tenant2.id, passwordHash, ...s },
    });
  }
  // Uhuru is a day school -> defaults (Hostel/Transport/LMS off).
  await initialiseModules(tenant2.id);

  // A.2.7: ensure both schools have a per-tenant encryption key.
  await ensureTenantDek(tenant.id);
  await ensureTenantDek(tenant2.id);

  // A.2.9: a NEYO platform super-admin (belongs to the first tenant for storage,
  // but can impersonate across schools for support).
  await db.user.upsert({
    where: { neyoLoginId: "NEYO-ADMIN-001" },
    update: { fullName: "Njeri Support", role: "SUPER_ADMIN", passwordHash, isActive: true },
    create: {
      tenantId: tenant.id,
      neyoLoginId: "NEYO-ADMIN-001",
      fullName: "Njeri Support",
      phone: phone("0700 000 001"),
      email: "support@neyo.co.ke",
      role: "SUPER_ADMIN",
      passwordHash,
    },
  });
  console.log("✓ Seeded NEYO super-admin: support@neyo.co.ke (SUPER_ADMIN)");

  // ---- F.1 Internal NEYO Founder Operations -------------------------------
  // NEYO eats its own food: company operating rhythm lives inside NEYO, not in
  // scattered notes. These are company-level rows, not tenant-owned school data.
  const neyoAdmin = await db.user.findUniqueOrThrow({ where: { neyoLoginId: "NEYO-ADMIN-001" } });
  await db.neyoBuildLog.upsert({
    where: { dateKey: "2026-06-13" },
    update: {
      title: "G11 corrected and F1 Founder Operations started",
      shippedSummary: "Corrected the public school landing site into a DB-backed editable feature and started NEYO Founder Operations inside the product.",
      details: "Founder challenged whether G.11 was truly complete. We audited it honestly, rebuilt the public site with real content models, settings editor, public news detail pages, UX states, seed data and screenshots. Then we began F.1 so NEYO can run its own company rhythm inside NEYO.",
      screenshotRefs: JSON.stringify(["screenshots/137-g11-public-landing-final.png", "screenshots/140-f1-founder-ops-page.png"]),
      status: "PUBLISHED",
    },
    create: {
      dateKey: "2026-06-13",
      title: "G11 corrected and F1 Founder Operations started",
      shippedSummary: "Corrected the public school landing site into a DB-backed editable feature and started NEYO Founder Operations inside the product.",
      details: "Founder challenged whether G.11 was truly complete. We audited it honestly, rebuilt the public site with real content models, settings editor, public news detail pages, UX states, seed data and screenshots. Then we began F.1 so NEYO can run its own company rhythm inside NEYO.",
      screenshotRefs: JSON.stringify(["screenshots/137-g11-public-landing-final.png", "screenshots/140-f1-founder-ops-page.png"]),
      status: "PUBLISHED",
      createdById: neyoAdmin.id,
      createdByName: neyoAdmin.fullName,
    },
  });
  await db.neyoMetricSnapshot.upsert({
    where: { periodKey: "2026-W24" },
    update: {
      periodStart: "2026-06-08", periodEnd: "2026-06-14", revenueKes: 0, mrrKes: 0,
      payingSchools: 0, trialSchools: 2, activeSchools: 2, churnRiskSchools: 0, smsSpendKes: 1240,
      notes: "Founder validation week: product depth and trust before revenue. Karibu and Uhuru remain demo/dev schools.",
    },
    create: {
      periodKey: "2026-W24", periodStart: "2026-06-08", periodEnd: "2026-06-14", revenueKes: 0, mrrKes: 0,
      payingSchools: 0, trialSchools: 2, activeSchools: 2, churnRiskSchools: 0, smsSpendKes: 1240,
      notes: "Founder validation week: product depth and trust before revenue. Karibu and Uhuru remain demo/dev schools.",
      createdById: neyoAdmin.id, createdByName: neyoAdmin.fullName,
    },
  });
  const opsSeed = [
    { kind: "WEEKLY_METRICS", periodKey: "2026-W24", title: "Weekly founder metrics review", status: "DONE", scheduledFor: "2026-06-14", completedAt: new Date("2026-06-14T08:00:00.000Z"), summary: "Reviewed G.11 correction, G-block honesty and F.1 founder operations.", audience: "internal", decisionsJson: JSON.stringify(["Founder operations will live inside NEYO itself"]), actionItemsJson: JSON.stringify([{ task: "Prepare first investor update draft", owner: "Founder", dueOn: "2026-06-21", done: false }]) },
    { kind: "MONTHLY_ALL_HANDS", periodKey: "2026-06", title: "June all-hands: School OS completion", status: "PLANNED", scheduledFor: "2026-06-30", completedAt: null, summary: "Review School OS depth, launch readiness and support promises.", audience: "internal", decisionsJson: null, actionItemsJson: null },
    { kind: "QUARTERLY_AUDIT", periodKey: "2026-Q2", title: "Q2 product/security self-audit", status: "PLANNED", scheduledFor: "2026-06-28", completedAt: null, summary: "Check feature truthfulness, security hardening and deployment readiness.", audience: "internal", decisionsJson: null, actionItemsJson: null },
    { kind: "ANNUAL_PLANNING", periodKey: "2026", title: "2026 annual planning offsite", status: "PLANNED", scheduledFor: "2026-12-12", completedAt: null, summary: "Set NEYO school rollout, partnerships and impact goals.", audience: "founder", decisionsJson: null, actionItemsJson: null },
    { kind: "DEMO_DAY", periodKey: "2026-07", title: "Founder Demo Day", status: "PLANNED", scheduledFor: "2026-07-05", completedAt: null, summary: "Show School OS end-to-end with public landing, admissions, fees, reports and parent portal.", audience: "early schools", decisionsJson: null, actionItemsJson: null },
    { kind: "INVESTOR_UPDATE", periodKey: "2026-06", title: "June investor update", status: "PLANNED", scheduledFor: "2026-06-25", completedAt: null, summary: "Summarise build velocity, screenshots, launch readiness and next founder asks.", audience: "investors", decisionsJson: null, actionItemsJson: null },
    { kind: "BOARD_MEETING", periodKey: "2026-Q2", title: "Q2 board meeting pack", status: "PLANNED", scheduledFor: "2026-06-29", completedAt: null, summary: "Review product risk, Kenya go-to-market, security and operating cadence.", audience: "board", decisionsJson: null, actionItemsJson: null },
    { kind: "IMPACT_REPORT", periodKey: "2026", title: "2026 annual impact report", status: "PLANNED", scheduledFor: "2026-12-20", completedAt: null, summary: "Prepare schools supported, parent communication gains, fee transparency and education impact.", audience: "public", decisionsJson: null, actionItemsJson: null },
  ];
  for (const row of opsSeed) {
    await db.neyoFounderOpsEntry.upsert({
      where: { kind_periodKey: { kind: row.kind, periodKey: row.periodKey } },
      update: row,
      create: { ...row, createdById: neyoAdmin.id, createdByName: neyoAdmin.fullName },
    });
  }
  await db.neyoCustomerInterview.deleteMany({ where: { schoolName: { in: ["Karibu High School", "Uhuru Academy"] } } });
  await db.neyoCustomerInterview.createMany({ data: [
    { schoolName: "Karibu High School", contactName: "Wanjiru Kamau", contactRole: "Principal", phone: "+254712345678", county: "Kiambu", interviewDate: "2026-06-16", channel: "CALL", status: "SCHEDULED", followUp: "Ask about public landing page trust and parent portal onboarding.", createdById: neyoAdmin.id, createdByName: neyoAdmin.fullName },
    { schoolName: "Uhuru Academy", contactName: "Kiprono David", contactRole: "Principal", phone: "+254790111222", county: "Nakuru", interviewDate: "2026-06-18", channel: "VIDEO", status: "DONE", painPointsJson: JSON.stringify(["Needs fast setup before Term 3 admissions", "Parents ask for fee balances on feature phones"]), quotesJson: JSON.stringify(["If parents can confirm balances without coming to school, that saves us hours every Friday."]), opportunitiesJson: JSON.stringify(["Demo mode should be used in every sales call", "Mzazi Card is a strong wedge for low-fee schools"]), followUp: "Send public landing and Mzazi Card demo link.", createdById: neyoAdmin.id, createdByName: neyoAdmin.fullName },
  ] });
  console.log("✓ Seeded F.1: NEYO Founder Operations build log, metrics, cadence and customer interviews.");

  // A.5: put schools on plans + seed some usage so the billing page has data.
  const sysActor = { id: "seed", fullName: "Seed" };
  await subscribeToPlan(tenant.id, sysActor, "pro"); // Karibu = Pro
  await subscribeToPlan(tenant2.id, sysActor, "free_karibu"); // Uhuru = Free
  await recordUsage(tenant.id, "smsPerTerm", 1240);
  await recordUsage(tenant.id, "students", 312);
  await recordUsage(tenant.id, "staff", 28);
  console.log("✓ Seeded subscriptions: Karibu=Pro, Uhuru=Free Karibu");

  // A.7: a few in-app notifications for the Karibu principal so the bell shows data.
  const principal = await db.user.findUniqueOrThrow({ where: { neyoLoginId: "KHU1" } });
  await db.notification.deleteMany({ where: { recipientId: principal.id } });
  await db.notification.createMany({
    data: [
      {
        tenantId: tenant.id,
        recipientId: principal.id,
        title: "Fees received",
        body: "Achieng Mary recorded KES 12,000 from Wanjiku Njeri (Form 2 North).",
        category: "fees",
      },
      {
        tenantId: tenant.id,
        recipientId: principal.id,
        title: "Attendance taken",
        body: "Form 3 East register submitted: 38 present, 2 absent.",
        category: "attendance",
      },
      {
        tenantId: tenant.id,
        recipientId: principal.id,
        title: "Exam results published",
        body: "End of Term 1 results are ready for review.",
        category: "exam",
      },
    ],
  });
  console.log("✓ Seeded 3 notifications for Karibu principal");

  // A.8: a teacher<->bursar DM, a staff group, and an announcement.
  const { createConversation, sendMessage } = await import(
    "../src/lib/services/messaging.service"
  );
  const teacher = await db.user.findUniqueOrThrow({ where: { neyoLoginId: "KHU4" } }); // Njoroge Peter
  const bursarU = await db.user.findUniqueOrThrow({ where: { neyoLoginId: "KHU2" } }); // Achieng Mary
  const classTeacher = await db.user.findUniqueOrThrow({ where: { neyoLoginId: "KHU5" } }); // Chebet Faith

  await db.message.deleteMany({ where: { tenantId: tenant.id } });
  await db.conversation.deleteMany({ where: { tenantId: tenant.id } });

  const dm = await createConversation(
    tenant.id,
    { id: teacher.id, fullName: "Njoroge Peter", role: teacher.role as any, secondaryRole: teacher.secondaryRole as any },
    { type: "DIRECT", participantIds: [bursarU.id] }
  );
  await sendMessage(tenant.id, { id: teacher.id, fullName: "Njoroge Peter" }, {
    conversationId: dm.id,
    body: "Habari Madam, has Wanjiku Njeri's Term 2 fee been cleared?",
  });
  await sendMessage(tenant.id, { id: bursarU.id, fullName: "Achieng Mary" }, {
    conversationId: dm.id,
    body: "Yes, she paid KES 12,000 this morning via M-Pesa.",
  });

  const group = await createConversation(
    tenant.id,
    { id: principal.id, fullName: "Wanjiru Kamau", role: principal.role as any, secondaryRole: principal.secondaryRole as any },
    { type: "GROUP", title: "Form 2 Teachers", participantIds: [teacher.id, classTeacher.id] }
  );
  await sendMessage(tenant.id, { id: principal.id, fullName: "Wanjiru Kamau" }, {
    conversationId: group.id,
    body: "Please submit Form 2 CATs by Friday. Tap received after you read this.",
    requiresAck: true,
    urgentAfterHours: 24,
  });

  const ann = await createConversation(
    tenant.id,
    { id: principal.id, fullName: "Wanjiru Kamau", role: principal.role as any, secondaryRole: principal.secondaryRole as any },
    { type: "ANNOUNCEMENT", title: "Closing Day", participantIds: [teacher.id, bursarU.id, classTeacher.id] }
  );
  await sendMessage(tenant.id, { id: principal.id, fullName: "Wanjiru Kamau" }, {
    conversationId: ann.id,
    body: "School closes this Friday at 1:00 PM. Safe travels to all.",
  });
  console.log("✓ Seeded conversations: 1 DM, 1 group, 1 announcement");

  console.log(`✓ Seeded "${tenant2.name}" with ${tenant2Staff.length} staff (for isolation tests).`);

  // A.16: Public API & Webhooks — a sample, ready-to-use key + webhook for
  // Karibu High so the developer settings page shows real data and the
  // /api/v1/* endpoints are testable out of the box.
  // NOTE: this is a DEV-ONLY fixed token (so docs/tests can use it). In
  // production keys are random and shown once. Token below is documented in
  // CONTEXT-ANCHOR for testing.
  const DEV_API_TOKEN = "neyo_sk_devKaribuHighSampleToken000000000000000";
  const devKeyHash = createHash("sha256").update(DEV_API_TOKEN).digest("hex");
  await db.apiKey.deleteMany({ where: { tenantId: tenant.id } });
  await db.apiKey.create({
    data: {
      tenantId: tenant.id,
      name: "Sample SIS integration",
      keyPrefix: "neyo_sk_devK",
      keyHash: devKeyHash,
      scopes: JSON.stringify(["*"]),
    },
  });

  await db.webhookDelivery.deleteMany({ where: { tenantId: tenant.id } });
  await db.webhookSubscription.deleteMany({ where: { tenantId: tenant.id } });
  await db.webhookSubscription.create({
    data: {
      tenantId: tenant.id,
      url: "https://example.ac.ke/neyo/webhook",
      events: JSON.stringify(["payment.recorded", "payment.failed"]),
      signingSecret: "whsec_devKaribuHighSampleSigningSecret00",
      description: "Notify the bursar's finance system on payments",
      active: true,
    },
  });
  console.log(`✓ Seeded A.16: 1 API key + 1 webhook for Karibu High (dev token: ${DEV_API_TOKEN}).`);

  // A.17: Calendar — a few real Karibu High events on top of the KE holiday layer.
  const calYear = new Date().getFullYear();
  await db.calendarEvent.deleteMany({ where: { tenantId: tenant.id } });
  await db.calendarEvent.createMany({
    data: [
      {
        tenantId: tenant.id,
        title: "Form 2 Parents' Meeting",
        description: "Term progress review with class teachers in the School Hall.",
        date: `${calYear}-07-18`,
        startTime: "10:00",
        endTime: "12:00",
        location: "School Hall",
        type: "meeting",
        audienceRole: "PARENT",
        createdById: principal.id,
      },
      {
        tenantId: tenant.id,
        title: "Mid-term Break",
        description: "School closed for mid-term. Boarders to be collected by 10:00 AM.",
        date: `${calYear}-08-06`,
        endDate: `${calYear}-08-10`,
        type: "holiday",
        createdById: principal.id,
      },
      {
        tenantId: tenant.id,
        title: "Inter-house Sports Day",
        description: "Athletics and ball games at the school field. All students.",
        date: `${calYear}-09-12`,
        startTime: "08:00",
        endTime: "16:00",
        location: "School Field",
        type: "sports",
        createdById: principal.id,
      },
      {
        tenantId: tenant.id,
        title: "End of Term 2 Exams",
        description: "Form 1–4 end-of-term examinations.",
        date: `${calYear}-08-25`,
        endDate: `${calYear}-08-29`,
        type: "exam",
        createdById: principal.id,
      },
      {
        // B.25 recurring event — weekly Monday staff briefing (whole term).
        tenantId: tenant.id,
        title: "Staff Briefing",
        description: "Weekly Monday briefing in the staffroom before lessons.",
        date: nextMondayIso(calYear),
        startTime: "07:30",
        endTime: "08:00",
        location: "Staffroom",
        type: "meeting",
        audienceRole: "TEACHER",
        recurrence: "WEEKLY",
        recurUntil: `${calYear}-12-15`,
        createdById: principal.id,
      },
      {
        // B.25 recurring event — fees due the 5th of every month.
        tenantId: tenant.id,
        title: "Fees due reminder",
        description: "Monthly fee instalment due. Pay via the family portal (M-Pesa).",
        date: `${calYear}-07-05`,
        type: "deadline",
        audienceRole: "PARENT",
        recurrence: "MONTHLY",
        recurUntil: `${calYear}-12-05`,
        createdById: principal.id,
      },
    ],
  });
  console.log("✓ Seeded A.17/B.25: 6 calendar events (incl. 1 weekly + 1 monthly recurring).");

  // A.18: Receptionist Operations — seed a busy front-desk "today".
  const receptionist = await db.user.findFirst({
    where: { tenantId: tenant.id, role: "RECEPTIONIST" },
  });
  const bursarUser = await db.user.findFirst({
    where: { tenantId: tenant.id, role: "BURSAR" },
  });
  await db.visitorLog.deleteMany({ where: { tenantId: tenant.id } });
  await db.admissionInquiry.deleteMany({ where: { tenantId: tenant.id } });
  await db.phoneMessage.deleteMany({ where: { tenantId: tenant.id } });

  await db.visitorLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: "Otieno James",
        phone: "+254712334455",
        idNumber: "29887766",
        purpose: "Fees enquiry",
        host: "The Bursar",
        badgeNo: "V-001",
        createdById: receptionist?.id ?? null,
      },
      {
        tenantId: tenant.id,
        name: "Njeri Catherine",
        phone: "+254721998877",
        purpose: "Visiting Form 3 student",
        host: "Chebet Faith",
        badgeNo: "V-002",
        signedOutAt: new Date(),
        createdById: receptionist?.id ?? null,
      },
    ],
  });

  await db.admissionInquiry.create({
    data: {
      tenantId: tenant.id,
      parentName: "Wanjiru Mary",
      phone: "+254733112299",
      studentName: "Kamau Junior",
      gradeWanted: "Grade 4",
      curriculum: "CBC",
      notes: "Transferring from a school in Nakuru. Wants a boarding slot.",
      createdById: receptionist?.id ?? null,
    },
  });

  await db.payment.deleteMany({ where: { tenantId: tenant.id, mpesaRef: "CASH-SEED0001" } });
  await db.payment.create({
    data: {
      tenantId: tenant.id,
      provider: "cash",
      amount: 5000,
      phone: "+254712334455",
      accountRef: "KHS118",
      description: "Walk-in payment (front desk)",
      status: "PAID",
      mpesaRef: "CASH-SEED0001",
      paidAt: new Date(),
    },
  });

  if (bursarUser && receptionist) {
    const callConvo = await createConversation(
      tenant.id,
      { id: receptionist.id, fullName: "Mwangi Susan" },
      { type: "DIRECT", participantIds: [bursarUser.id] }
    );
    await db.phoneMessage.create({
      data: {
        tenantId: tenant.id,
        callerName: "Achieng Mary",
        callerPhone: "+254700445566",
        forUserId: bursarUser.id,
        forUserName: "Achieng Mary",
        message: "Please call back about the Form 2 trip balance.",
        conversationId: callConvo.id,
        createdById: receptionist.id,
      },
    });
  }
  console.log("✓ Seeded A.18: 2 visitors, 1 inquiry, 1 walk-in payment, 1 relayed call.");

  // G.9: School profile & branding + joining requirements for Karibu High.
  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      motto: "Elimu ni Mwanga — Knowledge is Light",
      logoUrl: "/brand/karibu-badge.svg", // I.20 — school badge shows top-left; NEYO mark lives in product surfaces/island
      vision: "To be a centre of excellence nurturing confident, responsible future leaders.",
      mission:
        "To provide holistic, learner-centred education that develops knowledge, character and skills for life.",
      about:
        "Karibu High School is a boarding secondary school in Kiambu County offering the 8-4-4 and CBC pathways with a strong focus on discipline, academics and co-curricular growth.",
      brandPrimary: "#1c2740",
      brandAccent: "#1f9d5f",
      addressLine: "P.O. Box 145-00900, Kiambu",
      siblingDiscountPct: 5, // G.12 — 5% off a sibling's fees for multi-child families
      socialLinks: JSON.stringify({
        website: "https://karibuhigh.ac.ke",
        facebook: "https://facebook.com/karibuhigh",
      }),
      joiningRequirements: JSON.stringify([
        { label: "School uniform (2 sets)", category: "uniform", quantity: "2", mandatory: true },
        { label: "Games kit & sports shoes", category: "uniform", quantity: "1", mandatory: true },
        { label: "Mattress (3x6) & beddings", category: "supplies", quantity: "1", mandatory: true },
        { label: "Exercise books (A4, 200pg)", category: "books", quantity: "12", mandatory: true },
        { label: "Mathematical set & calculator", category: "supplies", quantity: "1", mandatory: true },
        { label: "Birth certificate copy", category: "documents", mandatory: true },
        { label: "KCPE/KPSEA result slip", category: "documents", mandatory: true },
        { label: "Admission/boarding fee", category: "fees", mandatory: true },
      ]),
    },
  });
  console.log("✓ Seeded G.9: Karibu High school profile + 8 joining requirements.");

  // G.13: a non-secret M-Pesa Paybill so the Mzazi card shows a real shortcode.
  // (Secrets stay unset until the founder enters Daraja creds — A.6.)
  await db.paymentCredential.upsert({
    where: { tenantId: tenant.id },
    update: { shortcode: "522533" },
    create: { tenantId: tenant.id, provider: "mpesa_daraja", shortcode: "522533", environment: "sandbox", isActive: false },
  });
  console.log("✓ Seeded G.13: Karibu M-Pesa Paybill 522533 (for Mzazi cards).");

  // B.1: Classes, students, guardians + a PARENT login linked to a child
  // (demonstrates A.3.8/A.3.9 row-scoping). Idempotent: wipe then reseed.
  await db.studentRequirement.deleteMany({ where: { tenantId: tenant.id } });
  await db.studentGuardian.deleteMany({ where: { tenantId: tenant.id } });
  await db.studentDocument.deleteMany({ where: { tenantId: tenant.id } });
  await db.student.deleteMany({ where: { tenantId: tenant.id } });
  await db.guardian.deleteMany({ where: { tenantId: tenant.id } });
  // Student-bound rows MUST be reset together with students, otherwise reseeds
  // leave orphans pointing at deleted student ids (recurring gotcha — fixed for good).
  // G.13: clear stale Mzazi card verification codes (they key off student ids
  // that are reset here, so old codes would otherwise orphan across reseeds).
  await db.documentVerification.deleteMany({ where: { tenantId: tenant.id, docType: "mzazi_card" } });
  await db.examResult.deleteMany({ where: { tenantId: tenant.id } });
  await db.exam.deleteMany({ where: { tenantId: tenant.id } });
  await db.invoice.deleteMany({ where: { tenantId: tenant.id } });
  await db.feeStructure.deleteMany({ where: { tenantId: tenant.id } });
  await db.attendanceRecord.deleteMany({ where: { tenantId: tenant.id } });
  await db.cbcAssessment.deleteMany({ where: { tenantId: tenant.id } });
  await db.homeworkSubmission.deleteMany({ where: { tenantId: tenant.id } }); // B.13 — student-bound
  await db.quizAttempt.deleteMany({ where: { tenantId: tenant.id } }); // B.13 — student-bound
  await db.quizQuestion.deleteMany({ where: { tenantId: tenant.id } }); // B.13
  await db.quiz.deleteMany({ where: { tenantId: tenant.id } }); // B.13 — class-bound
  await db.bookIssue.deleteMany({ where: { tenantId: tenant.id } }); // B.15 — student-bound
  await db.libraryBook.deleteMany({ where: { tenantId: tenant.id } }); // B.15 — reseeded together w/ issues
  await db.hostelAttendance.deleteMany({ where: { tenantId: tenant.id } }); // B.16 — student-bound
  await db.hostelAllocation.deleteMany({ where: { tenantId: tenant.id } }); // B.16 — student-bound
  await db.hostelRoom.deleteMany({ where: { tenantId: tenant.id } }); // B.16
  await db.hostel.deleteMany({ where: { tenantId: tenant.id } }); // B.16 — reseeded together
  await db.transportAssignment.deleteMany({ where: { tenantId: tenant.id } }); // B.17 — student-bound
  await db.fuelLog.deleteMany({ where: { tenantId: tenant.id } }); // B.17
  await db.vehicleMaintenance.deleteMany({ where: { tenantId: tenant.id } }); // B.17
  await db.transportRoute.deleteMany({ where: { tenantId: tenant.id } }); // B.17
  await db.driver.deleteMany({ where: { tenantId: tenant.id } }); // B.17
  await db.vehicle.deleteMany({ where: { tenantId: tenant.id } }); // B.17 — reseeded together
  await db.stockMovement.deleteMany({ where: { tenantId: tenant.id } }); // B.18 — student refs
  await db.stockBatch.deleteMany({ where: { tenantId: tenant.id } }); // B.18
  await db.stockItem.deleteMany({ where: { tenantId: tenant.id } }); // B.18
  await db.store.deleteMany({ where: { tenantId: tenant.id } }); // B.18 — reseeded together
  await db.asset.deleteMany({ where: { tenantId: tenant.id } }); // B.18
  await db.mealCard.deleteMany({ where: { tenantId: tenant.id } }); // B.19 — student-bound
  await db.mealPlanEntry.deleteMany({ where: { tenantId: tenant.id } }); // B.19
  await db.uniformOrder.deleteMany({ where: { tenantId: tenant.id } }); // G.24 — student-bound
  await db.disciplineIncident.deleteMany({ where: { tenantId: tenant.id } }); // B.20 — student-bound
  await db.suspension.deleteMany({ where: { tenantId: tenant.id } }); // B.20
  await db.counselingNote.deleteMany({ where: { tenantId: tenant.id } }); // B.20
  await db.medicationDose.deleteMany({ where: { tenantId: tenant.id } }); // B.21
  await db.medicationPlan.deleteMany({ where: { tenantId: tenant.id } }); // B.21 — student-bound
  await db.clinicVisit.deleteMany({ where: { tenantId: tenant.id } }); // B.21 — student-bound
  await db.studentMedical.deleteMany({ where: { tenantId: tenant.id } }); // B.21 — student-bound
  await db.conversation.deleteMany({ where: { tenantId: tenant.id, classId: { not: null } } }); // G.19 — class-bound group chats
  await db.forumPost.deleteMany({ where: { tenantId: tenant.id } }); // B.13
  await db.forumThread.deleteMany({ where: { tenantId: tenant.id } }); // B.13 — class-bound
  await db.homework.deleteMany({ where: { tenantId: tenant.id } }); // B.12 — classIds change on reseed
  await db.classNote.deleteMany({ where: { tenantId: tenant.id } }); // B.12
  await db.entranceExamPaper.deleteMany({ where: { tenantId: tenant.id } }); // I.11 — class-bound admissions entrance papers
  await db.timetableSlot.deleteMany({ where: { tenantId: tenant.id } }); // class-bound: avoid orphan slots on reseed
  await db.lessonPlan.deleteMany({ where: { tenantId: tenant.id } }); // class-bound
  await db.schoolClass.deleteMany({ where: { tenantId: tenant.id } });
  await db.idSequence.deleteMany({ where: { tenantId: tenant.id, entityType: "STUDENT" } });
  await db.user.deleteMany({ where: { tenantId: tenant.id, role: { in: ["STUDENT", "PARENT"] } } });

  // Two classes (8-4-4 streams) — assign the CLASS_TEACHER (Chebet Faith) to one.
  const classTeacherUser = await db.user.findFirst({ where: { tenantId: tenant.id, role: "CLASS_TEACHER" } });
  const form2East = await db.schoolClass.create({
    data: { tenantId: tenant.id, level: "Form 2", stream: "East", curriculum: "8-4-4", classTeacherId: classTeacherUser?.id ?? null, capacity: 45 },
  });
  const form1West = await db.schoolClass.create({
    data: { tenantId: tenant.id, level: "Form 1", stream: "West", curriculum: "8-4-4", capacity: 45 },
  });

  // I.11 Admissions Entrance Exam Vault — real printable sample PDFs per exact class/stream.
  {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const samples = [
      { cls: form2East, title: "Form 2 East entrance interview paper", fileName: "form-2-east-entrance-interview.pdf", body: "Karibu High - Form 2 East Entrance Interview\\nMathematics, English and Kiswahili readiness" },
      { cls: form1West, title: "Form 1 West entrance interview paper", fileName: "form-1-west-entrance-interview.pdf", body: "Karibu High - Form 1 West Entrance Interview\\nKCPE transition readiness questions" },
    ];
    for (const sample of samples) {
      const key = `tenants/${tenant.id}/admissions/${sample.fileName}`;
      const dest = path.join(process.cwd(), ".uploads", key);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const pdfText = sample.body.replace(/\\n/g, ") Tj 0 -24 Td (");
      const pdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 140>>stream\nBT /F1 15 Tf 60 770 Td (${pdfText}) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`;
      await fs.writeFile(dest, pdf);
      await db.entranceExamPaper.create({
        data: {
          tenantId: tenant.id,
          classId: sample.cls.id,
          classLevel: sample.cls.level,
          classLabel: sample.cls.stream ? `${sample.cls.level} ${sample.cls.stream}` : sample.cls.level,
          title: sample.title,
          fileUrl: `/api/files/serve?key=${encodeURIComponent(key)}`,
          fileName: sample.fileName,
          hardcopyLocation: "Admissions office cabinet A / Entrance papers file",
          uploadedBy: "Admissions Office",
        },
      });
    }
  }
  console.log("✓ Seeded I.11: printable entrance interview papers for Form 2 East and Form 1 West.");

  await db.examMaterialRecord.deleteMany({ where: { tenantId: tenant.id, title: { contains: "KCSE candidate registration" } } });
  await db.examMaterialRecord.create({
    data: {
      tenantId: tenant.id,
      examName: `KCSE ${new Date().getFullYear()}`,
      materialType: "KNEC_REGISTRATION",
      title: "KCSE candidate registration and materials file",
      deadline: `${new Date().getFullYear()}-07-15`,
      status: "ASSEMBLING",
      checklistJson: JSON.stringify(["Candidate list", "Birth certificate copies", "Passport photos", "KNEC payment proof", "Subject entry confirmation"]),
      hardcopyLocation: "Exam office cabinet, Shelf A, KCSE registration file",
      notes: "Keep registration proof and assembled candidate exam materials in one traceable file.",
      createdById: principal.id,
      createdByName: principal.fullName,
    },
  });
  console.log("✓ Seeded I.21: KCSE exam application/materials record.");

  // Master joining requirements (from the G.9 profile) to copy onto each student.
  const masterReqs: Array<{ label: string; category: string; quantity?: string; mandatory: boolean }> = [
    { label: "School uniform (2 sets)", category: "uniform", quantity: "2", mandatory: true },
    { label: "Mattress (3x6) & beddings", category: "supplies", quantity: "1", mandatory: true },
    { label: "Exercise books (A4, 200pg)", category: "books", quantity: "12", mandatory: true },
    { label: "Birth certificate copy", category: "documents", mandatory: true },
  ];

  const studentSeed: Array<{
    first: string; middle?: string; last: string; gender: "M" | "F";
    classId: string; dob: string; guardian: { name: string; phone: string }; parentLogin?: boolean; studentLogin?: string;
  }> = [
    { first: "Achieng", middle: "Mary", last: "Otieno", gender: "F", classId: form2East.id, dob: "2010-03-14", guardian: { name: "Otieno Brian", phone: "0712223344" }, parentLogin: true, studentLogin: "achieng@karibuhigh.ac.ke" },
    { first: "Kamau", last: "Mwangi", gender: "M", classId: form2East.id, dob: "2010-07-02", guardian: { name: "Mwangi Susan", phone: "0721445566" } },
    { first: "Wanjiru", middle: "Grace", last: "Njoroge", gender: "F", classId: form1West.id, dob: "2011-01-20", guardian: { name: "Njoroge Peter", phone: "0733778899" } },
    { first: "Kiprono", last: "Cheruiyot", gender: "M", classId: form1West.id, dob: "2011-05-09", guardian: { name: "Chebet Faith", phone: "0700112233" } },
    { first: "Atieno", last: "Owino", gender: "F", classId: form2East.id, dob: "2010-11-30", guardian: { name: "Owino James", phone: "0745667788" } },
  ];

  let firstStudentId = "";
  let parentLoginId = "";
  for (const st of studentSeed) {
    const admissionNo = await nextTenantId(tenant.id, "STUDENT");
    const student = await db.student.create({
      data: {
        tenantId: tenant.id, admissionNo, firstName: st.first, middleName: st.middle ?? null,
        lastName: st.last, gender: st.gender, dateOfBirth: st.dob, classId: st.classId, status: "ACTIVE",
      },
    });
    if (!firstStudentId) firstStudentId = student.id;

    // Optional STUDENT login (B.11 shared family portal — achieng@karibuhigh.ac.ke).
    if (st.studentLogin) {
      const neyoLoginId = await generateNeyoLoginId();
      const pwHash = await argonHash(DEV_PASSWORD);
      const studentUser = await db.user.create({
        data: {
          tenantId: tenant.id, neyoLoginId,
          fullName: [st.first, st.middle, st.last].filter(Boolean).join(" "),
          phone: null, email: st.studentLogin,
          role: "STUDENT", isActive: true, passwordHash: pwHash,
        },
      });
      await db.student.update({ where: { id: student.id }, data: { userId: studentUser.id } });
    }

    // Guardian (+ optional PARENT login for the row-scoping demo).
    let guardianUserId: string | null = null;
    if (st.parentLogin) {
      const neyoLoginId = await generateNeyoLoginId();
      const pwHash = await argonHash(DEV_PASSWORD);
      const parentUser = await db.user.create({
        data: {
          tenantId: tenant.id, neyoLoginId, fullName: st.guardian.name,
          phone: normalizeKePhone(st.guardian.phone) ?? st.guardian.phone, email: "parent@karibuhigh.ac.ke",
          role: "PARENT", isActive: true, passwordHash: pwHash,
        },
      });
      guardianUserId = parentUser.id;
      parentLoginId = "parent@karibuhigh.ac.ke";
    }
    const guardian = await db.guardian.create({
      data: { tenantId: tenant.id, fullName: st.guardian.name, phone: normalizeKePhone(st.guardian.phone) ?? st.guardian.phone, userId: guardianUserId },
    });
    await db.studentGuardian.create({
      data: { tenantId: tenant.id, studentId: student.id, guardianId: guardian.id, relationship: "Parent", isPrimary: true },
    });

    // Per-student joining requirements (a couple already fulfilled on the first).
    await db.studentRequirement.createMany({
      data: masterReqs.map((m, i) => ({
        tenantId: tenant.id, studentId: student.id, label: m.label, category: m.category,
        quantity: m.quantity ?? null, mandatory: m.mandatory,
        fulfilled: student.id === firstStudentId && i < 2,
        fulfilledAt: student.id === firstStudentId && i < 2 ? new Date() : null,
      })),
    });
  }
  console.log(`✓ Seeded B.1: 2 classes, ${studentSeed.length} students, guardians + 1 PARENT login (${parentLoginId} / ${DEV_PASSWORD}).`);

  // --- G.12 Sibling Intelligence: make Achieng + Atieno share a guardian (a real family) ---
  {
    const achiengG12 = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Achieng" }, include: { guardians: true } });
    const atienoG12 = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Atieno" }, include: { guardians: true } });
    if (achiengG12 && atienoG12 && achiengG12.guardians[0]) {
      const sharedGuardianId = achiengG12.guardians[0].guardianId;
      const already = await db.studentGuardian.findFirst({ where: { studentId: atienoG12.id, guardianId: sharedGuardianId } });
      if (!already) {
        await db.studentGuardian.create({
          data: { tenantId: tenant.id, studentId: atienoG12.id, guardianId: sharedGuardianId, relationship: "Parent", isPrimary: false },
        });
        console.log("✓ Seeded G.12: Achieng + Atieno linked as siblings (shared guardian Otieno Brian).");
      }
    }
  }

  // --- B.3: Attendance — yesterday's registers (today left unmarked for demo) ---
  const yesterday = new Date(Date.now() + 3 * 3600_000 - 24 * 3600_000).toISOString().slice(0, 10);
  const seededStudents = await db.student.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE", classId: { not: null } },
    select: { id: true, classId: true, lastName: true },
  });
  const deputy = await db.user.findFirst({ where: { tenantId: tenant.id, role: "DEPUTY_PRINCIPAL" } });
  const marker = deputy ?? (await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "PRINCIPAL" } }));
  for (const [i, st] of seededStudents.entries()) {
    // One absentee (the 2nd student) and one late (the 4th) for realism.
    const status = i === 1 ? "A" : i === 3 ? "L" : "P";
    await db.attendanceRecord.upsert({
      where: { tenantId_studentId_date: { tenantId: tenant.id, studentId: st.id, date: yesterday } },
      create: {
        tenantId: tenant.id, studentId: st.id, classId: st.classId, date: yesterday,
        status, note: status === "L" ? "Matatu delay" : null,
        markedById: marker.id, markedByName: marker.fullName,
      },
      update: {},
    });
  }
  console.log(`✓ Seeded B.3: ${seededStudents.length} attendance records for ${yesterday} (1 absent, 1 late).`);

  // --- B.2: Admissions — a small live pipeline ---
  await db.admissionApplication.deleteMany({ where: { tenantId: tenant.id, applicationNo: { startsWith: "KHADMSEED" } } });
  const admSeed = [
    { no: "KHADMSEED1", first: "Baraka", last: "Mutiso", gender: "M", grade: "Form 1", cur: "8-4-4", gName: "Esther Mutiso", gPhone: "+254724556677", status: "APPLIED", source: "online" },
    { no: "KHADMSEED2", first: "Zawadi", last: "Nyambura", gender: "F", grade: "Grade 4", cur: "CBC", gName: "James Nyambura", gPhone: "+254735667788", status: "REVIEW", source: "walk_in" },
    { no: "KHADMSEED3", first: "Collins", last: "Omondi", gender: "M", grade: "Form 2", cur: "8-4-4", gName: "Akinyi Omondi", gPhone: "+254746778899", status: "OFFER", source: "online", depositReq: 5000, depositPaid: 2000 },
  ];
  for (const a of admSeed) {
    await db.admissionApplication.create({
      data: {
        tenantId: tenant.id, applicationNo: a.no, status: a.status,
        firstName: a.first, lastName: a.last, gender: a.gender,
        gradeWanted: a.grade, curriculum: a.cur,
        guardianName: a.gName, guardianPhone: a.gPhone, source: a.source,
        depositRequiredKes: a.depositReq ?? 0, depositPaidKes: a.depositPaid ?? 0,
      },
    });
  }
  console.log("✓ Seeded B.2: 3 admission applications (applied/review/offer w/ part-deposit).");

  // --- B.3 analytics: 10 weekdays of history + 1 anomaly day + staff clocks ---
  const dayMs = 24 * 3600_000;
  let seededDays = 0;
  for (let back = 2; seededDays < 10; back++) {
    const d = new Date(Date.now() + 3 * 3600_000 - back * dayMs);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const ymd = d.toISOString().slice(0, 10);
    seededDays++;
    const anomalyDay = seededDays === 3; // one bad day for Form 2 East
    for (const [i, st] of seededStudents.entries()) {
      // base pattern: student 2 absent sometimes, others mostly present
      let status = "P";
      if (i === 1 && seededDays % 3 === 0) status = "A"; // Kamau: chronic-ish
      if (i === 3 && seededDays % 4 === 0) status = "L";
      if (anomalyDay && i <= 2) status = "A"; // anomaly: most of Form 2 East out
      await db.attendanceRecord.upsert({
        where: { tenantId_studentId_date: { tenantId: tenant.id, studentId: st.id, date: ymd } },
        create: {
          tenantId: tenant.id, studentId: st.id, classId: st.classId, date: ymd,
          status, markedById: marker.id, markedByName: marker.fullName,
        },
        update: {},
      });
    }
  }
  // staff clock-ins for today (principal + deputy + receptionist in; teacher not yet)
  const clockToday = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const clockStaff = await db.user.findMany({
    where: { tenantId: tenant.id, role: { in: ["PRINCIPAL", "DEPUTY_PRINCIPAL", "RECEPTIONIST"] } },
  });
  for (const s of clockStaff) {
    await db.staffAttendance.upsert({
      where: { tenantId_userId_date: { tenantId: tenant.id, userId: s.id, date: clockToday } },
      create: {
        tenantId: tenant.id, userId: s.id, userName: s.fullName, role: s.role,
        date: clockToday, clockInAt: new Date(new Date().setHours(4, 45 + Math.floor(Math.random() * 30))),
      },
      update: {},
    });
  }
  console.log(`✓ Seeded B.3+: ${seededDays} weekdays of attendance history (1 anomaly day) + ${clockStaff.length} staff clock-ins.`);

  // --- B.4: Academics — departments, 8-4-4 subjects, terms, sample timetable ---
  const deptNames = ["Languages", "Sciences", "Humanities", "Mathematics", "Co-curricular Activities"];
  const deptMap = new Map<string, string>();
  for (const dn of deptNames) {
    const d = await db.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: dn } },
      create: { tenantId: tenant.id, name: dn },
      update: {},
    });
    deptMap.set(dn, d.id);
  }
  const subjectSeed: [string, string, string][] = [
    ["English", "ENG", "Languages"], ["Kiswahili", "KIS", "Languages"],
    ["Mathematics", "MAT", "Mathematics"], ["Biology", "BIO", "Sciences"],
    ["Chemistry", "CHE", "Sciences"], ["Physics", "PHY", "Sciences"],
    ["History & Government", "HIS", "Humanities"], ["Geography", "GEO", "Humanities"],
    ["CRE", "CRE", "Humanities"],
    ["Games & Clubs", "GAC", "Co-curricular Activities"],
  ];
  const subjMap = new Map<string, string>();
  for (const [name, code, dept] of subjectSeed) {
    const s = await db.subject.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      create: { tenantId: tenant.id, name, code, curriculum: "8-4-4", departmentId: deptMap.get(dept) ?? null },
      update: {},
    });
    subjMap.set(code, s.id);
  }
  const thisYear = new Date().getFullYear();
  const termDates: [number, string, string, boolean][] = [
    [1, `${thisYear}-01-05`, `${thisYear}-04-04`, false],
    [2, `${thisYear}-04-28`, `${thisYear}-08-01`, true],
    [3, `${thisYear}-08-25`, `${thisYear}-10-24`, false],
  ];
  for (const [term, start, end, current] of termDates) {
    await db.academicTerm.upsert({
      where: { tenantId_year_term: { tenantId: tenant.id, year: thisYear, term } },
      create: { tenantId: tenant.id, year: thisYear, term, startDate: start, endDate: end, current },
      update: { current },
    });
  }
  // Sample timetable: Form 2 East Monday-Tuesday mornings (teacher = Chebet for MAT)
  const f2eClass = await db.schoolClass.findFirst({ where: { tenantId: tenant.id, level: "Form 2", stream: "East" } });
  const chebetUser = await db.user.findFirst({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } });
  if (f2eClass) {
    const ttSeed: [number, number, string, string | null][] = [
      [1, 1, "MAT", chebetUser?.id ?? null], [1, 2, "ENG", null], [1, 3, "BIO", null], [1, 4, "KIS", null],
      [2, 1, "CHE", null], [2, 2, "MAT", chebetUser?.id ?? null], [2, 3, "GEO", null], [2, 4, "PHY", null],
    ];
    for (const [day, period, code, teacherId] of ttSeed) {
      await db.timetableSlot.upsert({
        where: { tenantId_classId_dayOfWeek_period_slotType: { tenantId: tenant.id, classId: f2eClass.id, dayOfWeek: day, period, slotType: "ACADEMIC" } },
        create: { tenantId: tenant.id, classId: f2eClass.id, subjectId: subjMap.get(code)!, teacherId, dayOfWeek: day, period, slotType: "ACADEMIC" },
        update: {},
      });
    }
    // One lesson plan from Chebet
    if (chebetUser) {
      const existing = await db.lessonPlan.findFirst({ where: { tenantId: tenant.id, teacherId: chebetUser.id } });
      if (!existing) {
        await db.lessonPlan.create({
          data: {
            tenantId: tenant.id, teacherId: chebetUser.id, teacherName: chebetUser.fullName,
            subjectId: subjMap.get("MAT")!, classId: f2eClass.id,
            date: new Date(Date.now() + 3 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10),
            topic: "Quadratic equations — completing the square",
            objectives: "Learners can solve x² + bx + c = 0 by completing the square.",
            activities: "Worked examples on the board; pair exercise from KLB Bk 3 p.47.",
          },
        });
      }
    }
  }
  console.log("✓ Seeded B.4: 5 departments, 10 subjects (8-4-4 + co-curricular), 3 terms (T2 current), 8 timetable slots + 1 lesson plan.");

  // --- B.12: Teacher portal — homework + class notes for Form 2 East ---
  if (f2eClass && chebetUser) {
    const inSevenDays = new Date(Date.now() + 3 * 3600_000 + 7 * 24 * 3600_000).toISOString().slice(0, 10);
    const hwExists = await db.homework.findFirst({ where: { tenantId: tenant.id, classId: f2eClass.id } });
    if (!hwExists) {
      await db.homework.create({
        data: {
          tenantId: tenant.id, classId: f2eClass.id, subjectId: subjMap.get("MAT")!,
          teacherId: chebetUser.id, teacherName: chebetUser.fullName,
          title: "KLB Bk 3 — Quadratics Exercise 4.2, Q1-8",
          instructions: "Show all working. Complete the square for Q5-8. Hand in Thursday morning before assembly.",
          dueDate: inSevenDays,
        },
      });
    }
    const noteExists = await db.classNote.findFirst({ where: { tenantId: tenant.id, classId: f2eClass.id } });
    if (!noteExists) {
      // Write a tiny real PDF into dev storage so the portal download works.
      const { promises: fs } = await import("fs");
      const path = await import("path");
      const key = `tenants/${tenant.id}/notes/seed-quadratics-notes.pdf`;
      const dest = path.join(process.cwd(), ".uploads", key);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 96>>stream
BT /F1 16 Tf 60 770 Td (Karibu High - Quadratics Revision Notes) Tj 0 -24 Td (Form 2 East - Mathematics) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
      await fs.writeFile(dest, pdf);
      await db.classNote.create({
        data: {
          tenantId: tenant.id, classId: f2eClass.id, subjectId: subjMap.get("MAT")!,
          teacherId: chebetUser.id, teacherName: chebetUser.fullName,
          title: "Quadratics revision notes",
          description: "Completing the square + factorisation, with worked KCSE past-paper questions.",
          fileUrl: `/api/files/serve?key=${encodeURIComponent(key)}`,
          fileName: "quadratics-revision-notes.pdf",
        },
      });
    }
    console.log("✓ Seeded B.12: 1 homework + 1 class note (Form 2 East, by Chebet Faith).");

    // --- B.13: LMS — published quiz + 1 attempt, 1 submission, forum thread ---
    let quiz = await db.quiz.findFirst({ where: { tenantId: tenant.id, classId: f2eClass.id } });
    if (!quiz) {
      quiz = await db.quiz.create({
        data: {
          tenantId: tenant.id, classId: f2eClass.id, subjectId: subjMap.get("MAT")!,
          teacherId: chebetUser.id, teacherName: chebetUser.fullName,
          title: "Quadratics check-in quiz", instructions: "One attempt. No calculators needed.",
          published: true,
        },
      });
      const qs: [string, string[], number][] = [
        ["Solve x² − 5x + 6 = 0", ["x = 2 or x = 3", "x = −2 or x = −3", "x = 1 or x = 6", "No real roots"], 0],
        ["What is the discriminant of x² + 4x + 4?", ["0", "16", "−16", "8"], 0],
        ["Factorise x² − 9", ["(x−3)(x+3)", "(x−9)(x+1)", "(x−3)²", "(x+3)²"], 0],
      ];
      for (let i = 0; i < qs.length; i++) {
        await db.quizQuestion.create({
          data: { tenantId: tenant.id, quizId: quiz.id, order: i + 1, prompt: qs[i][0], options: JSON.stringify(qs[i][1]), correctIndex: qs[i][2] },
        });
      }
      // Kamau took it (2/3) — so the results table is never empty.
      const kamau = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Kamau" } });
      if (kamau) {
        await db.quizAttempt.create({
          data: { tenantId: tenant.id, quizId: quiz.id, studentId: kamau.id, answers: JSON.stringify([0, 0, 2]), score: 2, total: 3, scorePct: 67 },
        });
      }
    }
    // One hand-in on the seeded homework (Atieno, ungraded) so the grading tab is populated.
    const seedHw = await db.homework.findFirst({ where: { tenantId: tenant.id, classId: f2eClass.id } });
    const atieno = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Atieno" } });
    if (seedHw && atieno) {
      const existingSub = await db.homeworkSubmission.findFirst({ where: { tenantId: tenant.id, homeworkId: seedHw.id, studentId: atieno.id } });
      if (!existingSub) {
        await db.homeworkSubmission.create({
          data: {
            tenantId: tenant.id, homeworkId: seedHw.id, studentId: atieno.id,
            text: "Q1-6 done in my exercise book; Q7 niliweza nusu — nitauliza darasani.", late: false,
          },
        });
      }
    }
    // Forum thread + a reply.
    let thread = await db.forumThread.findFirst({ where: { tenantId: tenant.id, classId: f2eClass.id } });
    if (!thread) {
      thread = await db.forumThread.create({
        data: {
          tenantId: tenant.id, classId: f2eClass.id,
          title: "Revision plan for CAT 2", body: "Tutarudia quadratics na simultaneous equations wiki hii. Leteni maswali yenu hapa.",
          authorId: chebetUser.id, authorName: chebetUser.fullName, authorRole: "CLASS_TEACHER",
        },
      });
      const achiengStudent = await db.user.findFirst({ where: { tenantId: tenant.id, email: "achieng@karibuhigh.ac.ke" } });
      if (achiengStudent) {
        await db.forumPost.create({
          data: {
            tenantId: tenant.id, threadId: thread.id,
            body: "Madam, tafadhali tufanye mfano mmoja wa completing the square kesho.",
            authorId: achiengStudent.id, authorName: achiengStudent.fullName, authorRole: "STUDENT",
          },
        });
      }
    }
    console.log("✓ Seeded B.13: published quiz (1 attempt 67%), 1 homework hand-in, forum thread + reply.");

  await db.learningVideo.upsert({
    where: { tenantId_youtubeId: { tenantId: tenant.id, youtubeId: "aircAruvnKk" } },
    create: {
      tenantId: tenant.id,
      youtubeId: "aircAruvnKk",
      title: "Neural networks — classroom explainer",
      description: "Teacher-approved educational video saved in NEYO for in-class viewing.",
      channelTitle: "3Blue1Brown",
      thumbnailUrl: "https://img.youtube.com/vi/aircAruvnKk/hqdefault.jpg",
      savedById: principal.id,
      savedByName: principal.fullName,
    },
    update: {},
  });
  console.log("✓ Seeded I.27: one saved classroom learning video.");

    // --- B.15: library catalog + issues (one overdue → live fine) ---
    const librarian = await db.user.findFirst({ where: { tenantId: tenant.id, role: "LIBRARIAN" } });
    const existingBook = await db.libraryBook.findFirst({ where: { tenantId: tenant.id } });
    if (!existingBook && librarian) {
      const bookSeed: [string, string, string, string, string, number][] = [
        // title, author, isbn, category, shelf, copies
        ["The River and the Source", "Margaret Ogola", "9789966882574", "Set book", "A1", 12],
        ["Blossoms of the Savannah", "Henry Ole Kulet", "9789966564184", "Set book", "A1", 10],
        ["KLB Secondary Mathematics Bk 3", "KLB", "9789966489193", "Course book", "B2", 20],
        ["Kamusi ya Kiswahili Sanifu", "TUKI", "9780195732177", "Reference", "C1", 4],
      ];
      const bookIds: string[] = [];
      for (const [title, author, isbn, category, shelf, copies] of bookSeed) {
        const b = await db.libraryBook.create({
          data: { tenantId: tenant.id, title, author, isbn, category, shelf, copiesTotal: copies },
        });
        bookIds.push(b.id);
      }
      // Issues: Achieng has a set book OUT (due in 7 days), Kamau OVERDUE by ~10 days.
      const achiengSt = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Achieng" } });
      const kamauSt = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Kamau" } });
      const in7 = new Date(Date.now() + 3 * 3600_000 + 7 * 24 * 3600_000).toISOString().slice(0, 10);
      const tenDaysAgo = new Date(Date.now() + 3 * 3600_000 - 10 * 24 * 3600_000).toISOString().slice(0, 10);
      if (achiengSt) {
        await db.bookIssue.create({
          data: {
            tenantId: tenant.id, bookId: bookIds[0], studentId: achiengSt.id,
            studentName: "Achieng Mary Otieno", admissionNo: achiengSt.admissionNo,
            issuedById: librarian.id, issuedByName: librarian.fullName, dueDate: in7,
          },
        });
      }
      if (kamauSt) {
        await db.bookIssue.create({
          data: {
            tenantId: tenant.id, bookId: bookIds[1], studentId: kamauSt.id,
            studentName: "Kamau Mwangi", admissionNo: kamauSt.admissionNo,
            issuedById: librarian.id, issuedByName: librarian.fullName, dueDate: tenDaysAgo,
          },
        });
      }
      console.log("✓ Seeded B.15: 4 books (46 copies), 2 issues (1 overdue ~10 days → live fine).");
    }

    // --- B.16: hostels, rooms, beds + last-night curfew ---
    const hostelMaster = await db.user.findFirst({ where: { tenantId: tenant.id, role: "HOSTEL_MASTER" } });
    const existingHostel = await db.hostel.findFirst({ where: { tenantId: tenant.id } });
    if (!existingHostel && hostelMaster) {
      const simba = await db.hostel.create({
        data: { tenantId: tenant.id, name: "Simba House", gender: "BOYS", masterId: hostelMaster.id, boardingFeeKes: 15000 },
      });
      const chui = await db.hostel.create({
        data: { tenantId: tenant.id, name: "Chui House", gender: "GIRLS", masterId: null, boardingFeeKes: 15000 },
      });
      const sr1 = await db.hostelRoom.create({ data: { tenantId: tenant.id, hostelId: simba.id, name: "Room 1", capacity: 4 } });
      await db.hostelRoom.create({ data: { tenantId: tenant.id, hostelId: simba.id, name: "Room 2", capacity: 4 } });
      const cr1 = await db.hostelRoom.create({ data: { tenantId: tenant.id, hostelId: chui.id, name: "Room 1", capacity: 6 } });

      // Boarders: Kamau + Kiprono (boys, Simba R1), Achieng + Atieno (girls, Chui R1).
      const boarderSeed: [string, string, number][] = [
        ["Kamau", sr1.id, 1], ["Kiprono", sr1.id, 2],
        ["Achieng", cr1.id, 1], ["Atieno", cr1.id, 2],
      ];
      const boarderIds: { id: string; name: string }[] = [];
      for (const [first, roomId, bedNo] of boarderSeed) {
        const st = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: first } });
        if (!st) continue;
        await db.hostelAllocation.create({
          data: {
            tenantId: tenant.id, roomId, studentId: st.id,
            studentName: [st.firstName, st.middleName, st.lastName].filter(Boolean).join(" "),
            admissionNo: st.admissionNo, bedNo,
          },
        });
        boarderIds.push({ id: st.id, name: st.firstName });
      }

      // Last night's curfew: everyone IN except Kiprono on authorised LEAVE.
      const lastNight = new Date(Date.now() + 3 * 3600_000 - 24 * 3600_000).toISOString().slice(0, 10);
      for (const b of boarderIds) {
        const st = await db.student.findFirst({ where: { id: b.id } });
        if (!st) continue;
        const hostelName = b.name === "Kamau" || b.name === "Kiprono" ? "Simba House" : "Chui House";
        await db.hostelAttendance.create({
          data: {
            tenantId: tenant.id, studentId: b.id,
            studentName: [st.firstName, st.middleName, st.lastName].filter(Boolean).join(" "),
            hostelName, date: lastNight,
            status: b.name === "Kiprono" ? "LEAVE" : "IN",
            note: b.name === "Kiprono" ? "Family function — letter from parent on file" : null,
            markedById: hostelMaster.id, markedByName: hostelMaster.fullName,
          },
        });
      }
      console.log("✓ Seeded B.16: 2 hostels (Simba/Chui), 3 rooms, 4 boarders, last-night curfew (1 LEAVE).");
    }

    // --- B.17: transport — vehicles, drivers, routes, riders, fuel + maintenance ---
    const existingVehicle = await db.vehicle.findFirst({ where: { tenantId: tenant.id } });
    if (!existingVehicle) {
      const in20 = new Date(Date.now() + 3 * 3600_000 + 20 * 24 * 3600_000).toISOString().slice(0, 10); // expiring soon → alert demo
      const in300 = new Date(Date.now() + 3 * 3600_000 + 300 * 24 * 3600_000).toISOString().slice(0, 10);
      const bus1 = await db.vehicle.create({
        data: { tenantId: tenant.id, regNo: "KCB 123A", make: "Toyota Coaster", capacity: 33, insuranceExpiry: in20, inspectionExpiry: in300 },
      });
      const bus2 = await db.vehicle.create({
        data: { tenantId: tenant.id, regNo: "KDA 456B", make: "Isuzu NQR", capacity: 51, insuranceExpiry: in300, inspectionExpiry: in300 },
      });
      const omondi = await db.driver.create({
        data: { tenantId: tenant.id, fullName: "Omondi Peter", phone: "+254723556677", licenseNo: "DL-0098231", licenseExpiry: in300 },
      });
      const wafula = await db.driver.create({
        data: { tenantId: tenant.id, fullName: "Wafula John", phone: "+254734667788", licenseNo: "DL-0045112", licenseExpiry: in20 },
      });
      const routeA = await db.transportRoute.create({
        data: {
          tenantId: tenant.id, name: "Route A — Kasarani",
          stops: JSON.stringify(["Mwiki", "Kasarani Mwiki Rd", "Seasons", "School"]),
          termFeeKes: 9000, vehicleId: bus1.id, driverId: omondi.id,
        },
      });
      await db.transportRoute.create({
        data: {
          tenantId: tenant.id, name: "Route B — Githurai",
          stops: JSON.stringify(["Githurai 45", "Kahawa West", "School"]),
          termFeeKes: 7500, vehicleId: bus2.id, driverId: wafula.id,
        },
      });
      // Riders: Wanjiru + Kiprono on Route A.
      for (const [first, stop] of [["Wanjiru", "Mwiki"], ["Kiprono", "Seasons"]] as const) {
        const st = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: first } });
        if (!st) continue;
        await db.transportAssignment.create({
          data: {
            tenantId: tenant.id, routeId: routeA.id, studentId: st.id,
            studentName: [st.firstName, st.middleName, st.lastName].filter(Boolean).join(" "),
            admissionNo: st.admissionNo, pickupStop: stop,
          },
        });
      }
      // Fuel (2 fill-ups w/ odometer → km/L) + 1 service for bus1.
      const principal2 = await db.user.findFirst({ where: { tenantId: tenant.id, role: "PRINCIPAL" } });
      const d10 = new Date(Date.now() + 3 * 3600_000 - 10 * 24 * 3600_000).toISOString().slice(0, 10);
      const d2 = new Date(Date.now() + 3 * 3600_000 - 2 * 24 * 3600_000).toISOString().slice(0, 10);
      if (principal2) {
        await db.fuelLog.create({
          data: { tenantId: tenant.id, vehicleId: bus1.id, date: d10, litres: 58, costKes: 10440, odometerKm: 84120, station: "Shell Kasarani", createdById: principal2.id },
        });
        await db.fuelLog.create({
          data: { tenantId: tenant.id, vehicleId: bus1.id, date: d2, litres: 60, costKes: 10800, odometerKm: 84540, station: "Shell Kasarani", createdById: principal2.id },
        });
        await db.vehicleMaintenance.create({
          data: {
            tenantId: tenant.id, vehicleId: bus1.id, date: d10, type: "SERVICE",
            description: "10,000km service — oil, filters, brake check", costKes: 18500,
            odometerKm: 84100, garage: "Toyota Kenya — Thika Rd", createdById: principal2.id,
          },
        });
      }
      console.log("✓ Seeded B.17: 2 buses, 2 drivers, 2 routes, 2 riders, 2 fuel logs (7 km/L) + 1 service.");
    }

    // --- B.18: inventory — stores, items (1 low, 1 expiring batch), assets ---
    const existingStore = await db.store.findFirst({ where: { tenantId: tenant.id } });
    const bursarU = await db.user.findFirst({ where: { tenantId: tenant.id, role: "BURSAR" } });
    if (!existingStore && bursarU) {
      const main = await db.store.create({ data: { tenantId: tenant.id, name: "Main Store", location: "Admin block" } });
      const kitchen = await db.store.create({ data: { tenantId: tenant.id, name: "Kitchen Store", location: "Behind dining hall" } });

      const in14 = new Date(Date.now() + 3 * 3600_000 + 14 * 24 * 3600_000).toISOString().slice(0, 10);
      const in180 = new Date(Date.now() + 3 * 3600_000 + 180 * 24 * 3600_000).toISOString().slice(0, 10);

      // Kitchen: maize flour tracks batches — one expiring in 14 days (alert demo).
      const flour = await db.stockItem.create({
        data: { tenantId: tenant.id, storeId: kitchen.id, name: "Maize flour (2kg)", category: "Food", unit: "bales", qty: 18, reorderLevel: 10, trackExpiry: true },
      });
      await db.stockBatch.create({ data: { tenantId: tenant.id, itemId: flour.id, batchNo: "B-2026-05", qty: 6, expiryDate: in14 } });
      await db.stockBatch.create({ data: { tenantId: tenant.id, itemId: flour.id, batchNo: "B-2026-06", qty: 12, expiryDate: in180 } });
      await db.stockItem.create({
        data: { tenantId: tenant.id, storeId: kitchen.id, name: "Rice (25kg)", category: "Food", unit: "bags", qty: 4, reorderLevel: 6, trackExpiry: false }, // LOW -> reorder alert demo
      });
      // Main store: sellables (uniform + exercise books) — founder rule demo.
      await db.stockItem.create({
        data: { tenantId: tenant.id, storeId: main.id, name: "School sweater", category: "Uniform", unit: "pcs", qty: 40, reorderLevel: 10, sellPriceKes: 1200 },
      });
      await db.stockItem.create({
        data: { tenantId: tenant.id, storeId: main.id, name: "Exercise book (A4 200pg)", category: "Stationery", unit: "pcs", qty: 480, reorderLevel: 100, sellPriceKes: 120 },
      });
      // Movements trail for the flour.
      await db.stockMovement.create({
        data: { tenantId: tenant.id, itemId: flour.id, type: "IN", qty: 18, reason: "Term 2 delivery — Naivas wholesale", byId: bursarU.id, byName: bursarU.fullName },
      });
      // Assets.
      await db.asset.create({
        data: { tenantId: tenant.id, tag: "AST-0001", name: "HP ProBook 450 — Bursar office", category: "ICT", location: "Admin block", custodian: "Achieng Mary", acquiredOn: "2025-01-15", valueKes: 78000, depreciationPctPerYear: 25, nextMaintenanceOn: "2026-06-01" },
      });
      await db.asset.create({
        data: { tenantId: tenant.id, tag: "AST-0002", name: "Dining hall benches (×20)", category: "Furniture", location: "Dining hall", custodian: "Barasa Wekesa", acquiredOn: "2024-09-01", valueKes: 160000, depreciationPctPerYear: 10 },
      });
      console.log("✓ Seeded B.18: 2 stores, 4 items (1 low-stock, 1 expiring batch), 2 sellables, 2 assets.");
    }

    // --- B.25 School Assets: backfill depreciation/service on existing seeds
    // (idempotent — also fixes DBs seeded before B.25 fields existed) ---
    await db.asset.updateMany({
      where: { tenantId: tenant.id, tag: "AST-0001", depreciationPctPerYear: 0 },
      data: { depreciationPctPerYear: 25, nextMaintenanceOn: "2026-06-01" },
    });
    await db.asset.updateMany({
      where: { tenantId: tenant.id, tag: "AST-0002", depreciationPctPerYear: 0 },
      data: { depreciationPctPerYear: 10 },
    });
    const ast1 = await db.asset.findFirst({ where: { tenantId: tenant.id, tag: "AST-0001" } });
    if (ast1) {
      const hasLog = await db.assetMaintenance.count({ where: { tenantId: tenant.id, assetId: ast1.id } });
      if (hasLog === 0) {
        await db.assetMaintenance.create({
          data: { tenantId: tenant.id, assetId: ast1.id, date: "2025-12-10", kind: "SERVICE", costKes: 3500, note: "OS re-install + new battery", byName: "Achieng Mary" },
        });
        console.log("✓ Seeded B.25: asset depreciation (laptop 25%/yr, benches 10%/yr) + 1 service log + laptop service OVERDUE (2026-06-01).");
      }
    }

    // --- B.25 Suppliers: tailor (G.24) + food wholesaler w/ contracts ---
    const existingSupplier = await db.supplier.findFirst({ where: { tenantId: tenant.id } });
    if (!existingSupplier) {
      const tailor = await db.supplier.create({
        data: {
          tenantId: tenant.id, name: "Mama Wanjiku Tailors", category: "Uniform",
          phone: "+254722334455", contact: "Mary Wanjiku", rating: 5,
          notes: "School tailor (G.24 uniform orders relay here). Delivers at school.",
        },
      });
      const naivas = await db.supplier.create({
        data: {
          tenantId: tenant.id, name: "Naivas Wholesale — Kiambu", category: "Food",
          phone: "+254733112299", contact: "Otieno James", kraPin: "A012345678Z", rating: 4,
          notes: "Maize flour, rice, cooking oil. 30-day credit.",
        },
      });
      // Expiring contract (≈20 days out — amber demo) + healthy one.
      const in20 = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
      const dec = `${new Date().getFullYear()}-12-15`;
      await db.supplierContract.create({
        data: { tenantId: tenant.id, supplierId: naivas.id, title: "Dry foods supply — Term 2", startsOn: "2026-05-01", endsOn: in20, valueKes: 180000, note: "Renew before closing day" },
      });
      await db.supplierContract.create({
        data: { tenantId: tenant.id, supplierId: tailor.id, title: "Uniform supply framework 2026", startsOn: "2026-01-10", endsOn: dec, valueKes: 0 },
      });
      console.log("✓ Seeded B.25: 2 suppliers (tailor ★5 + Naivas ★4) + 2 contracts (1 expiring ~20d amber demo).");
    }

    // --- B.25 Procurement: 1 open request w/ 2 quotes + 1 matched PO ---
    const existingReq = await db.purchaseRequest.findFirst({ where: { tenantId: tenant.id } });
    if (!existingReq) {
      const naivasSup = await db.supplier.findFirst({ where: { tenantId: tenant.id, name: { contains: "Naivas" } } });
      const tailorSup = await db.supplier.findFirst({ where: { tenantId: tenant.id, name: { contains: "Wanjiku" } } });
      if (naivasSup && tailorSup && bursarU) {
        const req = await db.purchaseRequest.create({
          data: {
            tenantId: tenant.id, title: "Term 3 dry foods restock",
            details: "30 bales maize flour, 10 bags rice (25kg), 20L cooking oil",
            neededBy: "2026-08-20", requestedById: bursarU.id, requestedByName: bursarU.fullName,
          },
        });
        await db.purchaseQuote.create({
          data: { tenantId: tenant.id, requestId: req.id, supplierId: naivasSup.id, supplierName: naivasSup.name, amountKes: 86500, note: "Delivers in 3 days, 30-day credit" },
        });
        await db.purchaseQuote.create({
          data: { tenantId: tenant.id, requestId: req.id, supplierId: tailorSup.id, supplierName: "Kiambu General Traders", amountKes: 92000, note: "Same-day delivery, cash" },
        });
        // A small completed PO (under threshold, auto-approved, MATCHED clean).
        await db.purchaseOrder.create({
          data: {
            tenantId: tenant.id, poNo: "KHPO1", supplierId: naivasSup.id, supplierName: naivasSup.name,
            title: "Cleaning supplies — June", totalKes: 18500, status: "MATCHED",
            approvedById: bursarU.id, approvedByName: `${bursarU.fullName} (under threshold)`, approvedAt: new Date("2026-06-02"),
            deliveredAt: new Date("2026-06-05"), deliveredValueKes: 18500, deliveredNote: "All items received",
            supplierInvoiceNo: "NV-2026-0995", supplierInvoiceKes: 18500,
            matchedAt: new Date("2026-06-06"), matchOk: true, matchNote: "PO, delivery and invoice all agree.",
            createdById: bursarU.id, createdByName: bursarU.fullName,
          },
        });
        await db.idSequence.upsert({
          where: { tenantId_entityType: { tenantId: tenant.id, entityType: "PURCHASE_ORDER" } },
          create: { tenantId: tenant.id, entityType: "PURCHASE_ORDER", lastValue: 1 },
          update: {},
        });
        console.log("✓ Seeded B.25: 1 open request (2 quotes, Naivas cheapest) + 1 MATCHED PO KHPO1.");
      }
    }

    // --- B.25: per-size stock for the school sweater (idempotent) ---
    const sweaterItem = await db.stockItem.findFirst({ where: { tenantId: tenant.id, name: "School sweater" } });
    if (sweaterItem) {
      const existingSizes = await db.uniformSize.count({ where: { tenantId: tenant.id, itemId: sweaterItem.id } });
      if (existingSizes === 0) {
        const sizeSplit: [string, number][] = [["S", 8], ["M", 14], ["L", 12], ["XL", 6]]; // = 40 total
        for (const [size, qty] of sizeSplit) {
          await db.uniformSize.create({ data: { tenantId: tenant.id, itemId: sweaterItem.id, size, qty } });
        }
        await db.stockItem.update({ where: { id: sweaterItem.id }, data: { qty: 40 } });
        console.log("✓ Seeded B.25: sweater sizes S8/M14/L12/XL6 (sum 40 = master qty).");
      }
    }

    // --- B.25 Expenses: categories + cost centers + a few real expenses (idempotent) ---
    {
      const haveCats = await db.expenseCategory.count({ where: { tenantId: tenant.id } });
      if (haveCats === 0) {
        const catNames = [
          "Utilities (water, power, internet)", "Repairs & Maintenance", "Cleaning & Sanitation",
          "Stationery & Printing", "Food & Kitchen", "Transport & Fuel", "Staff Welfare",
          "Examinations (KNEC/KICD)", "Licenses & Statutory", "Other",
        ];
        const ccNames = ["Whole school", "Administration", "Academics", "Boarding", "Kitchen", "Transport", "Co-curricular"];
        const cats: Record<string, string> = {};
        for (const name of catNames) {
          const c = await db.expenseCategory.create({ data: { tenantId: tenant.id, name } });
          cats[name] = c.id;
        }
        const ccs: Record<string, string> = {};
        for (const name of ccNames) {
          const c = await db.costCenter.create({ data: { tenantId: tenant.id, name } });
          ccs[name] = c.id;
        }

        // current Nairobi month for realistic, report-visible dates
        const nNow = new Date(Date.now() + 3 * 3600_000);
        const ym = `${nNow.getUTCFullYear()}-${String(nNow.getUTCMonth() + 1).padStart(2, "0")}`;
        const bursarName = bursarU?.fullName ?? "Achieng Mary";
        const bursarId = bursarU?.id ?? principal.id;

        // 1) Under-threshold KPLC bill — auto-approved
        await db.expense.create({
          data: {
            tenantId: tenant.id, categoryId: cats["Utilities (water, power, internet)"], categoryName: "Utilities (water, power, internet)",
            costCenterId: ccs["Administration"], costCenterName: "Administration",
            payee: "KPLC", amountKes: 12500, spentOn: `${ym}-04`, note: "Electricity — June",
            status: "APPROVED", approvedById: bursarId, approvedByName: `${bursarName} (under threshold)`, approvedAt: new Date(),
            createdById: bursarId, createdByName: bursarName,
          },
        });
        // 2) Under-threshold cleaning supplies — auto-approved
        await db.expense.create({
          data: {
            tenantId: tenant.id, categoryId: cats["Cleaning & Sanitation"], categoryName: "Cleaning & Sanitation",
            costCenterId: ccs["Boarding"], costCenterName: "Boarding",
            payee: "Jamii Cleaning Supplies", amountKes: 6800, spentOn: `${ym}-06`, note: "Detergent + handwash for dorms",
            status: "APPROVED", approvedById: bursarId, approvedByName: `${bursarName} (under threshold)`, approvedAt: new Date(),
            createdById: bursarId, createdByName: bursarName,
          },
        });
        // 3) Over-threshold roof repair — PENDING leadership approval (demo)
        await db.expense.create({
          data: {
            tenantId: tenant.id, categoryId: cats["Repairs & Maintenance"], categoryName: "Repairs & Maintenance",
            costCenterId: ccs["Whole school"], costCenterName: "Whole school",
            payee: "Mwangi Roofing Contractors", amountKes: 38000, spentOn: `${ym}-08`, note: "Dining hall roof — leak repair",
            status: "PENDING_APPROVAL",
            createdById: bursarId, createdByName: bursarName,
          },
        });
        console.log("✓ Seeded B.25: 10 expense categories + 7 cost centers + 3 expenses (2 approved, 1 over-threshold pending).");
      }
    }

    // --- B.19: cafeteria — week menu + 1 meal card (billed invoice) ---
    const existingMenu = await db.mealPlanEntry.findFirst({ where: { tenantId: tenant.id } });
    if (!existingMenu) {
      const menuSeed: [number, string, string][] = [
        [1, "BREAKFAST", "Uji na mandazi"], [1, "LUNCH", "Githeri na greens"], [1, "SUPPER", "Ugali, sukuma, beef stew"],
        [2, "BREAKFAST", "Tea na bread"], [2, "LUNCH", "Rice, beans na cabbage"], [2, "SUPPER", "Ugali na omena"],
        [3, "BREAKFAST", "Uji power"], [3, "LUNCH", "Chapati na ndengu"], [3, "SUPPER", "Rice na beef stew"],
        [4, "BREAKFAST", "Tea na mandazi"], [4, "LUNCH", "Githeri special"], [4, "SUPPER", "Ugali, kales na fried eggs"],
        [5, "BREAKFAST", "Uji na bread"], [5, "LUNCH", "Pilau Friday"], [5, "SUPPER", "Ugali na sukuma"],
        [6, "BREAKFAST", "Tea na toast"], [6, "LUNCH", "Rice na mbaazi"], [6, "SUPPER", "Githeri na avocado"],
        [7, "BREAKFAST", "Uji na mahamri"], [7, "LUNCH", "Chapati, beans na greens"], [7, "SUPPER", "Rice na matumbo"],
      ];
      for (const [day, meal, menu] of menuSeed) {
        await db.mealPlanEntry.create({ data: { tenantId: tenant.id, dayOfWeek: day, mealType: meal, menu } });
      }
      // Wanjiru (day scholar, F1W) gets a lunch card — billed to a REAL invoice (founder rule).
      const wanjiruSt = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Wanjiru" } });
      if (wanjiruSt) {
        const due = new Date(Date.now() + 3 * 3600_000 + 14 * 24 * 3600_000).toISOString().slice(0, 10);
        const mcInvoice = await db.invoice.create({
          data: {
            tenantId: tenant.id, invoiceNo: "KHINVMEAL1", studentId: wanjiruSt.id,
            description: "Meals — Lunch plan — Term 2 2026",
            totalKes: 6500, dueDate: due, status: "UNPAID", year: thisYear, term: 2,
          },
        });
        await db.mealCard.create({
          data: {
            tenantId: tenant.id, cardNo: "MC1", studentId: wanjiruSt.id,
            studentName: [wanjiruSt.firstName, wanjiruSt.middleName, wanjiruSt.lastName].filter(Boolean).join(" "),
            admissionNo: wanjiruSt.admissionNo, planName: "Lunch plan — Term 2 2026",
            meals: JSON.stringify(["LUNCH"]), termFeeKes: 6500,
            invoiceId: mcInvoice.id, year: thisYear, term: 2,
          },
        });
      }
      console.log("✓ Seeded B.19: 21 menu entries (full week) + 1 lunch card billed to KHINVMEAL1.");
    }

    // --- B.20: discipline — 2 incidents (1 minor, 1 major w/ parent SMS marker) ---
    const deputyU = await db.user.findFirst({ where: { tenantId: tenant.id, role: "DEPUTY_PRINCIPAL" } });
    const kamauSt2 = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Kamau" } });
    const existingIncident = await db.disciplineIncident.findFirst({ where: { tenantId: tenant.id } });
    if (!existingIncident && deputyU && kamauSt2 && chebetUser) {
      const d3 = new Date(Date.now() + 3 * 3600_000 - 3 * 24 * 3600_000).toISOString().slice(0, 10);
      const d1 = new Date(Date.now() + 3 * 3600_000 - 1 * 24 * 3600_000).toISOString().slice(0, 10);
      await db.disciplineIncident.create({
        data: {
          tenantId: tenant.id, studentId: kamauSt2.id,
          studentName: "Kamau Mwangi", admissionNo: kamauSt2.admissionNo,
          date: d3, category: "LATENESS", severity: "MINOR", points: 1,
          description: "Arrived 40 minutes late for morning preps without a note.",
          actionTaken: "Warned; to report to the class teacher daily this week",
          reportedById: chebetUser.id, reportedByName: chebetUser.fullName,
        },
      });
      await db.disciplineIncident.create({
        data: {
          tenantId: tenant.id, studentId: kamauSt2.id,
          studentName: "Kamau Mwangi", admissionNo: kamauSt2.admissionNo,
          date: d1, category: "NOISEMAKING", severity: "MAJOR", points: 3,
          description: "Disrupted the Form 2 East evening prep repeatedly after two warnings from the prefect on duty.",
          actionTaken: "Referred to the deputy principal",
          reportedById: deputyU.id, reportedByName: deputyU.fullName,
          parentNotifiedAt: new Date(),
        },
      });
      console.log("✓ Seeded B.20: 2 incidents for Kamau (1 minor + 1 major w/ parent SMS marker).");
    }

    // --- B.21: clinic — medical profiles (1 w/ allergies), visit, medication plan ---
    const nurseU = await db.user.findFirst({ where: { tenantId: tenant.id, role: "DEPUTY_PRINCIPAL" } });
    const atienoSt2 = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Atieno" } });
    const kipronoSt2 = await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Kiprono" } });
    const existingMedical = await db.studentMedical.findFirst({ where: { tenantId: tenant.id } });
    if (!existingMedical && nurseU && atienoSt2 && kipronoSt2) {
      await db.studentMedical.create({
        data: {
          tenantId: tenant.id, studentId: atienoSt2.id, bloodGroup: "O+",
          conditions: "Asthma", allergies: JSON.stringify(["Penicillin", "Groundnuts"]),
          shaNumber: "SHA-1184422",
        },
      });
      await db.studentMedical.create({
        data: { tenantId: tenant.id, studentId: kipronoSt2.id, bloodGroup: "B+" },
      });
      const d2c = new Date(Date.now() + 3 * 3600_000 - 2 * 24 * 3600_000).toISOString().slice(0, 10);
      await db.clinicVisit.create({
        data: {
          tenantId: tenant.id, studentId: atienoSt2.id,
          studentName: "Atieno Owino", admissionNo: atienoSt2.admissionNo,
          date: d2c, complaint: "Wheezing after PE", treatment: "Rested; inhaler administered; monitored 1hr",
          medicationGiven: "Salbutamol inhaler 2 puffs",
          recordedById: nurseU.id, recordedByName: nurseU.fullName,
        },
      });
      const plan = await db.medicationPlan.create({
        data: {
          tenantId: tenant.id, studentId: atienoSt2.id, studentName: "Atieno Owino",
          drug: "Salbutamol inhaler", dosage: "2 puffs", frequency: "As needed (before PE)",
          startDate: d2c, createdById: nurseU.id,
        },
      });
      await db.medicationDose.create({
        data: { tenantId: tenant.id, planId: plan.id, byId: nurseU.id, byName: nurseU.fullName, note: "Before PE lesson" },
      });
      console.log("✓ Seeded B.21: 2 medical profiles (Atieno: asthma + 2 allergies), 1 visit, 1 medication plan + dose.");
    }

    // --- B.14: one sent broadcast in the ledger (idempotent) ---
    const principalUser = await db.user.findFirst({ where: { tenantId: tenant.id, role: "PRINCIPAL" } });
    const existingBroadcast = await db.bulkMessage.findFirst({ where: { tenantId: tenant.id } });
    if (!existingBroadcast && principalUser) {
      await db.bulkMessage.create({
        data: {
          tenantId: tenant.id, audienceType: "SCHOOL_GUARDIANS", audienceLabel: "All parents/guardians",
          channel: "sms",
          body: "Mid-term break begins Friday 19th June at noon. School resumes Tuesday 23rd June at 7.30am. Buses leave 1pm sharp.",
          recipientCount: 5, sentCount: 5, skippedCount: 0, costKes: 4,
          senderId: principalUser.id, senderName: principalUser.fullName,
        },
      });
      console.log("✓ Seeded B.14: 1 sent broadcast in the comms ledger.");
    }
  }

  // --- B.5: Exams — a CAT with marks for Form 2 East (published) ---
  const catName = "CAT 1 — Term 2";
  let exam = await db.exam.findFirst({ where: { tenantId: tenant.id, name: catName } });
  if (!exam) {
    const catSubjects = ["MAT", "ENG", "KIS", "BIO", "CHE"].map((c) => subjMap.get(c)!).filter(Boolean);
    exam = await db.exam.create({
      data: {
        tenantId: tenant.id, name: catName, year: thisYear, term: 2, type: "CAT", maxMarks: 100, published: true,
        subjects: { create: catSubjects.map((subjectId) => ({ subjectId })) },
      },
    });
    const f2eStudents = await db.student.findMany({ where: { tenantId: tenant.id, classId: f2eClass?.id ?? "", status: "ACTIVE" } });
    // Realistic spread: Achieng strong, Kamau mid, Atieno developing.
    const profiles = [[88, 92, 78, 85, 80], [62, 55, 70, 58, 49], [45, 52, 60, 38, 41]];
    for (const [i, st] of f2eStudents.entries()) {
      const marks = profiles[i % profiles.length];
      for (const [j, subjectId] of catSubjects.entries()) {
        await db.examResult.upsert({
          where: { examId_studentId_subjectId: { examId: exam.id, studentId: st.id, subjectId } },
          create: { tenantId: tenant.id, examId: exam.id, studentId: st.id, subjectId, marks: marks[j], enteredById: marker.id },
          update: {},
        });
      }
    }
    console.log(`✓ Seeded B.5: "${catName}" published w/ ${f2eStudents.length * catSubjects.length} marks for Form 2 East.`);
  } else {
    console.log("✓ Seeded B.5: exam already present.");
  }

  // --- B.6: CBC — a CBC subject + KICD strands + observations for Cynthia (Grade 4) ---
  const engCbc = await db.subject.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "ENGC" } },
    create: { tenantId: tenant.id, name: "English (CBC)", code: "ENGC", curriculum: "CBC", departmentId: deptMap.get("Languages") ?? null },
    update: {},
  });
  const strandSeed = [
    ["Listening and Speaking", "Listen actively and respond appropriately in a variety of contexts."],
    ["Reading", "Read a variety of texts fluently and with comprehension."],
    ["Writing", "Write legibly and creatively for different purposes and audiences."],
  ];
  const strandIds: string[] = [];
  for (const [name, outcome] of strandSeed) {
    const st = await db.cbcStrand.upsert({
      where: { tenantId_subjectId_name: { tenantId: tenant.id, subjectId: engCbc.id, name } },
      create: { tenantId: tenant.id, subjectId: engCbc.id, name, learningOutcome: outcome },
      update: {},
    });
    strandIds.push(st.id);
  }
  // Observations for the Form 2 East learners (demo data on existing students)
  const cbcLearners = await db.student.findMany({ where: { tenantId: tenant.id, status: "ACTIVE" }, take: 3 });
  const existingObs = await db.cbcAssessment.count({ where: { tenantId: tenant.id } });
  if (existingObs === 0) {
    const obsLevels = [[4, 3, 4], [3, 2, 3], [2, 2, 1]];
    for (const [i, learner] of cbcLearners.entries()) {
      for (const [j, strandId] of strandIds.entries()) {
        await db.cbcAssessment.create({
          data: {
            tenantId: tenant.id, studentId: learner.id, strandId,
            level: obsLevels[i % obsLevels.length][j],
            comment: j === 0 && i === 0 ? "Confident narrator during oral work" : null,
            date: new Date(Date.now() + 3 * 3600_000 - 3 * 24 * 3600_000).toISOString().slice(0, 10),
            teacherId: marker.id, teacherName: marker.fullName,
          },
        });
      }
    }
  }
  console.log("✓ Seeded B.6: English (CBC) + 3 KICD strands + 9 observations.");

  // --- J.2: Future-proof Curriculum Engine migration assistant ----------------
  // Converts existing B.4/B.6 rows (subjects, classes, terms, CBC strands) into
  // configurable Curriculum / EducationLevel / GradeBand / LearningArea records.
  // Idempotent: safe to run every seed; it maps existing rows, never duplicates them.
  {
    const { runCurriculumMigrationAssistant } = await import("../src/lib/services/curriculum.service");
    const curriculumActor = await db.user.findFirst({ where: { tenantId: tenant.id, role: "PRINCIPAL" } });
    if (curriculumActor) {
      const result = await runCurriculumMigrationAssistant({
        id: curriculumActor.id,
        tenantId: curriculumActor.tenantId,
        neyoLoginId: curriculumActor.neyoLoginId,
        fullName: curriculumActor.fullName,
        phone: curriculumActor.phone,
        email: curriculumActor.email,
        role: curriculumActor.role as any,
        secondaryRole: curriculumActor.secondaryRole as any,
        language: curriculumActor.language ?? "en",
      });
      console.log(`✓ Seeded J.2: Curriculum Engine migration assistant mapped ${result.mappedSubjects} subjects, ${result.mappedClasses} classes, ${result.mappedTerms} terms and ${result.mappedStrands} strands.`);
    }
  }

  // --- B.7: Finance — Form 2 fee structure + invoices w/ realistic balances ---
  let structure = await db.feeStructure.findFirst({ where: { tenantId: tenant.id, level: "Form 2", year: thisYear, term: 2 } });
  if (!structure) {
    structure = await db.feeStructure.create({
      data: {
        tenantId: tenant.id, name: `Form 2 — Term 2 ${thisYear}`, level: "Form 2", year: thisYear, term: 2,
        items: { create: [
          { label: "Tuition", amountKes: 18500 },
          { label: "Boarding", amountKes: 12000 },
          { label: "Activity fee", amountKes: 2500 },
        ] },
      },
    });
    const f2Students = await db.student.findMany({ where: { tenantId: tenant.id, classId: f2eClass?.id ?? "", status: "ACTIVE" } });
    // Achieng fully paid · Kamau partial (overdue) · Atieno unpaid (very overdue)
    const profilesPay = [33000, 15000, 0];
    const dues = [30, -20, -65]; // days relative to today (negative = overdue)
    let invSeq = 0;
    for (const [i, st] of f2Students.entries()) {
      invSeq++;
      const paid = profilesPay[i % profilesPay.length];
      const due = new Date(Date.now() + 3 * 3600_000 + dues[i % dues.length] * 24 * 3600_000).toISOString().slice(0, 10);
      await db.invoice.create({
        data: {
          tenantId: tenant.id, invoiceNo: `KHINVSEED${invSeq}`, studentId: st.id, structureId: structure.id,
          description: `Form 2 — Term 2 ${thisYear} fees`, totalKes: 33000, paidKes: paid,
          status: paid >= 33000 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
          dueDate: due, year: thisYear, term: 2,
        },
      });
    }
    console.log(`✓ Seeded B.7: Form 2 structure (KES 33,000) + ${f2Students.length} invoices (paid/partial/unpaid).`);
  } else {
    console.log("✓ Seeded B.7: structure already present.");
  }

  // --- B.8: Payroll — salaries for 4 staff ---
  const salarySeed: [string, number, number, number, number][] = [
    // email-ish role match, basic, house, transport, sacco
    ["PRINCIPAL", 85000, 20000, 8000, 5000],
    ["DEPUTY_PRINCIPAL", 65000, 15000, 6000, 3000],
    ["CLASS_TEACHER", 45000, 10000, 4000, 2000],
    ["RECEPTIONIST", 28000, 6000, 3000, 1000],
  ];
  for (const [role, basic, house, transport, sacco] of salarySeed) {
    const staffUser = await db.user.findFirst({ where: { tenantId: tenant.id, role } });
    if (!staffUser) continue;
    await db.staffSalary.upsert({
      where: { userId: staffUser.id },
      create: { tenantId: tenant.id, userId: staffUser.id, basicKes: basic, houseAllowanceKes: house, transportAllowanceKes: transport, saccoKes: sacco },
      update: {},
    });
  }
  console.log("✓ Seeded B.8: 4 staff salaries (principal 85k … receptionist 28k).");

  // Demo payroll run 2026-05 (B.24 Owner Dashboard reads staff costs from it).
  // Idempotent: skipped when the period already exists. Uses the REAL B.8
  // statutory calculator so the numbers match what runPayroll would produce.
  const existingRun = await db.payrollRun.findFirst({ where: { tenantId: tenant.id, period: "2026-05" } });
  if (!existingRun) {
    const { grossToNet } = await import("../src/lib/services/payroll.service");
    const salaries = await db.staffSalary.findMany({ where: { tenantId: tenant.id } });
    const principalUser = await db.user.findFirst({ where: { tenantId: tenant.id, role: "PRINCIPAL" } });
    if (salaries.length > 0 && principalUser) {
      await db.payrollRun.create({
        data: {
          tenantId: tenant.id,
          period: "2026-05",
          status: "APPROVED",
          approvedAt: new Date(),
          createdById: principalUser.id,
          createdByName: principalUser.fullName,
          payslips: {
            create: await Promise.all(salaries.map(async (s) => {
              const staffUser = await db.user.findUniqueOrThrow({ where: { id: s.userId } });
              const gross = s.basicKes + s.houseAllowanceKes + s.transportAllowanceKes + s.otherAllowanceKes;
              const calc = grossToNet(gross);
              return {
                userId: s.userId, userName: staffUser.fullName, role: staffUser.role,
                basicKes: s.basicKes,
                allowancesKes: s.houseAllowanceKes + s.transportAllowanceKes + s.otherAllowanceKes,
                grossKes: gross, payeKes: calc.payeKes, shifKes: calc.shifKes,
                nssfKes: calc.nssfKes, housingLevyKes: calc.housingLevyKes,
                saccoKes: s.saccoKes, loanKes: s.loanKes,
                netKes: calc.netStatutoryKes - s.saccoKes - s.loanKes,
              };
            })),
          },
        },
      });
      console.log("✓ Seeded B.8: demo payroll run 2026-05 (APPROVED, real statutory calc).");
    }
  }

  // --- B.9: HR — profiles, a pending leave request, a job posting ---
  const chebetU = await db.user.findFirst({ where: { tenantId: tenant.id, role: "CLASS_TEACHER" } });
  if (chebetU) {
    await db.staffProfile.upsert({
      where: { userId: chebetU.id },
      create: {
        tenantId: tenant.id, userId: chebetU.id, tscNumber: "TSC/584211",
        qualifications: "B.Ed (Mathematics/Business Studies), Moi University",
        employmentDate: "2021-05-03", contractType: "PERMANENT",
        emergencyContact: "Kiprotich Faith · +254700112233",
      },
      update: {},
    });
    const existingLeave = await db.leaveRequest.findFirst({ where: { tenantId: tenant.id, userId: chebetU.id } });
    if (!existingLeave) {
      await db.leaveRequest.create({
        data: {
          tenantId: tenant.id, userId: chebetU.id, userName: chebetU.fullName,
          type: "STUDY", startDate: "2026-07-06", endDate: "2026-07-08", days: 3,
          reason: "KNEC marking training",
        },
      });
    }
  }
  const existingPosting = await db.jobPosting.findFirst({ where: { tenantId: tenant.id } });
  if (!existingPosting) {
    await db.jobPosting.create({
      data: {
        tenantId: tenant.id, title: "Kiswahili / CRE teacher",
        description: "TSC-registered, 2+ years experience. Boarding school duties apply.",
        deadline: "2026-07-15",
        applications: { create: [
          { name: "Mercy Wambui Njeri", phone: "+254722993311", status: "SHORTLISTED", notes: "Strong references from Alliance Girls" },
          { name: "Hassan Abdi Mohamed", phone: "+254733884422", status: "NEW" },
        ] },
      },
    });
  }
  console.log("✓ Seeded B.9: HR profile (TSC), 1 pending leave, 1 job posting + 2 applicants.");

  // ---- G.11 Public School Landing Site (corrective pass) -------------------
  // A complete, editable public school website seeded with Kenyan content so the
  // subdomain never looks empty: story, proof points, activities, news, gallery,
  // leadership, testimonials, map + SEO. Idempotent: settings upsert; showcase
  // rows are replaced by stable demo rows each seed.
  await db.publicSiteSettings.upsert({
    where: { tenantId: tenant.id },
    update: {
      heroHeadline: "Karibu High School: Learning with discipline and care",
      heroSubheading: "A Kiambu boarding secondary school supporting CBC and 8-4-4 families with clear academics, fees and communication.",
      heroImageUrl: "/brand/pattern-tile.png",
      history: "Founded to serve families across Kiambu County, Karibu High School combines firm pastoral care, disciplined academics and practical parent communication. Every learner is known by name, attendance is followed up, and families receive clear fee and report-card information through NEYO.",
      whyChooseUs: JSON.stringify([
        { title: "Clear fee communication", detail: "Parents see balances, invoices and M-Pesa payment steps from the portal and Mzazi Card." },
        { title: "Attendance follow-up", detail: "Class registers, curfew checks and absentee alerts help the school act early." },
        { title: "Structured academics", detail: "CBC observations, 8-4-4 exams, report cards and transcripts are all organised in one place." },
      ]),
      seoTitle: "Karibu High School — Admissions, academics and parent portal",
      seoDescription: "Karibu High School in Kiambu offers CBC and 8-4-4 pathways, boarding care, parent communication, M-Pesa fee support and online admissions.",
      ogImageUrl: "/brand/pattern-tile.png",
      primaryCtaLabel: "Apply for Admission",
      secondaryCtaLabel: "Parent Portal",
    },
    create: {
      tenantId: tenant.id,
      heroHeadline: "Karibu High School: Learning with discipline and care",
      heroSubheading: "A Kiambu boarding secondary school supporting CBC and 8-4-4 families with clear academics, fees and communication.",
      heroImageUrl: "/brand/pattern-tile.png",
      history: "Founded to serve families across Kiambu County, Karibu High School combines firm pastoral care, disciplined academics and practical parent communication. Every learner is known by name, attendance is followed up, and families receive clear fee and report-card information through NEYO.",
      whyChooseUs: JSON.stringify([
        { title: "Clear fee communication", detail: "Parents see balances, invoices and M-Pesa payment steps from the portal and Mzazi Card." },
        { title: "Attendance follow-up", detail: "Class registers, curfew checks and absentee alerts help the school act early." },
        { title: "Structured academics", detail: "CBC observations, 8-4-4 exams, report cards and transcripts are all organised in one place." },
      ]),
      seoTitle: "Karibu High School — Admissions, academics and parent portal",
      seoDescription: "Karibu High School in Kiambu offers CBC and 8-4-4 pathways, boarding care, parent communication, M-Pesa fee support and online admissions.",
      ogImageUrl: "/brand/pattern-tile.png",
      primaryCtaLabel: "Apply for Admission",
      secondaryCtaLabel: "Parent Portal",
    },
  });
  await db.publicSiteActivity.deleteMany({ where: { tenantId: tenant.id } });
  await db.publicSiteActivity.createMany({ data: [
    { tenantId: tenant.id, title: "Debate and public speaking", description: "Learners practise confidence, listening and respectful argument during weekly club sessions.", iconName: "users", sortOrder: 1, published: true },
    { tenantId: tenant.id, title: "Games and athletics", description: "Friday games support health, teamwork and house spirit before weekend routines.", iconName: "trophy", sortOrder: 2, published: true },
    { tenantId: tenant.id, title: "Environmental club", description: "Learners care for school spaces through tree planting, clean-up days and practical stewardship.", iconName: "leaf", sortOrder: 3, published: true },
  ] });
  await db.publicSiteLeader.deleteMany({ where: { tenantId: tenant.id } });
  await db.publicSiteLeader.createMany({ data: [
    { tenantId: tenant.id, name: "Wanjiru Kamau", title: "Principal", bio: "Leads Karibu High School with a focus on discipline, parent communication and steady academic growth.", email: "principal@karibuhigh.ac.ke", phone: "+254712345678", sortOrder: 1, published: true },
    { tenantId: tenant.id, name: "Otieno Brian", title: "Deputy Principal", bio: "Coordinates discipline, boarding routines and student welfare follow-up.", email: "deputy@karibuhigh.ac.ke", phone: "+254720998877", sortOrder: 2, published: true },
  ] });
  await db.publicSiteTestimonial.deleteMany({ where: { tenantId: tenant.id } });
  await db.publicSiteTestimonial.createMany({ data: [
    { tenantId: tenant.id, quote: "The school updates us early on fees, attendance and report-card days. I know what is happening without travelling to school every week.", guardianName: "Mary Wanjiku", relationship: "Parent, Form 2 East", studentName: "Kamau", sortOrder: 1, published: true },
    { tenantId: tenant.id, quote: "The Mzazi Card makes fee payment simple for our family because the account number is printed clearly.", guardianName: "Otieno James", relationship: "Parent, Form 2 East", studentName: "Achieng", sortOrder: 2, published: true },
  ] });
  await db.publicSiteGalleryImage.deleteMany({ where: { tenantId: tenant.id } });
  await db.publicSiteGalleryImage.createMany({ data: [
    { tenantId: tenant.id, title: "Learning spaces", caption: "A calm school identity tile while the school uploads real classroom photos.", imageUrl: "/brand/pattern-tile.png", category: "Facilities", sortOrder: 1, published: true },
    { tenantId: tenant.id, title: "Bundi school support", caption: "NEYO's owl mascot appears only as a helper layer when the school is ready.", imageUrl: "/brand/bundi-mascot.png", category: "School life", sortOrder: 2, published: true },
  ] });
  await db.newsPost.deleteMany({ where: { tenantId: tenant.id } });
  await db.newsPost.createMany({ data: [
    { tenantId: tenant.id, title: "Term 2 parent meeting scheduled", slug: "term-2-parent-meeting-scheduled", excerpt: "Parents and guardians are invited for a focused academic and fees review morning.", content: "Karibu High School invites parents and guardians for the Term 2 parent meeting. Class teachers will share academic progress, attendance notes and fee statements. Families should carry their Mzazi Card or admission number for faster service at the reception desk.", status: "PUBLISHED", featured: true, publishedAt: new Date("2026-06-13T09:00:00.000Z") },
    { tenantId: tenant.id, title: "Form 2 East report-card day flow", slug: "form-2-east-report-card-day-flow", excerpt: "Reception will guide families through report card printing, fee statements and teacher meetings.", content: "On report-card day, guardians will check in at reception. NEYO queues the learner report card and fee statement for printing, then directs the family to the class teacher meeting queue.", status: "PUBLISHED", featured: false, publishedAt: new Date("2026-06-10T09:00:00.000Z") },
  ] });
  console.log("✓ Seeded G.11: public landing site settings + news, gallery, leaders, testimonials and activities.");

  // ---- B.23 Bundi Layer (G.22 pause) + G.33 2.0 liquidity level ----------
  // FOUNDER RULES 2026-06-13: Bundi ships PAUSED platform-wide (design-only,
  // toggled on at launch via /api/admin/flags). Liquidity level is a COMPANY
  // setting (default "2" standard). Both idempotent upserts.
  await db.platformFlag.upsert({
    where: { moduleKey: "bundi" },
    update: {}, // never overwrite a deliberate release
    create: {
      moduleKey: "bundi",
      paused: true,
      note: "Bundi is getting ready — meet your new helper soon.",
      updatedBy: "NEYO (seed)",
    },
  });
  await db.platformSetting.upsert({
    where: { key: "liquid_level" },
    update: {},
    create: { key: "liquid_level", value: "2", updatedBy: "NEYO (seed)" },
  });
  console.log("✓ Seeded B.23/G.33: Bundi module PAUSED platform-wide + liquidity level 2 (standard).");

  // ---- G.15 Term Trends Pulse --------------------------------------------
  // Compute + store this week's leadership pulse for Karibu so the /owner
  // "Weekly Term Pulse" card shows live data immediately. Idempotent: the
  // service upserts one row per ISO-week.
  {
    const { computeAndStorePulse } = await import("../src/lib/services/term-pulse.service");
    const r = await computeAndStorePulse(tenant.id);
    console.log(`✓ Seeded G.15: Term Pulse ${r.data.weekKey} — "${r.data.summary}"`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
