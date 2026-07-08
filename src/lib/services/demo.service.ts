import crypto from "crypto";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { hash as argonHash } from "@node-rs/argon2";
import { ensureTenantDek } from "@/lib/services/encryption.service";
import { initialiseModules } from "@/lib/services/module.service";
import { generateNeyoLoginId, nextTenantId } from "@/lib/services/identity.service";

/**
 * G.14 — Day-One Demo Mode.
 * One click spins a SANDBOXED, time-boxed tenant seeded with real Kenyan data,
 * auto-logs the visitor in as the owner, and auto-expires after 24h (a daily
 * purge job hard-deletes expired demo tenants). "Convert to real school" sends
 * them to /get-started prefilled.
 *
 * Reuses the onboarding building blocks (DEK + modules + owner + session) and a
 * compact version of the seed. Demo tenants carry isDemo=true + demoExpiresAt.
 */

export const DEMO_TTL_HOURS = 24;
/** Part X — Developer Center 2.0: a real sandbox API key's provisioned
 * demo-style tenant needs a much longer real lifetime than a visitor's
 * 24h Day-One Demo — 90 days, refreshed on real sandbox-key usage (see
 * `api-key.service.ts`'s resolveBearerToken()), so an actively-developed
 * real integration never silently expires mid-build. */
export const SANDBOX_TTL_HOURS = 24 * 90;
const SESSION_TTL_DAYS = 30;

export interface DemoResult {
  tenantId: string;
  tenantSlug: string;
  ownerEmail: string;
  sessionToken: string;
  sessionExpiry: Date;
  demoExpiresAt: Date;
}

// Real Kenyan demo data (never "John Doe").
const DEMO_STUDENTS: Array<{ first: string; middle?: string; last: string; gender: string; klass: 0 | 1; guardian: string; phone: string; paid: number; total: number }> = [
  { first: "Achieng", middle: "Mary", last: "Otieno", gender: "F", klass: 0, guardian: "Otieno Brian", phone: "0712223344", paid: 33000, total: 33000 },
  { first: "Kamau", last: "Mwangi", gender: "M", klass: 0, guardian: "Mwangi Susan", phone: "0721445566", paid: 15000, total: 33000 },
  { first: "Atieno", last: "Owino", gender: "F", klass: 0, guardian: "Owino James", phone: "0745667788", paid: 0, total: 33000 },
  { first: "Wanjiru", middle: "Grace", last: "Njoroge", gender: "F", klass: 1, guardian: "Njoroge Peter", phone: "0733778899", paid: 12000, total: 28000 },
  { first: "Kiprono", last: "Cheruiyot", gender: "M", klass: 1, guardian: "Chebet Faith", phone: "0700112233", paid: 0, total: 28000 },
];

/** Create a fresh, sandboxed demo school and return a session for auto-login. */
export async function createDemoSchool(
  ctx?: { userAgent?: string; ipAddress?: string; deviceId?: string },
  ttlHours: number = DEMO_TTL_HOURS
): Promise<DemoResult> {
  // Unique slug + owner email (so many visitors can run demos at once).
  const suffix = crypto.randomBytes(3).toString("hex"); // 6 chars
  const slug = `demo-${suffix}`;
  const ownerEmail = `owner@${slug}.demo`;
  const password = "Demo2026!";
  const passwordHash = await argonHash(password);
  const now = new Date();
  const demoExpiresAt = new Date(now.getTime() + ttlHours * 3600_000);

  const tenant = await db.tenant.create({
    data: {
      name: "Demo Academy",
      slug,
      county: "Nairobi",
      phone: "+254700000000",
      email: ownerEmail,
      curriculum: "BOTH",
      schoolType: "DAY_AND_BOARDING",
      motto: "Elimu ni Mwanga — Knowledge is Light",
      brandPrimary: "#1c2740",
      brandAccent: "#1f9d5f",
      addressLine: "P.O. Box 100-00100, Nairobi",
      onboardedAt: now,
      isDemo: true,
      demoExpiresAt,
    },
  });

  await ensureTenantDek(tenant.id);
  await initialiseModules(tenant.id);
  // turn on the commonly-demoed modules
  for (const key of ["hostel", "transport", "library", "lms", "inventory", "cafeteria"]) {
    await db.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: key } },
      update: { enabled: true },
      create: { tenantId: tenant.id, moduleKey: key, enabled: true },
    });
  }

  // Owner login.
  const neyoLoginId = await generateNeyoLoginId();
  const owner = await db.user.create({
    data: {
      tenantId: tenant.id, neyoLoginId, fullName: "Demo Principal",
      email: ownerEmail, phone: "+254700000000", role: "SCHOOL_OWNER",
      isActive: true, passwordHash,
    },
  });

  // Seed real data inside the tenant scope (so tenantDb stamps tenantId).
  await withTenant(tenant.id, async () => {
    const f2 = await db.schoolClass.create({ data: { tenantId: tenant.id, level: "Form 2", stream: "East", curriculum: "8-4-4" } });
    const f1 = await db.schoolClass.create({ data: { tenantId: tenant.id, level: "Form 1", stream: "West", curriculum: "8-4-4" } });
    const classes = [f2, f1];

    const teacher = await db.user.create({
      data: {
        tenantId: tenant.id,
        neyoLoginId: await generateNeyoLoginId(),
        fullName: "Mercy Wambui",
        email: `teacher@${slug}.demo`,
        phone: "+254711222333",
        role: "CLASS_TEACHER",
        isActive: true,
        passwordHash,
      },
    });
    await db.user.create({
      data: {
        tenantId: tenant.id,
        neyoLoginId: await generateNeyoLoginId(),
        fullName: "Brian Otieno",
        email: `bursar@${slug}.demo`,
        phone: "+254722333444",
        role: "BURSAR",
        isActive: true,
        passwordHash,
      },
    });

    const term = await db.academicTerm.create({
      data: { tenantId: tenant.id, year: now.getFullYear(), term: 2, startDate: `${now.getFullYear()}-05-06`, endDate: `${now.getFullYear()}-08-08`, current: true },
    });

    const subjects = await Promise.all([
      db.subject.create({ data: { tenantId: tenant.id, name: "Mathematics", code: "MAT", curriculum: "8-4-4" } }),
      db.subject.create({ data: { tenantId: tenant.id, name: "English", code: "ENG", curriculum: "8-4-4" } }),
      db.subject.create({ data: { tenantId: tenant.id, name: "Kiswahili", code: "KIS", curriculum: "8-4-4" } }),
      db.subject.create({ data: { tenantId: tenant.id, name: "Biology", code: "BIO", curriculum: "8-4-4" } }),
    ]);

    for (const cls of classes) {
      await db.timetableConfig.create({
        data: {
          tenantId: tenant.id,
          classId: cls.id,
          periodsPerDay: 8,
          lessonDurationMins: 40,
          shortBreakStart: 2,
          longBreakStart: 4,
          lunchStart: 6,
          hasSaturday: true,
        },
      });
      await db.timetableSlot.createMany({
        data: [
          { tenantId: tenant.id, classId: cls.id, subjectId: subjects[0].id, teacherId: teacher.id, dayOfWeek: 1, period: 1, venue: cls.id === f2.id ? "Science Lab" : "Room 1 West" },
          { tenantId: tenant.id, classId: cls.id, subjectId: subjects[1].id, teacherId: teacher.id, dayOfWeek: 2, period: 2, venue: "Main Hall" },
          { tenantId: tenant.id, classId: cls.id, subjectId: subjects[2].id, dayOfWeek: 3, period: 3, venue: "Room 8 East" },
        ],
      });
      await db.syllabusTopic.createMany({
        data: [
          { tenantId: tenant.id, classId: cls.id, subjectId: subjects[0].id, termId: term.id, topic: "Linear equations and inequalities", scopeRef: "KLB Book 2 · Chapter 4", deadline: `${now.getFullYear()}-07-19`, status: "IN_PROGRESS", teacherId: teacher.id, teacherName: teacher.fullName, createdById: owner.id, createdByName: owner.fullName },
          { tenantId: tenant.id, classId: cls.id, subjectId: subjects[1].id, termId: term.id, topic: "Functional writing: formal letters", scopeRef: "Teacher scheme Week 6", deadline: `${now.getFullYear()}-07-26`, status: "PLANNED", teacherId: teacher.id, teacherName: teacher.fullName, createdById: owner.id, createdByName: owner.fullName },
        ],
      });
    }

    await db.examTimetableSlot.create({
      data: {
        tenantId: tenant.id,
        classId: f2.id,
        subjectId: subjects[0].id,
        examName: "Demo End Term Assessment",
        examDate: `${now.getFullYear()}-07-30`,
        startTime: "08:00",
        endTime: "09:30",
        venue: "Main Hall",
        notes: "Carry geometrical set.",
        createdById: owner.id,
        createdByName: owner.fullName,
      },
    });

    // Fee structures (so invoices look real).
    for (const [i, lvl] of ["Form 2", "Form 1"].entries()) {
      const amt = i === 0 ? 33000 : 28000;
      const struct = await db.feeStructure.create({
        data: { tenantId: tenant.id, name: `${lvl} — Term 2 ${now.getFullYear()}`, level: lvl, year: now.getFullYear(), term: 2, classId: classes[i].id },
      });
      await db.feeItem.create({ data: { structureId: struct.id, label: "Tuition", amountKes: amt } });
    }

    const demoStudents: { id: string; admissionNo: string; fullName: string; classLabel: string }[] = [];
    for (const st of DEMO_STUDENTS) {
      const admissionNo = await nextTenantId(tenant.id, "STUDENT");
      const classRow = classes[st.klass];
      const student = await db.student.create({
        data: {
          tenantId: tenant.id, admissionNo, legacyAdmissionNo: `SCH-${admissionNo.slice(-4)}`,
          firstName: st.first, middleName: st.middle ?? null,
          lastName: st.last, gender: st.gender, classId: classRow.id, status: "ACTIVE",
        },
      });
      const fullName = [st.first, st.middle, st.last].filter(Boolean).join(" ");
      demoStudents.push({ id: student.id, admissionNo, fullName, classLabel: [classRow.level, classRow.stream].filter(Boolean).join(" ") });
      const guardian = await db.guardian.create({
        data: { tenantId: tenant.id, fullName: st.guardian, phone: normalizePhone(st.phone) },
      });
      await db.studentGuardian.create({
        data: { tenantId: tenant.id, studentId: student.id, guardianId: guardian.id, relationship: "Parent", isPrimary: true },
      });
      // One fee invoice each (PAID / PARTIAL / UNPAID mix).
      const invoiceNo = await nextTenantId(tenant.id, "INVOICE");
      const status = st.paid >= st.total ? "PAID" : st.paid > 0 ? "PARTIAL" : "UNPAID";
      await db.invoice.create({
        data: {
          tenantId: tenant.id, invoiceNo, studentId: student.id,
          description: `Term 2 ${now.getFullYear()} fees`, totalKes: st.total, paidKes: st.paid,
          status, dueDate: `${now.getFullYear()}-08-15`, year: now.getFullYear(), term: 2,
        },
      });
    }

    const today = new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
    for (let i = 0; i < Math.min(3, demoStudents.length); i++) {
      const st = demoStudents[i];
      await db.cafeteriaQueueEntry.create({
        data: {
          tenantId: tenant.id,
          date: today,
          session: "LUNCH",
          queueNo: i + 1,
          studentId: st.id,
          studentName: st.fullName,
          admissionNo: st.admissionNo,
          classLabel: st.classLabel,
          status: i === 0 ? "SERVED" : "WAITING",
          servedAt: i === 0 ? now : null,
          servedById: i === 0 ? owner.id : null,
          servedByName: i === 0 ? owner.fullName : null,
        },
      });
    }
  });

  // Session + audit.
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiry = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 3600_000);
  await db.session.create({
    data: { token: sessionToken, userId: owner.id, userAgent: ctx?.userAgent ?? null, ipAddress: ctx?.ipAddress ?? null, deviceId: ctx?.deviceId ?? null, expiresAt: sessionExpiry },
  });
  await db.auditLog.create({
    data: {
      tenantId: tenant.id, actorId: owner.id, actorName: owner.fullName,
      action: "demo.created", entityType: "Tenant", entityId: tenant.id,
      metadata: JSON.stringify({ slug, expiresAt: demoExpiresAt.toISOString() }),
    },
  });

  return { tenantId: tenant.id, tenantSlug: slug, ownerEmail, sessionToken, sessionExpiry, demoExpiresAt };
}

/** Demo status for the session's tenant (drives the app-shell banner). */
export async function demoStatus(tenantId: string): Promise<{ isDemo: boolean; expiresAt: string | null; hoursLeft: number | null }> {
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { isDemo: true, demoExpiresAt: true } });
  if (!t?.isDemo || !t.demoExpiresAt) return { isDemo: false, expiresAt: null, hoursLeft: null };
  const hoursLeft = Math.max(0, Math.round((t.demoExpiresAt.getTime() - Date.now()) / 3600_000));
  return { isDemo: true, expiresAt: t.demoExpiresAt.toISOString(), hoursLeft };
}

/**
 * Retention job (G.8 family): hard-delete demo tenants past their expiry.
 * Cascade deletes wipe all their tenant-owned rows. Returns the count purged.
 */
export async function purgeExpiredDemos(): Promise<{ purged: number }> {
  const expired = await db.tenant.findMany({
    where: { isDemo: true, demoExpiresAt: { lt: new Date() } },
    select: { id: true },
  });
  let purged = 0;
  for (const t of expired) {
    // Users + sessions are NOT tenant-cascade in all schemas — delete sessions+users first to be safe.
    const users = await db.user.findMany({ where: { tenantId: t.id }, select: { id: true } });
    await db.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await db.user.deleteMany({ where: { tenantId: t.id } });
    await db.tenant.delete({ where: { id: t.id } }); // cascade removes the rest
    purged++;
  }
  return { purged };
}

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `+254${digits}`;
  return p;
}
