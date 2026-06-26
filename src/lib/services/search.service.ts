/**
 * Global search service (Feature A.11).
 * Tenant-scoped search across the main entities that exist so far. Uses
 * case-insensitive LIKE/contains today (works on SQLite). In production on
 * Postgres, swap to tsvector + GIN (see prisma/rls/search.sql) for ranking +
 * speed — the API/UI contract is unchanged.
 *
 * As business modules land (B.1 students, B.7 invoices, ...), register them
 * in `searchEntities` below and they appear in Cmd+K automatically.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { ROLE_LABELS, type Role } from "@/lib/core/roles";
import { can } from "@/lib/core/permissions";
import { NAVIGATION } from "@/lib/core/navigation";
import { getEnabledModuleKeys } from "@/lib/services/module.service";
import { getNavVisibility, isHiddenFor } from "@/lib/services/nav-visibility.service";
import { scopeWhere } from "@/lib/services/student.service";
import type { SessionUser } from "@/lib/core/session";

export interface SearchHit {
  type: string; // "person" | "student" | "conversation" | "payment" ...
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const LIMIT_PER_TYPE = 5;
const MODULE_ALIASES: Record<string, string[]> = {
  "/library": ["books", "borrow", "fines", "barcode", "isbn"],
  "/transport": ["bus", "buses", "routes", "drivers", "vehicles"],
  "/finance": ["fees", "invoices", "payments", "mpesa", "arrears"],
  "/inventory": ["stores", "stock", "assets", "suppliers", "procurement", "expenses"],
  "/cafeteria": ["meals", "food", "menu", "lunch", "supper"],
  "/hostel": ["dorm", "boarding", "beds", "curfew"],
  "/clinic": ["medical", "sick bay", "allergies", "nurse"],
  "/exams": ["marks", "results", "report cards", "positions"],
};

/** Run a tenant-scoped search. Returns grouped, capped hits.
 *  Pass the session `user` so per-role row-scoping applies (students:
 *  TEACHER = own classes only, PARENT = own children only — A.3.8/9). */
export async function search(
  tenantId: string,
  rawQuery: string,
  user?: SessionUser
): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  return withTenant(tenantId, async () => {
    const tdb = tenantDb();
    const hits: SearchHit[] = [];

    // --- Modules / pages (I.30) — permission, module and visibility aware. ---
    if (user) {
      const enabledModules = await getEnabledModuleKeys(tenantId);
      const hiddenMap = await getNavVisibility(tenantId);
      const userCan = (perm?: string) => {
        if (!perm) return true;
        return can(user.role as Role, perm as never) || (user.secondaryRole ? can(user.secondaryRole as Role, perm as never) : false);
      };
      const moduleItems = NAVIGATION.flatMap((section) =>
        section.items.map((item) => ({ ...item, section: section.title }))
      ).filter((item) => {
        const hay = [item.label, item.href, item.section, item.moduleKey ?? "", item.permission ?? "", ...(MODULE_ALIASES[item.href] ?? [])].join(" ").toLowerCase();
        return (
          hay.includes(q.toLowerCase()) &&
          (!item.moduleKey || enabledModules.has(item.moduleKey)) &&
          userCan(item.permission) &&
          !isHiddenFor(hiddenMap, item.href, user.role, user.secondaryRole)
        );
      }).slice(0, LIMIT_PER_TYPE);
      for (const item of moduleItems) {
        hits.push({
          type: "module",
          id: item.href,
          title: item.label,
          subtitle: `${item.section} module · ${item.href}`,
          href: item.href,
        });
      }
    }

    // --- Students (B.1) — row-scoped + permission-gated ---
    if (user && can(user.role as Role, "student.view")) {
      const scope = await scopeWhere(user);
      const digits = q.replace(/[\s\-()]/g, "");
      const nameOr: Record<string, unknown>[] = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { middleName: { contains: q } },
        { admissionNo: { contains: q } },
        { legacyAdmissionNo: { contains: q } },
      ];
      if (/^\+?\d{4,}$/.test(digits)) {
        const candidates = new Set<string>([digits]);
        if (digits.startsWith("0")) candidates.add("+254" + digits.slice(1));
        if (digits.startsWith("254")) candidates.add("+" + digits);
        if (/^[17]/.test(digits)) candidates.add("+254" + digits);
        nameOr.push({
          guardians: {
            some: { guardian: { OR: [...candidates].map((c) => ({ phone: { contains: c } })) } },
          },
        });
      }
      const students = await tdb.student.findMany({
        where: { AND: [scope, { OR: nameOr }] },
        take: LIMIT_PER_TYPE,
        include: { schoolClass: true },
      });
      for (const s of students) {
        const cls = s.schoolClass ? [s.schoolClass.level, s.schoolClass.stream].filter(Boolean).join(" ") : null;
        hits.push({
          type: "student",
          id: s.id,
          title: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
          subtitle: `${s.legacyAdmissionNo ? `${s.legacyAdmissionNo} · ` : ""}${s.admissionNo}${cls ? " · " + cls : ""}`,
          href: `/students/${s.id}`,
        });
      }
    }

    // --- People (users) ---
    const users = await tdb.user.findMany({
      where: {
        OR: [
          { fullName: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { neyoLoginId: { contains: q } },
        ],
      },
      take: LIMIT_PER_TYPE,
      select: { id: true, fullName: true, role: true, phone: true },
    });
    for (const u of users) {
      hits.push({
        type: "person",
        id: u.id,
        title: u.fullName,
        subtitle: `${ROLE_LABELS[u.role as Role] ?? u.role}${u.phone ? " · " + u.phone : ""}`,
        href: "/staff",
      });
    }

    // --- Payments ---
    const payments = await tdb.payment.findMany({
      where: {
        OR: [
          { accountRef: { contains: q } },
          { phone: { contains: q } },
          { mpesaRef: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: LIMIT_PER_TYPE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        accountRef: true,
        amount: true,
        status: true,
        mpesaRef: true,
      },
    });
    for (const p of payments) {
      hits.push({
        type: "payment",
        id: p.id,
        title: `${p.accountRef ?? "Payment"} — KES ${p.amount.toLocaleString("en-KE")}`,
        subtitle: `${p.status}${p.mpesaRef ? " · " + p.mpesaRef : ""}`,
        href: "/finance/payments",
      });
    }

    // --- Conversations (by title; only ones the user is in is enforced at UI/route
    //     level; here we keep it tenant-scoped which is acceptable for search) ---
    const convos = await tdb.conversation.findMany({
      where: { title: { contains: q } },
      take: LIMIT_PER_TYPE,
      select: { id: true, title: true, type: true },
    });
    for (const c of convos) {
      hits.push({
        type: "conversation",
        id: c.id,
        title: c.title ?? "Conversation",
        subtitle: c.type === "ANNOUNCEMENT" ? "Announcement" : "Conversation",
        href: `/messages?c=${c.id}`,
      });
    }

    return hits;
  });
}

/** Lightweight type-ahead: same as search but trims to a tighter cap. */
export async function typeahead(
  tenantId: string,
  q: string,
  user?: SessionUser
): Promise<SearchHit[]> {
  const all = await search(tenantId, q, user);
  return all.slice(0, 8);
}

void db; // reserved for future raw tsvector queries on Postgres
