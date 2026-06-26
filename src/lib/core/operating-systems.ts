export const OS_KEYS = ["school", "business", "farm", "creator"] as const;
export type OperatingSystemKey = (typeof OS_KEYS)[number];

export interface OperatingSystemDef {
  key: OperatingSystemKey;
  name: string;
  shortName: string;
  tagline: string;
  loginPath: string;
  onboardingPath: string;
  status: "LIVE" | "WAITLIST" | "PLANNED";
}

export const OPERATING_SYSTEMS: OperatingSystemDef[] = [
  { key: "school", name: "NEYO School OS", shortName: "School OS", tagline: "Admissions, fees, attendance and academics for Kenyan schools.", loginPath: "/os/school/login", onboardingPath: "/os/school/onboarding", status: "LIVE" },
  { key: "business", name: "NEYO Business OS", shortName: "Business OS", tagline: "Operations, customers, money and teams for Kenyan SMEs.", loginPath: "/os/business/login", onboardingPath: "/os/business/onboarding", status: "WAITLIST" },
  { key: "farm", name: "NEYO Farm OS", shortName: "Farm OS", tagline: "Cooperatives, dairy, inventory and farm operations.", loginPath: "/os/farm/login", onboardingPath: "/os/farm/onboarding", status: "WAITLIST" },
  { key: "creator", name: "NEYO Creator OS", shortName: "Creator OS", tagline: "Creator businesses, sales, calendars and content operations.", loginPath: "/os/creator/login", onboardingPath: "/os/creator/onboarding", status: "WAITLIST" },
];

export function getOperatingSystem(key: string | null | undefined): OperatingSystemDef {
  return OPERATING_SYSTEMS.find((os) => os.key === key) ?? OPERATING_SYSTEMS[0];
}

export function isOperatingSystemKey(value: string): value is OperatingSystemKey {
  return (OS_KEYS as readonly string[]).includes(value);
}

export function waitlistOsValue(key: OperatingSystemKey) {
  if (key === "school") return "school_os_demo";
  return `${key}_os` as "farm_os" | "business_os" | "creator_os";
}
