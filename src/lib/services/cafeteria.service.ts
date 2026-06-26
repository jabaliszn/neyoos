/**
 * B.19 Cafeteria — weekly meal plan, food inventory (REUSES the B.18 Kitchen
 * Store — one stock truth, no double entry), student meal cards BILLED TO
 * THE STUDENT'S INVOICE on issue (founder rule), and kitchen management
 * (issue food against a meal, see today's headcount per meal).
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { nextTenantId } from "@/lib/services/identity.service";
import { stockOut } from "@/lib/services/inventory.service";
import type { SessionUser } from "@/lib/core/session";

export class CafeteriaError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "INVALID" | "ALREADY", message: string) {
    super(message);
    this.name = "CafeteriaError";
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
// Flexible meal model (I.18)
// ---------------------------------------------------------------------------

export type CafeteriaMealModel = "HYBRID" | "CARDS_ONLY" | "BOARDING_GROUPS" | "NO_CARDS";
export type CafeteriaMealScope = "ALL" | "LUNCH" | "SUPPER";

function normalizeMealModel(value: string): CafeteriaMealModel {
  return (["HYBRID", "CARDS_ONLY", "BOARDING_GROUPS", "NO_CARDS"] as const).includes(value as CafeteriaMealModel)
    ? value as CafeteriaMealModel
    : "HYBRID";
}

function normalizeMealScope(value: string): CafeteriaMealScope {
  return (["ALL", "LUNCH", "SUPPER"] as const).includes(value as CafeteriaMealScope)
    ? value as CafeteriaMealScope
    : "ALL";
}

export async function cafeteriaPolicy(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { cafeteriaMealModel: true, cafeteriaMealScope: true, cafeteriaTableSize: true },
    });
    return {
      mealModel: normalizeMealModel(tenant.cafeteriaMealModel),
      mealScope: normalizeMealScope(tenant.cafeteriaMealScope),
      tableSize: tenant.cafeteriaTableSize,
      mealCardsEnabled: normalizeMealModel(tenant.cafeteriaMealModel) !== "NO_CARDS" && normalizeMealModel(tenant.cafeteriaMealModel) !== "BOARDING_GROUPS",
    };
  });
}

export async function setCafeteriaPolicy(user: SessionUser, input: { mealModel: CafeteriaMealModel; mealScope: CafeteriaMealScope }) {
  return withTenant(user.tenantId, async () => {
    const mealModel = normalizeMealModel(input.mealModel);
    const mealScope = normalizeMealScope(input.mealScope);
    const row = await db.tenant.update({
      where: { id: user.tenantId },
      data: { cafeteriaMealModel: mealModel, cafeteriaMealScope: mealScope },
      select: { cafeteriaMealModel: true, cafeteriaMealScope: true, cafeteriaTableSize: true },
    });
    await audit(user, "cafeteria.policy_updated", "tenant", user.tenantId, { mealModel, mealScope });
    return {
      mealModel: normalizeMealModel(row.cafeteriaMealModel),
      mealScope: normalizeMealScope(row.cafeteriaMealScope),
      tableSize: row.cafeteriaTableSize,
      mealCardsEnabled: mealModel !== "NO_CARDS" && mealModel !== "BOARDING_GROUPS",
    };
  });
}

// ---------------------------------------------------------------------------
// Meal planning (B.19.1)
// ---------------------------------------------------------------------------

export async function weekMenu(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().mealPlanEntry.findMany({ orderBy: [{ dayOfWeek: "asc" }] });
    return rows.map((r) => ({ id: r.id, dayOfWeek: r.dayOfWeek, mealType: r.mealType, menu: r.menu }));
  });
}

export async function setMenuEntry(user: SessionUser, input: { dayOfWeek: number; mealType: string; menu: string }) {
  return withTenant(user.tenantId, async () => {
    const row = await db.mealPlanEntry.upsert({
      where: { tenantId_dayOfWeek_mealType: { tenantId: user.tenantId, dayOfWeek: input.dayOfWeek, mealType: input.mealType } },
      create: { tenantId: user.tenantId, dayOfWeek: input.dayOfWeek, mealType: input.mealType, menu: input.menu },
      update: { menu: input.menu },
    });
    await audit(user, "cafeteria.menu_set", "mealPlanEntry", row.id, input);
    return row;
  });
}

// ---------------------------------------------------------------------------
// Food inventory (B.19.2) — the Kitchen Store view (B.18 reuse, no new tables)
// ---------------------------------------------------------------------------

export async function kitchenStock(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const kitchen = await tenantDb().store.findFirst({ where: { name: { contains: "Kitchen" }, archived: false } });
    if (!kitchen) return { storeId: null, items: [] as { id: string; name: string; qty: number; unit: string; low: boolean }[] };
    const items = await tenantDb().stockItem.findMany({
      where: { storeId: kitchen.id, archived: false },
      orderBy: { name: "asc" },
    });
    return {
      storeId: kitchen.id,
      items: items.map((i) => ({
        id: i.id, name: i.name, qty: i.qty, unit: i.unit,
        low: i.reorderLevel > 0 && i.qty <= i.reorderLevel,
      })),
    };
  });
}

/** Kitchen issues food for a meal — wraps the B.18 stockOut (one stock truth). */
export async function issueForMeal(user: SessionUser, input: { itemId: string; qty: number; meal: string }) {
  return stockOut(user, { itemId: input.itemId, qty: input.qty, reason: `Kitchen — ${input.meal}` });
}

// ---------------------------------------------------------------------------
// Student meal cards (B.19.3) — FOUNDER RULE: billed on issue
// ---------------------------------------------------------------------------

export async function listCards(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const cards = await tenantDb().mealCard.findMany({ orderBy: { issuedAt: "desc" }, take: 100 });
    const invoiceIds = cards.map((c) => c.invoiceId);
    const invoices = invoiceIds.length
      ? await tenantDb().invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, status: true, invoiceNo: true } })
      : [];
    const iMap = new Map(invoices.map((i) => [i.id, i]));
    return cards.map((c) => ({
      id: c.id, cardNo: c.cardNo, studentName: c.studentName, admissionNo: c.admissionNo,
      planName: c.planName, meals: JSON.parse(c.meals) as string[],
      termFeeKes: c.termFeeKes, active: c.active,
      invoiceNo: iMap.get(c.invoiceId)?.invoiceNo ?? "—",
      invoiceStatus: iMap.get(c.invoiceId)?.status ?? "—",
    }));
  });
}

export async function issueCard(
  user: SessionUser,
  input: { studentId: string; meals: string[]; termFeeKes: number; year: number; term: number }
) {
  return withTenant(user.tenantId, async () => {
    const student = await tenantDb().student.findFirst({ where: { id: input.studentId, status: "ACTIVE", deletedAt: null } });
    if (!student) throw new CafeteriaError("NOT_FOUND", "Student not found (or not active)." );
    const policy = await cafeteriaPolicy(user);
    if (!policy.mealCardsEnabled) throw new CafeteriaError("INVALID", "Meal cards are disabled by the school's cafeteria model.");
    if (policy.mealScope === "LUNCH" && input.meals.some((m) => m !== "LUNCH")) throw new CafeteriaError("INVALID", "This school currently allows lunch meal cards only.");
    if (policy.mealScope === "SUPPER" && input.meals.some((m) => m !== "SUPPER")) throw new CafeteriaError("INVALID", "This school currently allows supper meal cards only.");

    const planName = `${input.meals.map((m) => m.charAt(0) + m.slice(1).toLowerCase()).join(" + ")} plan — Term ${input.term} ${input.year}`;
    const dup = await tenantDb().mealCard.findFirst({ where: { studentId: student.id, year: input.year, term: input.term, active: true } });
    if (dup) throw new CafeteriaError("ALREADY", `${student.firstName} already has an active card this term (${dup.cardNo}). Cancel it first.`);

    // FOUNDER RULE: bill the invoice FIRST — no card without a ledger entry.
    const invoiceNo = await nextTenantId(user.tenantId, "INVOICE");
    const due = new Date(Date.now() + 3 * 3600_000 + 14 * 24 * 3600_000).toISOString().slice(0, 10);
    const invoice = await db.invoice.create({
      data: {
        tenantId: user.tenantId, invoiceNo, studentId: student.id,
        description: `Meals — ${planName}`,
        totalKes: input.termFeeKes, dueDate: due, status: "UNPAID",
        year: input.year, term: input.term,
      },
    });

    const count = await tenantDb().mealCard.count();
    const cardNo = `MC${count + 1}`;
    const card = await db.mealCard.create({
      data: {
        tenantId: user.tenantId, cardNo, studentId: student.id,
        studentName: fullName(student), admissionNo: student.admissionNo,
        planName, meals: JSON.stringify(input.meals), termFeeKes: input.termFeeKes,
        invoiceId: invoice.id, year: input.year, term: input.term,
      },
    });
    await audit(user, "cafeteria.card_issued", "mealCard", card.id, { cardNo, student: card.studentName, planName, invoiceNo, termFeeKes: input.termFeeKes });
    return { cardId: card.id, cardNo, invoiceId: invoice.id, invoiceNo, planName, studentName: card.studentName };
  });
}

export async function cancelCard(user: SessionUser, cardId: string) {
  return withTenant(user.tenantId, async () => {
    const card = await tenantDb().mealCard.findUnique({ where: { id: cardId } });
    if (!card) throw new CafeteriaError("NOT_FOUND", "Card not found.");
    if (!card.active) throw new CafeteriaError("ALREADY", "Card is already cancelled.");
    const row = await tenantDb().mealCard.update({ where: { id: cardId }, data: { active: false, cancelledAt: new Date() } });
    await audit(user, "cafeteria.card_cancelled", "mealCard", cardId, { cardNo: card.cardNo });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Kitchen management (B.19.4) — today's headcount per meal + low stock
// ---------------------------------------------------------------------------

export async function kitchenToday(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const cards = await tenantDb().mealCard.findMany({ where: { active: true } });
    const headcount: Record<string, number> = { BREAKFAST: 0, LUNCH: 0, SUPPER: 0 };
    for (const c of cards) {
      for (const m of JSON.parse(c.meals) as string[]) headcount[m] = (headcount[m] ?? 0) + 1;
    }
    // Boarders eat all meals regardless of cards (boarding fee covers meals).
    const boarders = await tenantDb().hostelAllocation.count({ where: { releasedAt: null } });

    const nairobiNow = new Date(Date.now() + 3 * 3600_000);
    const jsDay = nairobiNow.getUTCDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    const todayMenu = await tenantDb().mealPlanEntry.findMany({ where: { dayOfWeek } });

    const stock = await kitchenStock(user);

    // B.21 link: FOOD-allergy register for the kitchen crew (safety board).
    const { allergyRegister } = await import("@/lib/services/clinic.service");
    const allergic = await allergyRegister(user).catch(() => []);

    return {
      dayOfWeek,
      todayMenu: todayMenu.map((m) => ({ mealType: m.mealType, menu: m.menu })),
      headcount: {
        BREAKFAST: headcount.BREAKFAST + boarders,
        LUNCH: headcount.LUNCH + boarders,
        SUPPER: headcount.SUPPER + boarders,
      },
      dayScholarsWithCards: cards.length,
      boarders,
      lowStock: stock.items.filter((i) => i.low),
      foodAllergies: allergic.map((a) => ({ studentName: a.studentName, className: a.className, allergies: a.allergies })),
    };
  });
}

// ---------------------------------------------------------------------------
// H.5 Cafeteria Table Allocation
// Seat students per CLASS (never mixed across classes/streams) at tables of a
// chosen size, for a meal session (LUNCH | SUPPER). Idempotent per session.
// ---------------------------------------------------------------------------

type Session = "LUNCH" | "SUPPER";

function classLabelOf(cls: { level: string; stream: string | null }) {
  return [cls.level, cls.stream].filter(Boolean).join(" ");
}

/**
 * Allocate dining tables for a meal session. For each non-archived class, the
 * active learners are chunked into tables of `tableSize` (last table may be
 * partial). Re-running replaces the previous plan for that session and stores
 * the chosen size as the school default. Returns the seating board.
 */
export async function allocateCafeteriaTables(
  user: SessionUser,
  input: { session: Session; tableSize: number }
) {
  return withTenant(user.tenantId, async () => {
    const size = Math.trunc(input.tableSize);
    if (!Number.isFinite(size) || size < 2 || size > 50) {
      throw new CafeteriaError("INVALID", "Table size must be between 2 and 50 seats.");
    }
    if (input.session !== "LUNCH" && input.session !== "SUPPER") {
      throw new CafeteriaError("INVALID", "Session must be LUNCH or SUPPER.");
    }

    const classes = await tenantDb().schoolClass.findMany({
      where: { archived: false },
      orderBy: [{ level: "asc" }, { stream: "asc" }],
    });

    // Wipe any previous plan for this session — re-allocation is idempotent.
    await db.cafeteriaTable.deleteMany({ where: { tenantId: user.tenantId, session: input.session } });

    let tablesCreated = 0;
    let seatedStudents = 0;
    for (const cls of classes) {
      const students = await tenantDb().student.findMany({
        where: { classId: cls.id, status: "ACTIVE", deletedAt: null },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
      if (students.length === 0) continue;
      const label = classLabelOf(cls);
      let tableNo = 0;
      for (let i = 0; i < students.length; i += size) {
        tableNo++;
        const group = students.slice(i, i + size).map((s) => ({
          id: s.id,
          name: fullName(s),
          admNo: s.admissionNo,
        }));
        await db.cafeteriaTable.create({
          data: {
            tenantId: user.tenantId,
            session: input.session,
            classId: cls.id,
            classLabel: label,
            tableNo,
            seats: size,
            studentsJson: JSON.stringify(group),
          },
        });
        tablesCreated++;
        seatedStudents += group.length;
      }
    }

    // Remember the chosen size as the school default.
    await db.tenant.update({ where: { id: user.tenantId }, data: { cafeteriaTableSize: size } });
    await audit(user, "cafeteria.tables_allocated", "tenant", user.tenantId, {
      session: input.session, tableSize: size, tablesCreated, seatedStudents,
    });

    return tableBoard(user, input.session);
  });
}

/** Read the seating plan for a session, grouped by class. */
export async function tableBoard(user: SessionUser, session: Session) {
  return withTenant(user.tenantId, async () => {
    const tenant = await tenantDb().tenant.findUnique({ where: { id: user.tenantId } });
    const rows = await tenantDb().cafeteriaTable.findMany({
      where: { session },
      orderBy: [{ classLabel: "asc" }, { tableNo: "asc" }],
    });
    const byClass = new Map<string, { classLabel: string; tables: { tableNo: number; seats: number; students: { id: string; name: string; admNo: string }[] }[] }>();
    for (const r of rows) {
      const entry = byClass.get(r.classId) ?? { classLabel: r.classLabel, tables: [] };
      entry.tables.push({ tableNo: r.tableNo, seats: r.seats, students: JSON.parse(r.studentsJson) });
      byClass.set(r.classId, entry);
    }
    return {
      session,
      tableSize: tenant?.cafeteriaTableSize ?? 8,
      totalTables: rows.length,
      totalSeated: rows.reduce((n, r) => n + (JSON.parse(r.studentsJson) as unknown[]).length, 0),
      classes: Array.from(byClass.values()),
    };
  });
}

/** Clear the seating plan for a session. */
export async function clearCafeteriaTables(user: SessionUser, session: Session) {
  return withTenant(user.tenantId, async () => {
    const res = await db.cafeteriaTable.deleteMany({ where: { tenantId: user.tenantId, session } });
    await audit(user, "cafeteria.tables_cleared", "tenant", user.tenantId, { session, removed: res.count });
    return { cleared: res.count };
  });
}

// ---------------------------------------------------------------------------
// I.19 — Cafeteria meal serving queue
// ---------------------------------------------------------------------------

type QueueSession = "BREAKFAST" | "LUNCH" | "SUPPER";

function todayYmd() {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

export async function queueBoard(user: SessionUser, input: { date?: string; session: QueueSession }) {
  return withTenant(user.tenantId, async () => {
    const date = input.date || todayYmd();
    const rows = await tenantDb().cafeteriaQueueEntry.findMany({
      where: { date, session: input.session },
      orderBy: [{ queueNo: "asc" }],
    });
    return {
      date,
      session: input.session,
      waiting: rows.filter((r) => r.status === "WAITING").length,
      served: rows.filter((r) => r.status === "SERVED").length,
      cancelled: rows.filter((r) => r.status === "CANCELLED").length,
      rows: rows.map((r) => ({
        id: r.id,
        queueNo: r.queueNo,
        studentId: r.studentId,
        studentName: r.studentName,
        admissionNo: r.admissionNo,
        classLabel: r.classLabel,
        status: r.status,
        joinedAt: r.joinedAt,
        servedAt: r.servedAt,
        servedByName: r.servedByName,
      })),
    };
  });
}

export async function joinMealQueue(user: SessionUser, input: { studentId: string; date?: string; session: QueueSession }) {
  return withTenant(user.tenantId, async () => {
    const date = input.date || todayYmd();
    const student = await tenantDb().student.findFirst({
      where: { id: input.studentId, status: "ACTIVE", deletedAt: null },
      include: { schoolClass: true },
    });
    if (!student) throw new CafeteriaError("NOT_FOUND", "Student not found or inactive.");

    const existing = await tenantDb().cafeteriaQueueEntry.findFirst({
      where: { date, session: input.session, studentId: student.id },
    });
    if (existing) throw new CafeteriaError("ALREADY", `${fullName(student)} is already in the ${input.session.toLowerCase()} queue.`);

    const last = await tenantDb().cafeteriaQueueEntry.findFirst({
      where: { date, session: input.session },
      orderBy: { queueNo: "desc" },
      select: { queueNo: true },
    });
    const queueNo = (last?.queueNo ?? 0) + 1;
    const row = await db.cafeteriaQueueEntry.create({
      data: {
        tenantId: user.tenantId,
        date,
        session: input.session,
        queueNo,
        studentId: student.id,
        studentName: fullName(student),
        admissionNo: student.admissionNo,
        classLabel: student.schoolClass ? classLabelOf(student.schoolClass) : null,
      },
    });
    await audit(user, "cafeteria.queue_joined", "cafeteriaQueueEntry", row.id, { queueNo, session: input.session, date });
    return row;
  });
}

export async function serveMealQueue(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().cafeteriaQueueEntry.findUnique({ where: { id } });
    if (!row) throw new CafeteriaError("NOT_FOUND", "Queue entry not found.");
    if (row.status !== "WAITING") throw new CafeteriaError("ALREADY", "This learner is no longer waiting in the queue.");
    const updated = await tenantDb().cafeteriaQueueEntry.update({
      where: { id },
      data: { status: "SERVED", servedAt: new Date(), servedById: user.id, servedByName: user.fullName } as never,
    });
    await audit(user, "cafeteria.queue_served", "cafeteriaQueueEntry", id, { queueNo: row.queueNo, session: row.session, date: row.date });
    return updated;
  });
}

export async function cancelMealQueue(user: SessionUser, id: string) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().cafeteriaQueueEntry.findUnique({ where: { id } });
    if (!row) throw new CafeteriaError("NOT_FOUND", "Queue entry not found.");
    if (row.status !== "WAITING") throw new CafeteriaError("ALREADY", "This learner is no longer waiting in the queue.");
    const updated = await tenantDb().cafeteriaQueueEntry.update({ where: { id }, data: { status: "CANCELLED" } as never });
    await audit(user, "cafeteria.queue_cancelled", "cafeteriaQueueEntry", id, { queueNo: row.queueNo, session: row.session, date: row.date });
    return updated;
  });
}
