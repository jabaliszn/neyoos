/**
 * Kenyan cultural & academic moments (Feature A.15 / reused by A.17 Calendar).
 * Real KE public holidays + school-relevant moments. Religious dates that shift
 * yearly (Eid) are marked approximate and can be refined per year.
 */
export type MomentType = "public_holiday" | "religious" | "academic" | "cultural";

export interface CulturalMoment {
  /** MM-DD for fixed dates; year added at lookup time. */
  date: string; // "10-20"
  name: string;
  swName?: string;
  type: MomentType;
  approximate?: boolean;
}

export const KE_MOMENTS: CulturalMoment[] = [
  { date: "01-01", name: "New Year's Day", swName: "Mwaka Mpya", type: "public_holiday" },
  { date: "05-01", name: "Labour Day", swName: "Sikukuu ya Wafanyakazi", type: "public_holiday" },
  { date: "06-01", name: "Madaraka Day", swName: "Siku ya Madaraka", type: "public_holiday" },
  { date: "10-10", name: "Huduma Day (Utamaduni)", swName: "Siku ya Huduma", type: "public_holiday" },
  { date: "10-20", name: "Mashujaa Day", swName: "Siku ya Mashujaa", type: "public_holiday" },
  { date: "12-12", name: "Jamhuri Day", swName: "Siku ya Jamhuri", type: "public_holiday" },
  { date: "12-25", name: "Christmas Day", swName: "Krismasi", type: "religious" },
  { date: "12-26", name: "Boxing Day", swName: "Siku ya Sanduku", type: "public_holiday" },
  // Academic moments (typical windows; schools can adjust).
  { date: "11-01", name: "KCSE exams begin (approx.)", swName: "Mitihani ya KCSE huanza", type: "academic", approximate: true },
  { date: "10-28", name: "KPSEA / KCPE period (approx.)", type: "academic", approximate: true },
  // Religious (shift yearly — approximate placeholders).
  { date: "03-31", name: "Eid al-Fitr (approx.)", swName: "Idd-ul-Fitr", type: "religious", approximate: true },
  { date: "06-07", name: "Eid al-Adha (approx.)", swName: "Idd-ul-Adha", type: "religious", approximate: true },
  { date: "04-18", name: "Good Friday (varies)", type: "religious", approximate: true },
  { date: "04-21", name: "Easter Monday (varies)", type: "religious", approximate: true },
];

/** Moments in a given month (1-12), with the year applied. */
export function momentsInMonth(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  return KE_MOMENTS.filter((m) => m.date.startsWith(`${mm}-`)).map((m) => ({
    ...m,
    iso: `${year}-${m.date}`,
  }));
}

/** Moments on a specific date (YYYY-MM-DD). */
export function momentsOnDate(iso: string) {
  const md = iso.slice(5); // MM-DD
  return KE_MOMENTS.filter((m) => m.date === md);
}

/** The next upcoming moment from today. */
export function nextMoment(from = new Date()) {
  const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayMd = md(from);
  const sorted = [...KE_MOMENTS].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.find((m) => m.date >= todayMd) ?? sorted[0];
}
