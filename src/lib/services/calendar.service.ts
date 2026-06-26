/**
 * Calendar service (A.17).
 * - School events are tenant-scoped (tenantDb) CalendarEvent rows.
 * - These are MERGED with the read-only Kenyan holiday/cultural moments from
 *   A.15 (cultural-calendar.ts) into a single "occurrences" list per range.
 * - Religious moments are included only if the tenant opted in (A.17.3).
 * - iCal export (A.17.4) and audience invites (A.17.5) live here too.
 */
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/core/tenant-db";
import { notify } from "@/lib/services/notification.service";
import {
  KE_MOMENTS,
  type CulturalMoment,
} from "@/lib/i18n/cultural-calendar";
import type { CreateEventInput, UpdateEventInput } from "@/lib/validations/calendar";
import type { Role } from "@/lib/core/roles";

export class CalendarError extends Error {
  constructor(public code: "NOT_FOUND", message: string) {
    super(message);
    this.name = "CalendarError";
  }
}

export interface Occurrence {
  id: string; // event id, or "holiday:MM-DD" for moments
  source: "event" | "holiday";
  title: string;
  date: string; // YYYY-MM-DD
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  type: string;
  description: string | null;
  audienceRole: string | null; // null = whole school
  readonly: boolean; // holidays cannot be edited
  recurring?: "WEEKLY" | "MONTHLY" | null; // B.25: set on every occurrence of a series
  seriesId?: string | null; // the stored CalendarEvent id (same for every occurrence)
}

/**
 * B.25 — expand a recurring event into the concrete start dates that fall
 * inside [from, to]. WEEKLY = same weekday as the first date, every 7 days.
 * MONTHLY = same day-of-month each month (months without that day, e.g. the
 * 31st in February, are skipped — never silently shifted). Bounded by
 * recurUntil and a hard safety cap so a bad range can never run away.
 */
export function expandRecurrence(
  firstDate: string,
  recurrence: "WEEKLY" | "MONTHLY",
  recurUntil: string | null,
  from: string,
  to: string
): string[] {
  const HARD_CAP = 400; // generous: ~7+ years weekly, decades monthly
  const out: string[] = [];
  const hardEnd = recurUntil && recurUntil < to ? recurUntil : to;
  // never generate past the range/until, and never before the series starts
  let cursor = firstDate;
  let guard = 0;
  while (cursor <= hardEnd && guard < HARD_CAP) {
    if (cursor >= from) out.push(cursor);
    cursor = recurrence === "WEEKLY" ? addDaysIso(cursor, 7) : addMonthsSameDom(firstDate, cursor);
    guard++;
  }
  return out;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/**
 * MONTHLY step that ALWAYS lands on the original day-of-month. Walks forward
 * one month at a time from the current cursor; if a month is shorter than the
 * target day (e.g. Feb has no 30th), that month is skipped and we keep going.
 */
function addMonthsSameDom(firstDate: string, cursor: string): string {
  const dom = Number(firstDate.slice(8, 10));
  let y = Number(cursor.slice(0, 4));
  let m = Number(cursor.slice(5, 7)); // 1-12
  // advance month-by-month until we find one that actually has `dom`
  for (let i = 0; i < 24; i++) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (dom <= daysInMonth) {
      return `${y}-${String(m).padStart(2, "0")}-${String(dom).padStart(2, "0")}`;
    }
  }
  // unreachable for any real dom (1-31) within 24 months; fail safe past range
  return "9999-12-31";
}

/** Map a holiday moment to a YYYY-MM-DD in a given year. */
function momentToOccurrence(m: CulturalMoment, year: number): Occurrence {
  return {
    id: `holiday:${year}-${m.date}`,
    source: "holiday",
    title: m.approximate ? `${m.name}` : m.name,
    date: `${year}-${m.date}`,
    endDate: null,
    startTime: null,
    endTime: null,
    location: null,
    type: m.type === "academic" ? "exam" : "holiday",
    description:
      m.type === "religious"
        ? "Religious holiday"
        : m.type === "academic"
        ? "Academic period"
        : m.approximate
        ? "Date approximate — confirm yearly"
        : "Kenyan public holiday",
    audienceRole: null,
    readonly: true,
  };
}

/**
 * All occurrences (school events + holiday layer) that fall within [from, to]
 * (inclusive, YYYY-MM-DD). `viewerRole` filters audience-targeted events:
 * a row is visible if it's school-wide OR targets the viewer's role. Leadership
 * roles see everything (handled by the caller passing `seeAll`).
 */
export async function getOccurrences(opts: {
  from: string;
  to: string;
  viewerRole: Role;
  seeAll: boolean;
  showReligious: boolean;
}): Promise<Occurrence[]> {
  const { from, to, viewerRole, seeAll, showReligious } = opts;

  // 1) School events. We pull two buckets:
  //    a) one-off / multi-day rows that overlap the range (start <= to AND
  //       (endDate ?? date) >= from), and
  //    b) recurring rows whose SERIES could overlap (first date <= to AND
  //       (recurUntil is null OR >= from)) — then expanded to occurrences.
  const rows = await tenantDb().calendarEvent.findMany({
    where: {
      date: { lte: to },
      OR: [
        // non-recurring overlapping rows
        { recurrence: null, endDate: null, date: { gte: from } },
        { recurrence: null, endDate: { gte: from } },
        // recurring rows whose window reaches into the range
        { recurrence: { not: null }, recurUntil: null },
        { recurrence: { not: null }, recurUntil: { gte: from } },
      ],
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const visible = rows.filter((e) => seeAll || !e.audienceRole || e.audienceRole === viewerRole);
  const events: Occurrence[] = [];
  for (const e of visible) {
    const base = {
      source: "event" as const,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      location: e.location,
      type: e.type,
      description: e.description,
      audienceRole: e.audienceRole,
      readonly: false,
      seriesId: e.id,
    };
    if (e.recurrence === "WEEKLY" || e.recurrence === "MONTHLY") {
      // Expand the series; each occurrence keeps a unique id (id + date) so the
      // UI can render them all, but seriesId points back to the stored row.
      const dates = expandRecurrence(e.date, e.recurrence, e.recurUntil, from, to);
      const dayCount = e.endDate ? daysBetween(e.date, e.endDate) : 0; // preserve multi-day span
      for (const d of dates) {
        events.push({
          ...base,
          id: dates.length > 1 ? `${e.id}:${d}` : e.id,
          date: d,
          endDate: dayCount > 0 ? addDaysIso(d, dayCount) : null,
          recurring: e.recurrence,
        });
      }
    } else {
      events.push({ ...base, id: e.id, date: e.date, endDate: e.endDate, recurring: null });
    }
  }

  // 2) Holiday layer across the years the range spans.
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  const holidays: Occurrence[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (const m of KE_MOMENTS) {
      if (m.type === "religious" && !showReligious) continue;
      const occ = momentToOccurrence(m, y);
      if (occ.date >= from && occ.date <= to) holidays.push(occ);
    }
  }

  return [...holidays, ...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime ?? "00:00").localeCompare(b.startTime ?? "00:00");
  });
}

export async function createEvent(input: CreateEventInput, createdById: string) {
  const event = await tenantDb().calendarEvent.create({
    // tenantId auto-stamped by tenantDb() (A.2 isolation).
    data: {
      title: input.title,
      description: input.description ?? null,
      date: input.date,
      endDate: input.endDate ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      location: input.location ?? null,
      type: input.type,
      audienceRole: input.audience === "all" ? null : input.audience,
      recurrence: input.recurrence ?? null,
      recurUntil: input.recurUntil ?? null,
      createdById,
    } as never,
  });
  return event;
}

export async function updateEvent(id: string, input: UpdateEventInput) {
  const existing = await tenantDb().calendarEvent.findUnique({ where: { id } });
  if (!existing) throw new CalendarError("NOT_FOUND", "Event not found.");
  return tenantDb().calendarEvent.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ?? null } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime ?? null } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime ?? null } : {}),
      ...(input.location !== undefined ? { location: input.location ?? null } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.audience !== undefined
        ? { audienceRole: input.audience === "all" ? null : input.audience }
        : {}),
      ...(input.recurrence !== undefined ? { recurrence: input.recurrence ?? null } : {}),
      ...(input.recurUntil !== undefined ? { recurUntil: input.recurUntil ?? null } : {}),
    },
  });
}

export async function deleteEvent(id: string) {
  const existing = await tenantDb().calendarEvent.findUnique({ where: { id } });
  if (!existing) throw new CalendarError("NOT_FOUND", "Event not found.");
  await tenantDb().calendarEvent.delete({ where: { id } });
  return { id };
}

/**
 * A.17.5 — send invites for an event to its audience. School-wide events go to
 * all active users; targeted events go to that role only. Uses A.7 notify
 * (in-app, with a deep link to the calendar).
 */
export async function inviteAudience(
  tenantId: string,
  event: { id: string; title: string; date: string; startTime: string | null; audienceRole: string | null },
  actorId: string
): Promise<{ invited: number }> {
  const recipients = await db.user.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(event.audienceRole ? { role: event.audienceRole } : {}),
      id: { not: actorId }, // don't notify the creator
    },
    select: { id: true },
  });

  const when = event.startTime ? `${event.date} at ${event.startTime}` : event.date;
  for (const r of recipients) {
    await notify({
      tenantId,
      recipientId: r.id,
      title: `Calendar: ${event.title}`,
      body: `New event on ${when}.`,
      category: "calendar",
      href: "/calendar",
      channels: ["in_app"],
    });
  }
  return { invited: recipients.length };
}

/**
 * A.17.4 — build an RFC-5545 iCalendar (.ics) for the given occurrences.
 * All-day events use VALUE=DATE; timed events use Africa/Nairobi local times
 * with the TZID. Holidays are included as all-day entries.
 */
export function buildIcs(occurrences: Occurrence[], schoolName: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
      d.getUTCHours()
    )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  })();

  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const ymd = (iso: string) => iso.replace(/-/g, "");
  const nextDay = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  };

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NEYO//School Calendar//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(schoolName)} Calendar`,
    "X-WR-TIMEZONE:Africa/Nairobi",
  ];

  for (const o of occurrences) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${o.id}@neyo.co.ke`);
    lines.push(`DTSTAMP:${stamp}`);
    if (o.startTime) {
      const start = `${ymd(o.date)}T${o.startTime.replace(":", "")}00`;
      lines.push(`DTSTART;TZID=Africa/Nairobi:${start}`);
      if (o.endTime) {
        const end = `${ymd(o.endDate ?? o.date)}T${o.endTime.replace(":", "")}00`;
        lines.push(`DTEND;TZID=Africa/Nairobi:${end}`);
      }
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(o.date)}`);
      // All-day DTEND is exclusive — use the day after the (end)date.
      lines.push(`DTEND;VALUE=DATE:${nextDay(o.endDate ?? o.date)}`);
    }
    lines.push(`SUMMARY:${esc(o.title)}`);
    if (o.description) lines.push(`DESCRIPTION:${esc(o.description)}`);
    if (o.location) lines.push(`LOCATION:${esc(o.location)}`);
    lines.push(`CATEGORIES:${esc(o.type.toUpperCase())}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // iCal lines should be CRLF-terminated.
  return lines.join("\r\n") + "\r\n";
}

/** Read/update the tenant's calendar preferences (A.17.3). */
export async function getCalendarPrefs(tenantId: string) {
  const t = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { showReligiousHolidays: true },
  });
  return { showReligiousHolidays: t.showReligiousHolidays };
}

export async function setCalendarPrefs(tenantId: string, showReligiousHolidays: boolean) {
  await db.tenant.update({
    where: { id: tenantId },
    data: { showReligiousHolidays },
  });
  return { showReligiousHolidays };
}
