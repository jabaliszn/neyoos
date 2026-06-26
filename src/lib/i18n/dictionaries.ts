/**
 * Lightweight i18n (Feature A.15). English default + Kiswahili.
 * No heavy library — a typed dictionary + t(). Add keys as the UI grows.
 */
export type Lang = "en" | "sw";

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "sw", label: "Swahili", native: "Kiswahili" },
];

// Keys are dot-namespaced. {{var}} interpolation supported via t().
const en: Record<string, string> = {
  "nav.dashboard": "Dashboard",
  "nav.messages": "Messages",
  "nav.students": "Students",
  "nav.attendance": "Attendance",
  "nav.finance": "Finance",
  "nav.academics": "Academics",
  "nav.staff": "Staff",
  "nav.settings": "Settings",
  "common.signOut": "Sign out",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.language": "Language",
  "dash.goodMorning": "Good morning, {{name}}",
  "dash.quickActions": "Quick actions",
  "dash.recentActivity": "Recent activity",
};

const sw: Record<string, string> = {
  "nav.dashboard": "Dashibodi",
  "nav.messages": "Ujumbe",
  "nav.students": "Wanafunzi",
  "nav.attendance": "Mahudhurio",
  "nav.finance": "Fedha",
  "nav.academics": "Masomo",
  "nav.staff": "Wafanyakazi",
  "nav.settings": "Mipangilio",
  "common.signOut": "Toka",
  "common.save": "Hifadhi",
  "common.cancel": "Ghairi",
  "common.language": "Lugha",
  "dash.goodMorning": "Habari ya asubuhi, {{name}}",
  "dash.quickActions": "Vitendo vya haraka",
  "dash.recentActivity": "Shughuli za hivi karibuni",
};

export const DICTIONARIES: Record<Lang, Record<string, string>> = { en, sw };

/** Translate a key for a language, with {{var}} interpolation. Falls back to EN, then the key. */
export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>
): string {
  const dict = DICTIONARIES[lang] ?? DICTIONARIES.en;
  let s = dict[key] ?? DICTIONARIES.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), String(v));
    }
  }
  return s;
}

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "sw";
}
