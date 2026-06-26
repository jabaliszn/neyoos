/**
 * B.16 Hostel — dorm registration, room + bed allocation (gender-checked,
 * capacity-enforced), nightly curfew register (IN/OUT/LEAVE w/ instant
 * guardian SMS for missing boarders), per-term boarding-fee invoicing
 * (idempotent, wires into B.7), and boarder visitor tracking (A.18 VisitorLog).
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { sendSms } from "@/lib/notifications/sms";
import { checkSmsQuota, recordUsage } from "@/lib/services/limits.service";
import { nextTenantId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";

export class HostelError extends Error {
  constructor(
    public code: "NOT_FOUND" | "DUPLICATE" | "FULL" | "GENDER" | "ALREADY" | "INVALID",
    message: string
  ) {
    super(message);
    this.name = "HostelError";
  }
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType, entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

const fullName = (s: { firstName: string; middleName: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Hostels + rooms
// ---------------------------------------------------------------------------

export async function listHostels(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const hostels = await tenantDb().hostel.findMany({
      where: { archived: false },
      include: { rooms: { include: { allocations: { where: { releasedAt: null } } } } },
      orderBy: { name: "asc" },
    });
    const masterIds = hostels.map((h) => h.masterId).filter((x): x is string => Boolean(x));
    const masters = masterIds.length
      ? await tenantDb().user.findMany({ where: { id: { in: masterIds } }, select: { id: true, fullName: true } })
      : [];
    const mMap = new Map(masters.map((m) => [m.id, m.fullName]));
    return hostels.map((h) => {
      const beds = h.rooms.reduce((a, r) => a + r.capacity, 0);
      const occupied = h.rooms.reduce((a, r) => a + r.allocations.length, 0);
      return {
        id: h.id, name: h.name, gender: h.gender,
        masterId: h.masterId, masterName: h.masterId ? mMap.get(h.masterId) ?? null : null,
        boardingFeeKes: h.boardingFeeKes,
        rooms: h.rooms.length, beds, occupied, free: beds - occupied,
      };
    });
  });
}

export async function createHostel(user: SessionUser, input: { name: string; gender: string; masterId?: string; boardingFeeKes: number }) {
  return withTenant(user.tenantId, async () => {
    const dup = await tenantDb().hostel.findFirst({ where: { name: input.name, archived: false } });
    if (dup) throw new HostelError("DUPLICATE", "A hostel with that name already exists.");
    const h = await db.hostel.create({
      data: {
        tenantId: user.tenantId, name: input.name, gender: input.gender,
        masterId: input.masterId ?? null, boardingFeeKes: input.boardingFeeKes,
      },
    });
    await audit(user, "hostel.created", "hostel", h.id, { name: input.name, gender: input.gender });
    return h;
  });
}

export async function addRoom(user: SessionUser, input: { hostelId: string; name: string; capacity: number }) {
  return withTenant(user.tenantId, async () => {
    const hostel = await tenantDb().hostel.findUnique({ where: { id: input.hostelId } });
    if (!hostel) throw new HostelError("NOT_FOUND", "Hostel not found.");
    const dup = await tenantDb().hostelRoom.findFirst({ where: { hostelId: input.hostelId, name: input.name } });
    if (dup) throw new HostelError("DUPLICATE", `${hostel.name} already has a "${input.name}".`);
    const room = await db.hostelRoom.create({
      data: { tenantId: user.tenantId, hostelId: input.hostelId, name: input.name, capacity: input.capacity },
    });
    await audit(user, "hostel.room_added", "hostelRoom", room.id, { hostel: hostel.name, room: input.name, capacity: input.capacity });
    return room;
  });
}

/** Rooms of a hostel with bed-level occupancy (who's in which bed). */
export async function roomBoard(user: SessionUser, hostelId: string) {
  return withTenant(user.tenantId, async () => {
    const hostel = await tenantDb().hostel.findUnique({ where: { id: hostelId } });
    if (!hostel) throw new HostelError("NOT_FOUND", "Hostel not found.");
    const rooms = await tenantDb().hostelRoom.findMany({
      where: { hostelId },
      include: { allocations: { where: { releasedAt: null }, orderBy: { bedNo: "asc" } } },
      orderBy: { name: "asc" },
    });
    return {
      hostel: { id: hostel.id, name: hostel.name, gender: hostel.gender, boardingFeeKes: hostel.boardingFeeKes },
      rooms: rooms.map((r) => ({
        id: r.id, name: r.name, capacity: r.capacity,
        beds: Array.from({ length: r.capacity }, (_, i) => {
          const a = r.allocations.find((x) => x.bedNo === i + 1);
          return a
            ? { bedNo: i + 1, allocationId: a.id, studentId: a.studentId, studentName: a.studentName, admissionNo: a.admissionNo }
            : { bedNo: i + 1, allocationId: null, studentId: null, studentName: null, admissionNo: null };
        }),
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Allocation (room + bed)
// ---------------------------------------------------------------------------

export async function allocateBed(user: SessionUser, input: { roomId: string; studentId: string; bedNo?: number }) {
  return withTenant(user.tenantId, async () => {
    const room = await tenantDb().hostelRoom.findUnique({
      where: { id: input.roomId },
      include: { hostel: true, allocations: { where: { releasedAt: null } } },
    });
    if (!room) throw new HostelError("NOT_FOUND", "Room not found.");

    const student = await tenantDb().student.findFirst({
      where: { id: input.studentId, status: "ACTIVE", deletedAt: null },
    });
    if (!student) throw new HostelError("NOT_FOUND", "Student not found (or not active).");

    // Gender check (real Kenyan boarding rule).
    if (room.hostel.gender === "BOYS" && student.gender !== "M")
      throw new HostelError("GENDER", `${room.hostel.name} is a boys' hostel.`);
    if (room.hostel.gender === "GIRLS" && student.gender !== "F")
      throw new HostelError("GENDER", `${room.hostel.name} is a girls' hostel.`);

    // One bed per student anywhere.
    const existing = await tenantDb().hostelAllocation.findFirst({ where: { studentId: student.id, releasedAt: null } });
    if (existing) throw new HostelError("ALREADY", "This student already has a bed. Release it first to move them.");

    // Bed pick: requested or first free.
    const taken = new Set(room.allocations.map((a) => a.bedNo));
    let bedNo = input.bedNo;
    if (bedNo) {
      if (bedNo > room.capacity) throw new HostelError("INVALID", `Room ${room.name} has only ${room.capacity} beds.`);
      if (taken.has(bedNo)) throw new HostelError("FULL", `Bed ${bedNo} is taken.`);
    } else {
      bedNo = Array.from({ length: room.capacity }, (_, i) => i + 1).find((n) => !taken.has(n));
      if (!bedNo) throw new HostelError("FULL", `Room ${room.name} is full (${room.capacity} beds).`);
    }

    const alloc = await db.hostelAllocation.create({
      data: {
        tenantId: user.tenantId, roomId: room.id, studentId: student.id,
        studentName: fullName(student), admissionNo: student.admissionNo, bedNo,
      },
    });
    await audit(user, "hostel.allocated", "hostelAllocation", alloc.id, {
      hostel: room.hostel.name, room: room.name, bed: bedNo, student: alloc.studentName,
    });
    return alloc;
  });
}

export async function releaseBed(user: SessionUser, allocationId: string) {
  return withTenant(user.tenantId, async () => {
    const alloc = await tenantDb().hostelAllocation.findUnique({ where: { id: allocationId }, include: { room: true } });
    if (!alloc) throw new HostelError("NOT_FOUND", "Allocation not found.");
    if (alloc.releasedAt) throw new HostelError("ALREADY", "That bed was already released.");
    const row = await tenantDb().hostelAllocation.update({ where: { id: allocationId }, data: { releasedAt: new Date() } });
    await audit(user, "hostel.released", "hostelAllocation", allocationId, { student: alloc.studentName, room: alloc.room.name });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Curfew register (B.16.4 — also ticks B.3 "Hostel attendance")
// ---------------------------------------------------------------------------

/** The curfew sheet: every current boarder of a hostel + tonight's mark. */
export async function curfewSheet(user: SessionUser, hostelId: string, date: string) {
  return withTenant(user.tenantId, async () => {
    const hostel = await tenantDb().hostel.findUnique({ where: { id: hostelId }, include: { rooms: true } });
    if (!hostel) throw new HostelError("NOT_FOUND", "Hostel not found.");
    const allocations = await tenantDb().hostelAllocation.findMany({
      where: { roomId: { in: hostel.rooms.map((r) => r.id) }, releasedAt: null },
      include: { room: true },
      orderBy: [{ bedNo: "asc" }],
    });
    const marks = await tenantDb().hostelAttendance.findMany({
      where: { date, studentId: { in: allocations.map((a) => a.studentId) } },
    });
    const mMap = new Map(marks.map((m) => [m.studentId, m]));
    return {
      hostel: { id: hostel.id, name: hostel.name },
      date,
      boarders: allocations
        .sort((a, b) => a.room.name.localeCompare(b.room.name) || a.bedNo - b.bedNo)
        .map((a) => ({
          studentId: a.studentId, studentName: a.studentName, admissionNo: a.admissionNo,
          room: a.room.name, bedNo: a.bedNo,
          status: mMap.get(a.studentId)?.status ?? null,
          note: mMap.get(a.studentId)?.note ?? null,
        })),
      markedCount: marks.length,
    };
  });
}

/** Mark curfew (idempotent upsert) + SMS guardians of OUT boarders immediately. */
export async function markCurfew(
  user: SessionUser,
  input: { hostelId: string; date: string; marks: { studentId: string; status: string; note?: string }[] }
) {
  return withTenant(user.tenantId, async () => {
    const hostel = await tenantDb().hostel.findUnique({ where: { id: input.hostelId }, include: { rooms: true } });
    if (!hostel) throw new HostelError("NOT_FOUND", "Hostel not found.");

    // Only current boarders of THIS hostel can be marked (defense in depth).
    const allowed = new Set(
      (await tenantDb().hostelAllocation.findMany({
        where: { roomId: { in: hostel.rooms.map((r) => r.id) }, releasedAt: null },
        select: { studentId: true },
      })).map((a) => a.studentId)
    );

    let saved = 0;
    const newlyOut: string[] = [];
    for (const m of input.marks) {
      if (!allowed.has(m.studentId)) continue;
      const prev = await tenantDb().hostelAttendance.findUnique({
        where: { tenantId_studentId_date: { tenantId: user.tenantId, studentId: m.studentId, date: input.date } },
      });
      const student = await tenantDb().student.findUnique({ where: { id: m.studentId } });
      if (!student) continue;
      await db.hostelAttendance.upsert({
        where: { tenantId_studentId_date: { tenantId: user.tenantId, studentId: m.studentId, date: input.date } },
        create: {
          tenantId: user.tenantId, studentId: m.studentId, studentName: fullName(student),
          hostelName: hostel.name, date: input.date, status: m.status, note: m.note ?? null,
          markedById: user.id, markedByName: user.fullName,
        },
        update: { status: m.status, note: m.note ?? null, markedById: user.id, markedByName: user.fullName },
      });
      saved++;
      if (m.status === "OUT" && prev?.status !== "OUT") newlyOut.push(m.studentId);
    }

    // URGENT SMS for missing boarders (quota-checked; one per guardian).
    let smsSent = 0;
    if (newlyOut.length > 0) {
      const quota = await checkSmsQuota(user.tenantId, newlyOut.length);
      if (quota.allowed) {
        const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
        for (const sid of newlyOut) {
          const link =
            (await tenantDb().studentGuardian.findFirst({ where: { studentId: sid, isPrimary: true }, include: { guardian: true, student: true } })) ??
            (await tenantDb().studentGuardian.findFirst({ where: { studentId: sid }, include: { guardian: true, student: true } }));
          if (!link?.guardian.phone) continue;
          const msg = `${tenant.name} URGENT: ${link.student.firstName} ${link.student.lastName} was NOT present at ${hostel.name} curfew check tonight (${input.date}). Please contact the school immediately.`;
          try { await sendSms(link.guardian.phone, msg); smsSent++; } catch { /* skip */ }
        }
        if (smsSent > 0) await recordUsage(user.tenantId, "smsPerTerm", smsSent);
      }
    }

    await audit(user, "hostel.curfew_marked", "hostel", input.hostelId, { date: input.date, saved, out: newlyOut.length, smsSent });
    return { saved, out: newlyOut.length, smsSent };
  });
}

// ---------------------------------------------------------------------------
// Boarding fees (B.16.5 — wires into B.7 invoices)
// ---------------------------------------------------------------------------

/** Invoice every current boarder of a hostel for the term's boarding fee. Idempotent. */
export async function invoiceBoarders(user: SessionUser, input: { hostelId: string; year: number; term: number; dueDate: string }) {
  return withTenant(user.tenantId, async () => {
    const hostel = await tenantDb().hostel.findUnique({ where: { id: input.hostelId }, include: { rooms: true } });
    if (!hostel) throw new HostelError("NOT_FOUND", "Hostel not found.");
    if (hostel.boardingFeeKes <= 0) throw new HostelError("INVALID", "Set the hostel's boarding fee first.");

    const boarders = await tenantDb().hostelAllocation.findMany({
      where: { roomId: { in: hostel.rooms.map((r) => r.id) }, releasedAt: null },
    });
    const description = `Boarding — ${hostel.name} — Term ${input.term} ${input.year}`;

    let created = 0;
    let skipped = 0;
    for (const b of boarders) {
      const dup = await tenantDb().invoice.findFirst({ where: { studentId: b.studentId, description } });
      if (dup) { skipped++; continue; }
      const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
      await db.invoice.create({
        data: {
          tenantId: user.tenantId, invoiceNo,
          studentId: b.studentId, description,
          year: input.year, term: input.term,
          totalKes: hostel.boardingFeeKes, dueDate: input.dueDate, status: "UNPAID",
        },
      });
      created++;
    }
    await audit(user, "hostel.boarding_invoiced", "hostel", hostel.id, { term: input.term, year: input.year, created, skipped });
    return { created, skipped, amountKes: hostel.boardingFeeKes, boarders: boarders.length };
  });
}

// ---------------------------------------------------------------------------
// Boarder visitor tracking (B.16.6 — A.18 VisitorLog + studentId link)
// ---------------------------------------------------------------------------

export async function boarderVisitors(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().visitorLog.findMany({
      where: { studentId },
      orderBy: { signedInAt: "desc" },
      take: 30,
    });
    return rows.map((v) => ({
      id: v.id, name: v.name, phone: v.phone, purpose: v.purpose,
      badgeNo: v.badgeNo, signedInAt: v.signedInAt, signedOutAt: v.signedOutAt,
    }));
  });
}

/** 
 * G.16 / B.16 Automated Dorm Placement Engine (H.3).
 * Automatically places unallocated boarder students into available hostel beds.
 * - Checks and blocks Day Scholars (boardingType === "DAY") from allocation.
 * - Validates Student Gender against the Hostel's allowed gender.
 * - Strategy: "FORM" (group same-level classes together) | "MIXED" (distribute sequentially).
 */
export async function autoAllocateHostelBeds(
  user: SessionUser,
  hostelId: string,
  strategy: "FORM" | "MIXED"
) {
  return withTenant(user.tenantId, async () => {
    const hostel = await tenantDb().hostel.findUnique({
      where: { id: hostelId },
      include: { rooms: { include: { allocations: { where: { releasedAt: null } } } } },
    });
    if (!hostel) throw new HostelError("NOT_FOUND", "Hostel not found.");

    // Match hostel gender where required. MIXED hostels accept both boys and girls.
    const studentGender = hostel.gender === "BOYS" ? "M" : hostel.gender === "GIRLS" ? "F" : null;

    // Load currently allocated student IDs
    const activeAllocations = await tenantDb().hostelAllocation.findMany({
      where: { releasedAt: null },
      select: { studentId: true },
    });
    const allocatedIds = new Set(activeAllocations.map((a) => a.studentId));

    // Load active boarder students of matching gender (DAY scholars excluded!) (H.3)
    const candidates = await tenantDb().student.findMany({
      where: {
        tenantId: user.tenantId,
        ...(studentGender ? { gender: studentGender } : {}),
        status: "ACTIVE",
        boardingType: "BOARDER", // Exclude day scholars!
        deletedAt: null,
      },
      include: { schoolClass: true },
    });

    const unallocatedStudents = candidates.filter((s) => !allocatedIds.has(s.id));

    if (unallocatedStudents.length === 0) {
      return { success: true, allocatedCount: 0, message: "No unallocated boarders of matching gender found." };
    }

    // Sort students based on strategy.
    // FORM keeps same-level learners together. MIXED round-robins levels so a room
    // can intentionally mix older/younger boarders where the school wants mentorship.
    let sortedStudents = [...unallocatedStudents];
    if (strategy === "FORM") {
      sortedStudents.sort((a, b) => (a.schoolClass?.level || "").localeCompare(b.schoolClass?.level || "") || fullName(a).localeCompare(fullName(b)));
    } else {
      const groups = new Map<string, typeof unallocatedStudents>();
      for (const s of unallocatedStudents) {
        const key = s.schoolClass?.level || "Unassigned";
        const group = groups.get(key) ?? [];
        group.push(s);
        groups.set(key, group);
      }
      for (const group of groups.values()) group.sort((a, b) => fullName(a).localeCompare(fullName(b)));
      sortedStudents = [];
      const orderedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
      let index = 0;
      while (orderedGroups.some((group) => index < group.length)) {
        for (const group of orderedGroups) {
          const student = group[index];
          if (student) sortedStudents.push(student);
        }
        index++;
      }
    }

    let allocatedCount = 0;
    const rooms = [...hostel.rooms].sort((a, b) => a.name.localeCompare(b.name));

    for (const student of sortedStudents) {
      // Find the first room with a free bed
      let placed = false;
      for (const room of rooms) {
        const takenBeds = new Set(room.allocations.map((a) => a.bedNo));
        if (takenBeds.size >= room.capacity) continue; // Room full

        // Find first empty bed index
        const freeBedNo = Array.from({ length: room.capacity }, (_, i) => i + 1).find((n) => !takenBeds.has(n));
        if (!freeBedNo) continue;

        // Create allocation
        const alloc = await db.hostelAllocation.create({
          data: {
            tenantId: user.tenantId,
            roomId: room.id,
            studentId: student.id,
            studentName: fullName(student),
            admissionNo: student.admissionNo,
            bedNo: freeBedNo,
          },
        });

        // Add to active set so next iterations know it's taken
        room.allocations.push(alloc as any);
        allocatedCount++;
        placed = true;
        break;
      }
      if (!placed) {
        break; // All rooms in this hostel are completely full!
      }
    }

    await audit(user, "hostel.auto_allocated", "hostel", hostelId, {
      strategy,
      allocatedCount,
      hostelGender: hostel.gender,
      dayScholarsSkipped: true,
    });

    return { success: true, allocatedCount, totalUnallocatedLeft: unallocatedStudents.length - allocatedCount, strategy, hostelGender: hostel.gender };
  });
}
