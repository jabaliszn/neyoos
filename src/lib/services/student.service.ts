/**
 * Student Management service (B.1). Tenant-scoped via tenantDb (A.2). Generates
 * the school admission number (A.4) and optional NEYO login accounts (A.4/A.1).
 * Implements TEACHER/PARENT row-scoping (A.3.8 / A.3.9), now unblocked.
 */
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import { nextTenantId, generateNeyoLoginId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import type {
  CreateStudentInput,
  UpdateStudentInput,
  ClassInput,
} from "@/lib/validations/student";
import { z } from "zod";
import { guardianInputSchema, updateGuardianSchema } from "@/lib/validations/student";

type GuardianInput = z.infer<typeof guardianInputSchema>;
type UpdateGuardianInput = z.infer<typeof updateGuardianSchema>;

export class StudentError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "StudentError";
  }
}

// ---------------------------------------------------------------------------
// Row-scoping (A.3.8 / A.3.9)
// ---------------------------------------------------------------------------

/**
 * Build the extra `where` a viewer is allowed to see:
 *  - TEACHER / CLASS_TEACHER: only students in classes they teach.
 *  - PARENT: only their own children (via Guardian.userId).
 *  - STUDENT: only themselves.
 *  - Everyone else (leadership/office): all (no extra filter).
 * Returns a Prisma `where` fragment (already inside withTenant).
 */
export async function scopeWhere(user: SessionUser): Promise<Record<string, unknown>> {
  const role = user.role as Role;

  if (role === "TEACHER" || role === "CLASS_TEACHER") {
    const classes = await tenantDb().schoolClass.findMany({
      where: { classTeacherId: user.id },
      select: { id: true },
    });
    const ids = classes.map((c) => c.id);
    // If they teach no class, they see nothing (fail-closed).
    return { classId: { in: ids.length ? ids : ["__none__"] } };
  }

  if (role === "PARENT") {
    const guardian = await tenantDb().guardian.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!guardian) return { id: "__none__" };
    const links = await tenantDb().studentGuardian.findMany({
      where: { guardianId: guardian.id },
      select: { studentId: true },
    });
    const ids = links.map((l) => l.studentId);
    return { id: { in: ids.length ? ids : ["__none__"] } };
  }

  if (role === "STUDENT") {
    return { userId: user.id };
  }

  return {};
}

/** Whether a viewer may see a specific student id (used on the profile page). */
export async function canViewStudent(user: SessionUser, studentId: string): Promise<boolean> {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const found = await tenantDb().student.findFirst({
      where: { AND: [{ id: studentId }, scope] },
      select: { id: true },
    });
    return Boolean(found);
  });
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export async function listClasses(includeArchived = false) {
  const rows = await tenantDb().schoolClass.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: [{ curriculum: "asc" }, { level: "asc" }, { stream: "asc" }],
  });
  // Attach a live student count per class.
  const counts = await tenantDb().student.groupBy({
    by: ["classId"],
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.classId, c._count._all]));
  return rows.map((c) => ({
    id: c.id,
    level: c.level,
    stream: c.stream,
    curriculum: c.curriculum,
    classTeacherId: c.classTeacherId,
    capacity: c.capacity,
    archived: c.archived,
    studentCount: countMap.get(c.id) ?? 0,
    name: c.stream ? `${c.level} ${c.stream}` : c.level,
  }));
}

export async function createClass(input: ClassInput) {
  const existing = await tenantDb().schoolClass.findFirst({
    where: { level: input.level, stream: input.stream || null },
  });
  if (existing) throw new StudentError("DUPLICATE", "That class/stream already exists.");
  return tenantDb().schoolClass.create({
    data: {
      level: input.level,
      stream: input.stream || null,
      curriculum: input.curriculum,
      classTeacherId: input.classTeacherId || null,
      capacity: input.capacity ?? null,
    } as never,
  });
}

export async function updateClass(id: string, input: Partial<ClassInput> & { archived?: boolean }) {
  const existing = await tenantDb().schoolClass.findUnique({ where: { id } });
  if (!existing) throw new StudentError("NOT_FOUND", "Class not found.");
  return tenantDb().schoolClass.update({
    where: { id },
    data: {
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.stream !== undefined ? { stream: input.stream || null } : {}),
      ...(input.curriculum !== undefined ? { curriculum: input.curriculum } : {}),
      ...(input.classTeacherId !== undefined ? { classTeacherId: input.classTeacherId || null } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity ?? null } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export interface StudentFilters {
  q?: string;
  classId?: string;
  stream?: string;
  status?: string;
  gender?: string;
}

export async function listStudents(user: SessionUser, filters: StudentFilters) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const filterWhere: Record<string, unknown> = {};
    if (filters.classId) filterWhere.classId = filters.classId;
    if (filters.stream) filterWhere.schoolClass = { is: { stream: filters.stream } };
    if (filters.status) filterWhere.status = filters.status;
    if (filters.gender) filterWhere.gender = filters.gender;
    if (filters.q) {
      const q = filters.q.trim();
      const or: Record<string, unknown>[] = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { middleName: { contains: q } },
        { admissionNo: { contains: q } },
        { legacyAdmissionNo: { contains: q } },
      ];
      // Guardian-phone search (B.1.7): a parent calls / pays via M-Pesa and we
      // only have the phone. Accept 0712..., 712..., +254712... fragments.
      const digits = q.replace(/[\s\-()]/g, "");
      if (/^\+?\d{4,}$/.test(digits)) {
        const candidates = new Set<string>([digits]);
        if (digits.startsWith("0")) candidates.add("+254" + digits.slice(1));
        if (digits.startsWith("254")) candidates.add("+" + digits);
        if (/^[17]/.test(digits)) candidates.add("+254" + digits);
        or.push({
          guardians: {
            some: { guardian: { OR: [...candidates].map((c) => ({ phone: { contains: c } })) } },
          },
        });
      }
      filterWhere.OR = or;
    }
    // AND the role scope with the user's filters so a filter can never widen
    // what a TEACHER/PARENT is allowed to see (defense in depth).
    const rows = await tenantDb().student.findMany({
      where: { AND: [scope, filterWhere] },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 300,
      include: { schoolClass: true },
    });
    return rows.map(toListItem);
  });
}

function toListItem(s: {
  id: string; admissionNo: string; legacyAdmissionNo: string | null; firstName: string; middleName: string | null;
  lastName: string; gender: string; status: string; photoUrl: string | null;
  schoolClass: { level: string; stream: string | null } | null;
}) {
  return {
    id: s.id,
    admissionNo: s.admissionNo,
    legacyAdmissionNo: s.legacyAdmissionNo,
    name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
    gender: s.gender,
    status: s.status,
    photoUrl: s.photoUrl,
    className: s.schoolClass ? (s.schoolClass.stream ? `${s.schoolClass.level} ${s.schoolClass.stream}` : s.schoolClass.level) : null,
  };
}

export async function getStudent(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const s = await tenantDb().student.findFirst({
      where: { AND: [{ id }, scope] },
      include: {
        schoolClass: true,
        guardians: { include: { guardian: true } },
        documents: { orderBy: { createdAt: "desc" } },
        requirements: { orderBy: { createdAt: "asc" } },
        transfers: { where: { reversedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!s) throw new StudentError("NOT_FOUND", "Student not found.");
    return s;
  });
}

async function createGuardian(tenantId: string, g: GuardianInput) {
  let userId: string | null = null;
  if (g.createLogin) {
    const neyoLoginId = await generateNeyoLoginId();
    const u = await db.user.create({
      data: {
        tenantId,
        neyoLoginId,
        fullName: g.fullName,
        phone: g.phone,
        email: g.email || null,
        role: "PARENT",
        isActive: true,
      },
    });
    userId = u.id;
  }
  const guardian = await tenantDb().guardian.create({
    data: {
      fullName: g.fullName,
      phone: g.phone,
      email: g.email || null,
      nationalId: g.nationalId || null,
      userId,
    } as never,
  });
  return guardian;
}

export async function createStudent(
  user: SessionUser,
  input: CreateStudentInput
) {
  return withTenant(user.tenantId, async () => {
    if (input.legacyAdmissionNo) {
      const dupLegacy = await tenantDb().student.findFirst({
        where: { legacyAdmissionNo: input.legacyAdmissionNo, deletedAt: null },
        select: { id: true },
      });
      if (dupLegacy) throw new StudentError("DUPLICATE", "That school admission number is already used by another learner.");
    }

    // School admission number (A.4) — atomic.
    const admissionNo = await nextTenantId(user.tenantId, "STUDENT");

    // Optional NEYO student login account.
    let userId: string | null = null;
    if (input.createLogin) {
      const neyoLoginId = await generateNeyoLoginId();
      const u = await db.user.create({
        data: {
          tenantId: user.tenantId,
          neyoLoginId,
          fullName: [input.firstName, input.lastName].join(" "),
          role: "STUDENT",
          isActive: true,
        },
      });
      userId = u.id;
    }

    const student = await tenantDb().student.create({
      data: {
        admissionNo,
        legacyAdmissionNo: input.legacyAdmissionNo || null,
        firstName: input.firstName,
        middleName: input.middleName || null,
        lastName: input.lastName,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth || null,
        classId: input.classId || null,
        photoUrl: input.photoUrl || null,
        upiNumber: input.upiNumber || null,
        birthCertNo: input.birthCertNo || null,
        notes: input.notes || null,
        userId,
      } as never,
    });

    // Auto-Invoice newly registered students for their class fee structure (H.3)
    const currentTerm = await tenantDb().academicTerm.findFirst({ where: { current: true } });
    if (input.classId && currentTerm) {
      const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.classId } });
      if (cls) {
        const structure =
          await tenantDb().feeStructure.findFirst({ where: { classId: cls.id, year: currentTerm.year, term: currentTerm.term }, include: { items: true } }) ||
          await tenantDb().feeStructure.findFirst({ where: { level: cls.level, classId: null, year: currentTerm.year, term: currentTerm.term }, include: { items: true } });
        if (structure) {
          const total = structure.items.reduce((sum, item) => sum + item.amountKes, 0);
          const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
          await db.invoice.create({
            data: {
              tenantId: user.tenantId,
              invoiceNo,
              studentId: student.id,
              structureId: structure.id,
              description: `${structure.name} fees`,
              totalKes: total,
              paidKes: 0,
              discountKes: 0,
              status: "UNPAID",
              kind: "FEE",
              dueDate: currentTerm.endDate,
              year: currentTerm.year,
              term: currentTerm.term,
            },
          });
        }
      }
    }

    // Guardians + links.
    for (const g of input.guardians ?? []) {
      const guardian = await createGuardian(user.tenantId, g);
      await tenantDb().studentGuardian.create({
        data: {
          studentId: student.id,
          guardianId: guardian.id,
          relationship: g.relationship,
          isPrimary: g.isPrimary,
        } as never,
      });
    }

    // Seed per-student joining requirements from the school master list (G.9).
    if (input.seedRequirements) {
      const tenant = await db.tenant.findUnique({
        where: { id: user.tenantId },
        select: { joiningRequirements: true },
      });
      let master: Array<{ label: string; category?: string; quantity?: string; mandatory?: boolean }> = [];
      try {
        master = tenant?.joiningRequirements ? JSON.parse(tenant.joiningRequirements) : [];
      } catch {
        master = [];
      }
      if (master.length) {
        await tenantDb().studentRequirement.createMany({
          data: master.map((m) => ({
            studentId: student.id,
            label: m.label,
            category: m.category ?? "other",
            quantity: m.quantity ?? null,
            mandatory: m.mandatory ?? true,
          })) as never,
        });
      }
    }

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.create",
        entityType: "Student",
        entityId: student.id,
        metadata: JSON.stringify({ admissionNo, name: `${input.firstName} ${input.lastName}` }),
      },
    });

    return { id: student.id, admissionNo };
  });
}

export async function updateStudent(user: SessionUser, id: string, input: UpdateStudentInput) {
  return withTenant(user.tenantId, async () => {
    const before = await tenantDb().student.findUnique({ where: { id }, include: { schoolClass: true } });
    if (!before) throw new StudentError("NOT_FOUND", "Student not found.");

    if (input.legacyAdmissionNo) {
      const dupLegacy = await tenantDb().student.findFirst({
        where: { legacyAdmissionNo: input.legacyAdmissionNo, deletedAt: null, NOT: { id } },
        select: { id: true },
      });
      if (dupLegacy) throw new StudentError("DUPLICATE", "That school admission number is already used by another learner.");
    }

    // Alumni bookkeeping (B.1.12): entering GRADUATED stamps the year + final
    // class label; leaving GRADUATED clears them.
    const alumniData: Record<string, unknown> = {};
    if (input.status === "GRADUATED" && before.status !== "GRADUATED") {
      alumniData.graduationYear = new Date().getFullYear();
      alumniData.finalClassLabel = before.schoolClass
        ? [before.schoolClass.level, before.schoolClass.stream].filter(Boolean).join(" ")
        : null;
    } else if (input.status && input.status !== "GRADUATED" && before.status === "GRADUATED") {
      alumniData.graduationYear = null;
      alumniData.finalClassLabel = null;
    }

    const updated = await tenantDb().student.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.middleName !== undefined ? { middleName: input.middleName || null } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth || null } : {}),
        ...(input.classId !== undefined ? { classId: input.classId || null } : {}),
        ...(input.legacyAdmissionNo !== undefined ? { legacyAdmissionNo: input.legacyAdmissionNo || null } : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl || null } : {}),
        ...(input.upiNumber !== undefined ? { upiNumber: input.upiNumber || null } : {}),
        ...(input.birthCertNo !== undefined ? { birthCertNo: input.birthCertNo || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...alumniData,
      },
    });

    // Auto-update student fee ledger when edited or promoted to a new class (H.3)
    if (input.classId !== undefined && input.classId !== before.classId) {
      const term = await tenantDb().academicTerm.findFirst({ where: { current: true } });
      if (term) {
        // Void/delete any previous unpaid class structure invoices
        await tenantDb().invoice.deleteMany({
          where: { studentId: id, year: term.year, term: term.term, status: "UNPAID", structureId: { not: null } }
        });
        
        // Issue unpaid invoice for their new class fee structure!
        if (input.classId) {
          const newClass = await tenantDb().schoolClass.findUnique({ where: { id: input.classId } });
          if (newClass) {
            const structure =
              await tenantDb().feeStructure.findFirst({ where: { classId: newClass.id, year: term.year, term: term.term }, include: { items: true } }) ||
              await tenantDb().feeStructure.findFirst({ where: { level: newClass.level, classId: null, year: term.year, term: term.term }, include: { items: true } });
            if (structure) {
              const total = structure.items.reduce((sum, item) => sum + item.amountKes, 0);
              const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
              await db.invoice.create({
                data: {
                  tenantId: user.tenantId,
                  invoiceNo,
                  studentId: id,
                  structureId: structure.id,
                  description: `${structure.name} fees`,
                  totalKes: total,
                  paidKes: 0,
                  status: "UNPAID",
                  dueDate: term.endDate,
                  year: term.year,
                  term: term.term,
                  kind: "FEE"
                }
              });
            }
          }
        }
      }
    }

    // Build a small diff for the audit trail (B.1.9).
    const changes: Record<string, [unknown, unknown]> = {};
    for (const k of Object.keys(input) as (keyof UpdateStudentInput)[]) {
      const b = (before as Record<string, unknown>)[k];
      const a = (updated as Record<string, unknown>)[k];
      if (b !== a) changes[k] = [b, a];
    }
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.update",
        entityType: "Student",
        entityId: id,
        metadata: JSON.stringify({ changes }),
      },
    });
    return { id: updated.id };
  });
}

/** Soft-delete (G.6) — moves the student to the Recycle Bin. */
export async function deleteStudent(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const s = await tenantDb().student.findUnique({ where: { id } });
    if (!s) throw new StudentError("NOT_FOUND", "Student not found.");
    // tenantDb turns delete into a soft-delete for SOFT_DELETE_MODELS.
    await tenantDb().student.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.delete",
        entityType: "Student",
        entityId: id,
      },
    });
    return { id };
  });
}

// ---------------------------------------------------------------------------
// Guardians, documents, requirements (profile sub-resources)
// ---------------------------------------------------------------------------

export async function addGuardian(user: SessionUser, studentId: string, g: GuardianInput) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findUnique({ where: { id: studentId } });
    if (!student) throw new StudentError("NOT_FOUND", "Student not found.");

    const existingCount = await tenantDb().studentGuardian.count({ where: { studentId } });
    const isPrimary = existingCount === 0 ? true : g.isPrimary;

    if (isPrimary) {
      await tenantDb().studentGuardian.updateMany({
        where: { studentId },
        data: { isPrimary: false },
      });
    }

    const guardian = await createGuardian(user.tenantId, g);
    await tenantDb().studentGuardian.create({
      data: {
        studentId,
        guardianId: guardian.id,
        relationship: g.relationship,
        isPrimary,
      } as never,
    });
    return { id: guardian.id };
  });
}

export async function setPrimaryGuardian(user: SessionUser, studentId: string, guardianId: string) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findUnique({ where: { id: studentId } });
    if (!student) throw new StudentError("NOT_FOUND", "Student not found.");

    await tenantDb().studentGuardian.updateMany({
      where: { studentId },
      data: { isPrimary: false },
    });

    await tenantDb().studentGuardian.update({
      where: { studentId_guardianId: { studentId, guardianId } },
      data: { isPrimary: true },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.primary_guardian_updated",
        entityType: "student",
        entityId: studentId,
        metadata: JSON.stringify({ guardianId }),
      },
    });

    return { ok: true };
  });
}

/**
 * M.3 — Class teachers can correct an EXISTING guardian's phone/email/name/
 * relationship (the missing piece: NEYO could only ADD a new guardian before,
 * never fix a wrong number on one already on file — the exact real-world case
 * a class teacher hits when a parent gets a new SIM card). Row-scoped: the
 * caller must have `student.edit` (enforced at the API layer) AND the target
 * guardian must actually be linked to a student the caller can see (checked
 * here via scopeWhere, the same fail-closed A.3.8 rule as the rest of B.1) —
 * so a TEACHER/CLASS_TEACHER can't blindly edit a guardian belonging to a
 * class that isn't theirs just by guessing an ID.
 * If a linked PARENT login exists for this guardian, its phone/email are kept
 * in sync too (so the login stays reachable — a guardian and their portal
 * account must never silently drift apart).
 */
export async function updateGuardian(
  user: SessionUser,
  studentId: string,
  guardianId: string,
  input: UpdateGuardianInput
) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!student) throw new StudentError("NOT_FOUND", "Student not found.");

    const link = await tenantDb().studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId } },
      include: { guardian: true },
    });
    if (!link) throw new StudentError("NOT_FOUND", "That guardian is not linked to this learner.");

    const before = link.guardian;
    const data: Record<string, unknown> = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email || null;
    if (input.nationalId !== undefined) data.nationalId = input.nationalId || null;

    if (Object.keys(data).length === 0 && input.relationship === undefined) {
      return { id: guardianId }; // nothing to change — a harmless no-op
    }

    if (Object.keys(data).length > 0) {
      await tenantDb().guardian.update({ where: { id: guardianId }, data: data as never });
      // Keep a linked PARENT login's contact details in sync so they can
      // still receive their OTP / SMS on the corrected number.
      if (before.userId) {
        await db.user.update({
          where: { id: before.userId },
          data: {
            ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            ...(input.email !== undefined ? { email: input.email || null } : {}),
          },
        });
      }
    }
    if (input.relationship !== undefined) {
      await tenantDb().studentGuardian.update({
        where: { studentId_guardianId: { studentId, guardianId } },
        data: { relationship: input.relationship },
      });
    }

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.guardian_updated",
        entityType: "guardian",
        entityId: guardianId,
        metadata: JSON.stringify({
          studentId,
          before: { fullName: before.fullName, phone: before.phone, email: before.email, relationship: link.relationship },
          after: { fullName: input.fullName ?? before.fullName, phone: input.phone ?? before.phone, email: input.email ?? before.email, relationship: input.relationship ?? link.relationship },
        }),
      },
    });

    return { id: guardianId };
  });
}

export async function addDocument(
  user: SessionUser,
  studentId: string,
  doc: { label: string; fileUrl: string; fileName?: string; hardcopyLocation: string }
) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findUnique({ where: { id: studentId } });
    if (!student) throw new StudentError("NOT_FOUND", "Student not found.");
    const row = await tenantDb().studentDocument.create({
      data: {
        studentId,
        label: doc.label,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName ?? null,
        hardcopyLocation: doc.hardcopyLocation,
        uploadedById: user.id,
      } as never,
    });
    return { id: row.id };
  });
}

export async function toggleRequirement(user: SessionUser, requirementId: string, fulfilled: boolean) {
  return withTenant(user.tenantId, async () => {
    const req = await tenantDb().studentRequirement.findUnique({ where: { id: requirementId } });
    if (!req) throw new StudentError("NOT_FOUND", "Requirement not found.");
    await tenantDb().studentRequirement.update({
      where: { id: requirementId },
      data: { fulfilled, fulfilledAt: fulfilled ? new Date() : null },
    });
    return { id: requirementId, fulfilled };
  });
}

// ---------------------------------------------------------------------------
// Transfer management (B.1.11 — school-to-school)
// ---------------------------------------------------------------------------

export interface TransferInput {
  destinationSchool: string;
  destinationCounty?: string;
  transferDate: string; // YYYY-MM-DD
  reason: string;
  reasonNote?: string;
}

/** Transfer a student out: status -> TRANSFERRED, seat freed, history row, audit. */
export async function transferStudent(user: SessionUser, studentId: string, input: TransferInput) {
  return withTenant(user.tenantId, async () => {
    // Row-scoping (A.3.8): a CLASS_TEACHER may only act on their OWN class.
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] } });
    if (!student) throw new StudentError("NOT_FOUND", "Student not found.");
    if (student.status === "TRANSFERRED")
      throw new StudentError("DUPLICATE", "This student has already been transferred out.");

    // Library Clearance Transfer Guard (H.3)
    const activeIssues = await tenantDb().bookIssue.count({
      where: { studentId, returnedAt: null },
    });
    if (activeIssues > 0) {
      throw new StudentError("FORBIDDEN", `Student cannot be transferred out. They currently hold ${activeIssues} un-returned library book(s). Please clear their library ledger first!`);
    }

    const unpaidFinesCount = await tenantDb().bookIssue.count({
      where: { studentId, returnedAt: { not: null }, fineKes: { gt: 0 }, finePaid: false },
    });
    if (unpaidFinesCount > 0) {
      throw new StudentError("FORBIDDEN", `Student cannot be transferred out. They have unpaid library fines. Please clear their library ledger first!`);
    }

    const reason = input.reasonNote ? `${input.reason}: ${input.reasonNote}` : input.reason;
    const transfer = await tenantDb().studentTransfer.create({
      data: {
        studentId,
        destinationSchool: input.destinationSchool,
        destinationCounty: input.destinationCounty || null,
        transferDate: input.transferDate,
        reason,
        previousClassId: student.classId,
        createdById: user.id,
        createdByName: user.fullName,
      } as never,
    });
    await tenantDb().student.update({
      where: { id: studentId },
      data: { status: "TRANSFERRED", classId: null }, // seat freed
    });
    
    // Automatically release their hostel bed space if they are a boarder! (H.3/I.16)
    const freedBeds = await tenantDb().hostelAllocation.updateMany({
      where: { studentId, releasedAt: null },
      data: { releasedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.transfer",
        entityType: "student",
        entityId: studentId,
        metadata: JSON.stringify({ to: input.destinationSchool, date: input.transferDate, reason, freedHostelBeds: freedBeds.count }),
      },
    });
    return { transferId: transfer.id };
  });
}

/** Undo the latest transfer: restores ACTIVE + the previous class seat. */
export async function undoTransfer(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const transfer = await tenantDb().studentTransfer.findFirst({
      where: { studentId, reversedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!transfer) throw new StudentError("NOT_FOUND", "No active transfer to undo.");

    // If the old class was deleted/archived meanwhile, restore without a class.
    let classId: string | null = null;
    if (transfer.previousClassId) {
      const cls = await tenantDb().schoolClass.findUnique({ where: { id: transfer.previousClassId } });
      if (cls && !cls.archived) classId = cls.id;
    }
    await tenantDb().studentTransfer.update({
      where: { id: transfer.id },
      data: { reversedAt: new Date() },
    });
    await tenantDb().student.update({
      where: { id: studentId },
      data: { status: "ACTIVE", classId },
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.transfer_undone",
        entityType: "student",
        entityId: studentId,
        metadata: JSON.stringify({ transferId: transfer.id, restoredClassId: classId }),
      },
    });
    return { restoredClassId: classId };
  });
}

/** Latest (non-reversed) transfer for a student, for the profile banner. */
export async function activeTransfer(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().studentTransfer.findFirst({
      where: { studentId, reversedAt: null },
      orderBy: { createdAt: "desc" },
    });
  });
}

// ---------------------------------------------------------------------------
// Alumni management (B.1.12)
// ---------------------------------------------------------------------------

/** Alumni directory: GRADUATED students grouped by graduating year (desc). */
export async function listAlumni(user: SessionUser, year?: number) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const rows = await tenantDb().student.findMany({
      where: { AND: [scope, { status: "GRADUATED" }, ...(year ? [{ graduationYear: year }] : [])] },
      orderBy: [{ graduationYear: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    });
    const years = new Map<number, number>(); // year -> count (for the filter pills)
    const all = await tenantDb().student.groupBy({
      by: ["graduationYear"],
      where: { AND: [scope, { status: "GRADUATED" }] },
      _count: { _all: true },
    });
    for (const g of all) if (g.graduationYear) years.set(g.graduationYear, g._count._all);

    return {
      years: [...years.entries()].sort((a, b) => b[0] - a[0]).map(([y, count]) => ({ year: y, count })),
      alumni: rows.map((s) => ({
        id: s.id,
        admissionNo: s.admissionNo,
        name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
        gender: s.gender,
        photoUrl: s.photoUrl,
        graduationYear: s.graduationYear,
        finalClassLabel: s.finalClassLabel,
      })),
    };
  });
}

/** Graduate an entire class at once (end of Form 4 / Grade 9). */
export async function graduateClass(user: SessionUser, classId: string, year?: number) {
  return withTenant(user.tenantId, async () => {
    const cls = await tenantDb().schoolClass.findUnique({ where: { id: classId } });
    if (!cls) throw new StudentError("NOT_FOUND", "Class not found.");
    const label = [cls.level, cls.stream].filter(Boolean).join(" ");
    const gradYear = year ?? new Date().getFullYear();

    // Row-scoping: a CLASS_TEACHER may only graduate their own class.
    const scope = await scopeWhere(user);
    const students = await tenantDb().student.findMany({
      where: { AND: [scope, { classId, status: "ACTIVE" }] },
      select: { id: true },
    });
    if (students.length === 0)
      throw new StudentError("NOT_FOUND", "No active students in this class (or it is not your class).");

    await tenantDb().student.updateMany({
      where: { id: { in: students.map((s) => s.id) } },
      data: { status: "GRADUATED", graduationYear: gradYear, finalClassLabel: label, classId: null },
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "student.class_graduated",
        entityType: "schoolClass",
        entityId: classId,
        metadata: JSON.stringify({ class: label, year: gradYear, students: students.length }),
      },
    });
    return { graduated: students.length, year: gradYear, class: label };
  });
}

/** Dashboard/summary counts for the students index header. */
export async function studentStats(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const [total, active, classes] = await Promise.all([
      tenantDb().student.count({ where: scope }),
      tenantDb().student.count({ where: { AND: [scope, { status: "ACTIVE" }] } }),
      tenantDb().schoolClass.count({ where: { archived: false } }),
    ]);
    return { total, active, classes };
  });
}

/** Record/save a student's leaving certificate in the school vault (H.3) */
export async function recordLeavingCertificate(
  user: SessionUser,
  input: { studentId: string; certificateType: string; certificateNo: string; hardcopyLocation: string; fileUrl?: string; fileName?: string }
) {
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().leavingCertificate.findFirst({
      where: { certificateNo: input.certificateNo, NOT: { studentId: input.studentId } },
    });
    if (existing) {
      throw new StudentError("DUPLICATE", `Certificate number "${input.certificateNo}" is already logged in NEYO for another student!`);
    }

    const row = await db.leavingCertificate.upsert({
      where: { studentId: input.studentId },
      create: {
        tenantId: user.tenantId,
        studentId: input.studentId,
        certificateType: input.certificateType,
        certificateNo: input.certificateNo,
        hardcopyLocation: input.hardcopyLocation,
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
        status: "STORED",
      },
      update: {
        certificateType: input.certificateType,
        certificateNo: input.certificateNo,
        hardcopyLocation: input.hardcopyLocation,
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "student.certificate_vaulted", entityType: "leavingCertificate", entityId: row.id,
        metadata: JSON.stringify({ type: input.certificateType, no: input.certificateNo }),
      },
    });

    return row;
  });
}

/** Log the physical handover of a certificate to a student/parent with proof (H.3) */
export async function handOverLeavingCertificate(
  user: SessionUser,
  input: { studentId: string; handedOverTo: string }
) {
  return withTenant(user.tenantId, async () => {
    const cert = await tenantDb().leavingCertificate.findUnique({
      where: { studentId: input.studentId },
    });
    if (!cert) throw new StudentError("NOT_FOUND", "No certificate record found in the vault.");
    if (cert.status === "HANDED_OVER") {
      throw new StudentError("FORBIDDEN", "This certificate has already been handed over!");
    }

    const row = await tenantDb().leavingCertificate.update({
      where: { studentId: input.studentId },
      data: {
        status: "HANDED_OVER",
        handedOverTo: input.handedOverTo,
        handedOverAt: new Date(),
        handedOverById: user.id,
        handedOverByName: user.fullName,
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "student.certificate_handed_over", entityType: "leavingCertificate", entityId: row.id,
        metadata: JSON.stringify({ recipient: input.handedOverTo, by: user.fullName }),
      },
    });

    return row;
  });
}

/** Get a student's leaving certificate record */
export async function getLeavingCertificate(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().leavingCertificate.findUnique({ where: { studentId } });
  });
}
