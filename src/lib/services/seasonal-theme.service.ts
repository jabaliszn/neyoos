import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { KE_MOMENTS } from "@/lib/i18n/cultural-calendar";

export type SeasonalThemeTone = "heritage" | "celebration" | "faith" | "academic" | "sports" | "event";

export interface SeasonalTheme {
  active: boolean;
  source: "holiday" | "event" | "upcoming" | null;
  title: string;
  message: string;
  tone: SeasonalThemeTone;
  date: string | null;
  daysAway: number | null;
  emoji: string;
}

function nairobiToday(now = new Date()) {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}
function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00.000Z`).getTime() - new Date(`${a}T00:00:00.000Z`).getTime()) / 86_400_000);
}

function themeForTitle(title: string, type?: string): { tone: SeasonalThemeTone; emoji: string; message: string } {
  const t = `${title} ${type ?? ""}`.toLowerCase();
  if (t.includes("mashujaa")) return { tone: "heritage", emoji: "🇰🇪", message: "Today we honour Kenyan heroes. Keep the school spirit strong." };
  if (t.includes("jamhuri") || t.includes("madaraka") || t.includes("huduma") || t.includes("utamaduni")) return { tone: "heritage", emoji: "🇰🇪", message: "A Kenyan national moment is active. NEYO is dressed for the day." };
  if (t.includes("christmas") || t.includes("boxing") || t.includes("new year")) return { tone: "celebration", emoji: "✨", message: "Seasonal greetings from your school dashboard." };
  if (t.includes("eid") || t.includes("easter") || t.includes("good friday")) return { tone: "faith", emoji: "🌙", message: "A faith-season theme is active for the school community." };
  if (t.includes("exam") || t.includes("kcse") || t.includes("kpsea") || type === "exam") return { tone: "academic", emoji: "📚", message: "Assessment season is active. Keep learners and teachers focused." };
  if (t.includes("sport") || t.includes("games") || type === "sports") return { tone: "sports", emoji: "🏆", message: "Sports/event energy is live across the school." };
  return { tone: "event", emoji: "📅", message: "A school event is active. NEYO is highlighting it for everyone." };
}

function holidayOn(date: string) {
  const md = date.slice(5);
  return KE_MOMENTS.find((m) => m.date === md) ?? null;
}

function nextHolidayWithin(today: string, windowDays: number) {
  for (let i = 1; i <= windowDays; i++) {
    const d = addDaysIso(today, i);
    const h = holidayOn(d);
    if (h) return { holiday: h, date: d, daysAway: i };
  }
  return null;
}

export async function currentSeasonalTheme(user: SessionUser, now = new Date()): Promise<SeasonalTheme> {
  return withTenant(user.tenantId, async () => {
    const today = nairobiToday(now);
    const holiday = holidayOn(today);
    if (holiday) {
      const t = themeForTitle(holiday.name, holiday.type);
      return { active: true, source: "holiday", title: holiday.name, message: t.message, tone: t.tone, date: today, daysAway: 0, emoji: t.emoji };
    }

    const event = await tenantDb().calendarEvent.findFirst({
      where: {
        date: { lte: today },
        OR: [{ endDate: null, date: today }, { endDate: { gte: today } }],
      },
      orderBy: [{ type: "asc" }, { date: "asc" }],
    });
    if (event) {
      const t = themeForTitle(event.title, event.type);
      return { active: true, source: "event", title: event.title, message: event.description || t.message, tone: t.tone, date: today, daysAway: 0, emoji: t.emoji };
    }

    const upcomingEvent = await tenantDb().calendarEvent.findFirst({
      where: { date: { gt: today, lte: addDaysIso(today, 7) } },
      orderBy: { date: "asc" },
    });
    const upcomingHoliday = nextHolidayWithin(today, 7);
    const holidaySoonDate = upcomingHoliday?.date ?? "9999-12-31";
    if (upcomingEvent && upcomingEvent.date <= holidaySoonDate) {
      const t = themeForTitle(upcomingEvent.title, upcomingEvent.type);
      const d = daysBetween(today, upcomingEvent.date);
      return { active: true, source: "upcoming", title: upcomingEvent.title, message: `Coming in ${d} day${d === 1 ? "" : "s"}. ${upcomingEvent.description || t.message}`, tone: t.tone, date: upcomingEvent.date, daysAway: d, emoji: t.emoji };
    }
    if (upcomingHoliday) {
      const t = themeForTitle(upcomingHoliday.holiday.name, upcomingHoliday.holiday.type);
      return { active: true, source: "upcoming", title: upcomingHoliday.holiday.name, message: `Coming in ${upcomingHoliday.daysAway} day${upcomingHoliday.daysAway === 1 ? "" : "s"}. ${t.message}`, tone: t.tone, date: upcomingHoliday.date, daysAway: upcomingHoliday.daysAway, emoji: t.emoji };
    }

    return { active: false, source: null, title: "", message: "", tone: "event", date: null, daysAway: null, emoji: "" };
  });
}
