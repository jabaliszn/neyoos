/**
 * School Profile service (G.9). Reads/writes the tenant's profile, branding and
 * joining-requirements master list. Profile fields live on the Tenant row.
 */
import { db } from "@/lib/db";
import type { SchoolProfileInput, JoiningRequirement } from "@/lib/validations/school-profile";

export interface SchoolProfile {
  name: string;
  slug: string;
  motto: string;
  vision: string;
  mission: string;
  about: string;
  county: string;
  phone: string;
  email: string;
  addressLine: string;
  curriculum: string;
  logoUrl: string;
  brandPrimary: string;
  brandAccent: string;
  socialLinks: Record<string, string>;
  joiningRequirements: JoiningRequirement[];
  gpsLat: number | null;
  gpsLng: number | null;
  gpsRadiusM: number | null;
  educationLevelsOffered: string[];
  schoolType: string; // G.21: DAY | BOARDING | DAY_AND_BOARDING
  uniformSupplierName: string; // G.24
  uniformSupplierPhone: string;
}

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export async function getSchoolProfile(tenantId: string): Promise<SchoolProfile> {
  const t = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  return {
    name: t.name,
    slug: t.slug,
    motto: t.motto ?? "",
    vision: t.vision ?? "",
    mission: t.mission ?? "",
    about: t.about ?? "",
    county: t.county ?? "",
    phone: t.phone ?? "",
    email: t.email ?? "",
    addressLine: t.addressLine ?? "",
    curriculum: t.curriculum ?? "",
    logoUrl: t.logoUrl ?? "",
    brandPrimary: t.brandPrimary ?? "",
    brandAccent: t.brandAccent ?? "",
    socialLinks: parseJson<Record<string, string>>(t.socialLinks, {}),
    joiningRequirements: parseJson<JoiningRequirement[]>(t.joiningRequirements, []),
    gpsLat: t.gpsLat,
    gpsLng: t.gpsLng,
    gpsRadiusM: t.gpsRadiusM,
    educationLevelsOffered: parseJson<string[]>(t.educationLevelsOffered, []),
    schoolType: t.schoolType,
    uniformSupplierName: t.uniformSupplierName ?? "",
    uniformSupplierPhone: t.uniformSupplierPhone ?? "",
  };
}

export async function updateSchoolProfile(
  tenantId: string,
  input: SchoolProfileInput,
  actor: { id: string; name: string }
): Promise<SchoolProfile> {
  await db.tenant.update({
    where: { id: tenantId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.motto !== undefined ? { motto: input.motto || null } : {}),
      ...(input.vision !== undefined ? { vision: input.vision || null } : {}),
      ...(input.mission !== undefined ? { mission: input.mission || null } : {}),
      ...(input.about !== undefined ? { about: input.about || null } : {}),
      ...(input.county !== undefined ? { county: input.county || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.addressLine !== undefined ? { addressLine: input.addressLine || null } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      ...(input.brandPrimary !== undefined ? { brandPrimary: input.brandPrimary || null } : {}),
      ...(input.brandAccent !== undefined ? { brandAccent: input.brandAccent || null } : {}),
      ...(input.socialLinks !== undefined
        ? { socialLinks: JSON.stringify(input.socialLinks) }
        : {}),
      ...(input.joiningRequirements !== undefined
        ? { joiningRequirements: JSON.stringify(input.joiningRequirements) }
        : {}),
      // G.17 geofence: "" -> off (null); number -> set.
      ...(input.gpsLat !== undefined ? { gpsLat: input.gpsLat === "" ? null : input.gpsLat } : {}),
      ...(input.gpsLng !== undefined ? { gpsLng: input.gpsLng === "" ? null : input.gpsLng } : {}),
      ...(input.gpsRadiusM !== undefined ? { gpsRadiusM: input.gpsRadiusM === "" ? null : input.gpsRadiusM } : {}),
      ...(input.educationLevelsOffered !== undefined ? { educationLevelsOffered: JSON.stringify(input.educationLevelsOffered) } : {}),
      // G.21 school type + G.24 uniform supplier.
      ...(input.schoolType !== undefined ? { schoolType: input.schoolType } : {}),
      ...(input.uniformSupplierName !== undefined ? { uniformSupplierName: input.uniformSupplierName || null } : {}),
      ...(input.uniformSupplierPhone !== undefined ? { uniformSupplierPhone: input.uniformSupplierPhone || null } : {}),
    },
  });

  // G.21: DAY-only schools get the hostel module switched OFF automatically.
  if (input.schoolType === "DAY") {
    await db.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: "hostel" } },
      update: { enabled: false },
      create: { tenantId, moduleKey: "hostel", enabled: false },
    });
  }

  await db.auditLog.create({
    data: {
      tenantId,
      actorId: actor.id,
      actorName: actor.name,
      action: "school.profile.update",
      entityType: "Tenant",
      entityId: tenantId,
    },
  });

  return getSchoolProfile(tenantId);
}

export interface SchoolLevelActivationSummary {
  educationLevelsOffered: string[];
  isEcde: boolean;
  isPrimary: boolean;
  isJuniorSchool: boolean;
  isSeniorSchool: boolean;
  isMixedSchool: boolean;
  shouldShowPathwayTools: boolean;
  shouldShowSubjectSelectionTools: boolean;
}

export async function getSchoolLevelActivationSummary(tenantId: string): Promise<SchoolLevelActivationSummary> {
  const profile = await getSchoolProfile(tenantId);
  const levels = profile.educationLevelsOffered ?? [];
  const isEcde = levels.includes("ECDE");
  const isPrimary = levels.includes("PRIMARY");
  const isJuniorSchool = levels.includes("JUNIOR_SCHOOL");
  const isSeniorSchool = levels.includes("SENIOR_SCHOOL");
  return {
    educationLevelsOffered: levels,
    isEcde,
    isPrimary,
    isJuniorSchool,
    isSeniorSchool,
    isMixedSchool: levels.length > 1,
    shouldShowPathwayTools: isSeniorSchool,
    shouldShowSubjectSelectionTools: isJuniorSchool || isSeniorSchool,
  };
}
