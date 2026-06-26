import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { isRole, type Role } from "@/lib/core/roles";
import { generateNeyoLoginId } from "@/lib/services/identity.service";
import { normalizeKePhone } from "@/lib/validations/auth";
import type { SessionUser } from "@/lib/core/session";
import { parseDelimited, parseXlsx } from "@/lib/services/student-import.service";

export class StaffImportError extends Error {
  constructor(public code: "DUPLICATE" | "INVALID" | "EMPTY" | "BAD_FILE", message: string) {
    super(message);
    this.name = "StaffImportError";
  }
}

export interface StaffImportRow {
  fullName: string;
  role: string;
  phone?: string;
  email?: string;
  tscNumber?: string;
  nationalId?: string;
  kraPin?: string;
  qualifications?: string;
  employmentDate?: string;
  contractType?: string;
  emergencyContact?: string;
}

export interface StaffImportResult {
  totalRows: number;
  created: number;
  skipped: number;
  errors: { row: number; name: string; message: string }[];
}

const STAFF_IMPORT_FIELDS = [
  "fullName",
  "role",
  "phone",
  "email",
  "tscNumber",
  "nationalId",
  "kraPin",
  "qualifications",
  "employmentDate",
  "contractType",
  "emergencyContact",
  "ignore",
] as const;
type StaffImportField = (typeof STAFF_IMPORT_FIELDS)[number];

const HEADER_SYNONYMS: Record<Exclude<StaffImportField, "ignore">, string[]> = {
  fullName: ["full name", "name", "staff name", "teacher name", "employee name", "majina"],
  role: ["role", "position", "job title", "designation", "cheo"],
  phone: ["phone", "mobile", "phone number", "contact", "simu"],
  email: ["email", "email address", "work email"],
  tscNumber: ["tsc", "tsc number", "tsc no", "teacher service commission"],
  nationalId: ["national id", "id number", "id no", "national id number", "kitambulisho"],
  kraPin: ["kra", "kra pin", "pin"],
  qualifications: ["qualifications", "qualification", "education", "training"],
  employmentDate: ["employment date", "employed since", "date employed", "joined", "start date"],
  contractType: ["contract", "contract type", "employment type"],
  emergencyContact: ["emergency", "emergency contact", "next of kin"],
};

const ROLE_ALIASES: Record<string, Role> = {
  PRINCIPAL: "PRINCIPAL",
  HEADTEACHER: "PRINCIPAL",
  HEAD: "PRINCIPAL",
  DEPUTY: "DEPUTY_PRINCIPAL",
  DEPUTYPRINCIPAL: "DEPUTY_PRINCIPAL",
  DEAN: "DEAN_OF_STUDIES",
  DEANOFSTUDIES: "DEAN_OF_STUDIES",
  HOD: "HOD",
  TEACHER: "TEACHER",
  CLASSTEACHER: "CLASS_TEACHER",
  BURSAR: "BURSAR",
  ACCOUNTANT: "ACCOUNTANT",
  RECEPTIONIST: "RECEPTIONIST",
  LIBRARIAN: "LIBRARIAN",
  HOSTELMASTER: "HOSTEL_MASTER",
  SUPPORT: "SUPPORT_STAFF",
  SUPPORTSTAFF: "SUPPORT_STAFF",
};

const CONTRACT_TYPES = new Set(["PERMANENT", "CONTRACT", "BOM", "INTERN"]);

function normHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "").trim();
}

function normalizeRole(input: string) {
  const cleaned = (input || "").toUpperCase().trim().replace(/\s+/g, "_").replace(/[^A-Z_]/g, "");
  if (isRole(cleaned)) return cleaned;
  const aliasKey = cleaned.replaceAll("_", "");
  return ROLE_ALIASES[aliasKey] ?? cleaned;
}

function normalizeDate(input?: string | null) {
  const raw = (input || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ke = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (ke) return `${ke[3]}-${ke[2].padStart(2, "0")}-${ke[1].padStart(2, "0")}`;
  return null;
}

function autoMapStaffColumns(header: string[]): StaffImportField[] {
  const fields: StaffImportField[] = header.map(() => "ignore");
  const used = new Set<StaffImportField>();
  const entries = Object.entries(HEADER_SYNONYMS) as [Exclude<StaffImportField, "ignore">, string[]][];

  header.forEach((raw, index) => {
    const h = normHeader(raw);
    for (const [field, synonyms] of entries) {
      if (used.has(field)) continue;
      if (synonyms.some((s) => normHeader(s) === h)) {
        fields[index] = field;
        used.add(field);
        break;
      }
    }
  });

  header.forEach((raw, index) => {
    if (fields[index] !== "ignore") return;
    const h = normHeader(raw);
    for (const [field, synonyms] of entries) {
      if (used.has(field)) continue;
      if (synonyms.some((s) => h.includes(normHeader(s)) && normHeader(s).length >= 4)) {
        fields[index] = field;
        used.add(field);
        break;
      }
    }
  });

  return fields;
}

export function staffRowsFromTable(rows: string[][], hasHeader = true): StaffImportRow[] {
  if (!rows.length) throw new StaffImportError("EMPTY", "No staff rows found in the import file.");
  const fallback: StaffImportField[] = ["fullName", "role", "phone", "email", "tscNumber", "nationalId", "kraPin", "qualifications", "employmentDate", "contractType", "emergencyContact"];
  const header = hasHeader ? rows[0] : [];
  const fields = hasHeader ? autoMapStaffColumns(header) : fallback;
  const body = hasHeader ? rows.slice(1) : rows;

  const result = body.map((cells) => {
    const out: Record<string, string> = {};
    fields.forEach((field, index) => {
      if (field === "ignore") return;
      out[field] = cells[index]?.trim() ?? "";
    });
    return {
      fullName: out.fullName || "",
      role: out.role || "TEACHER",
      phone: out.phone || undefined,
      email: out.email || undefined,
      tscNumber: out.tscNumber || undefined,
      nationalId: out.nationalId || undefined,
      kraPin: out.kraPin || undefined,
      qualifications: out.qualifications || undefined,
      employmentDate: out.employmentDate || undefined,
      contractType: out.contractType || undefined,
      emergencyContact: out.emergencyContact || undefined,
    } satisfies StaffImportRow;
  }).filter((r) => r.fullName.trim().length > 0 && r.fullName.trim().toLowerCase() !== "full name");

  if (!result.length) throw new StaffImportError("EMPTY", "No valid staff rows found after reading the import file.");
  return result;
}

export function staffRowsFromText(text: string, hasHeader = true) {
  return staffRowsFromTable(parseDelimited(text), hasHeader);
}

export async function staffRowsFromFile(fileName: string, bytes: Buffer, hasHeader = true) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) return staffRowsFromTable(await parseXlsx(bytes), hasHeader);
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) return staffRowsFromText(bytes.toString("utf8"), hasHeader);
  throw new StaffImportError("BAD_FILE", "Use a .csv, .tsv, .txt or .xlsx staff import file.");
}

function duplicatePreflight(rows: StaffImportRow[]) {
  const errors: { row: number; name: string; message: string }[] = [];
  const seen = new Map<string, number>();
  function check(rowNo: number, name: string, label: string, value?: string | null) {
    const v = (value || "").trim().toLowerCase();
    if (!v) return;
    const key = `${label}:${v}`;
    const first = seen.get(key);
    if (first) errors.push({ row: rowNo, name, message: `Duplicate ${label} in this file (already used on row ${first}).` });
    else seen.set(key, rowNo);
  }
  rows.forEach((r, i) => {
    const rowNo = i + 1;
    const name = r.fullName?.trim() || `Row ${rowNo}`;
    check(rowNo, name, "email", r.email);
    check(rowNo, name, "phone", r.phone ? normalizeKePhone(r.phone) ?? r.phone : null);
    check(rowNo, name, "TSC number", r.tscNumber);
    check(rowNo, name, "National ID", r.nationalId);
  });
  return errors;
}

/**
 * B.9/H.3/I.15/I.93 Staff Bulk Import Service.
 * Rule-based today: CSV/TSV/paste/XLSX -> auto column mapping -> real User + StaffProfile rows.
 * Bundi can later read handwritten/photo scans and produce the same StaffImportRow[] input.
 */
export async function importStaffBatch(user: SessionUser, rows: StaffImportRow[]): Promise<StaffImportResult> {
  return withTenant(user.tenantId, async () => {
    const fileDupes = duplicatePreflight(rows);
    if (fileDupes.length) {
      throw new StaffImportError("DUPLICATE", `Import denied: ${fileDupes[0].message}`);
    }

    const normalized = rows.map((r, i) => {
      const role = normalizeRole(r.role);
      const contractType = r.contractType?.trim().toUpperCase().replace(/\s+/g, "_") || null;
      return {
        row: i + 1,
        fullName: r.fullName?.trim() || "",
        role,
        phone: r.phone ? normalizeKePhone(r.phone) : null,
        rawPhone: r.phone,
        email: r.email?.trim().toLowerCase() || null,
        tscNumber: r.tscNumber?.trim() || null,
        nationalId: r.nationalId?.trim() || null,
        kraPin: r.kraPin?.trim() || null,
        qualifications: r.qualifications?.trim() || null,
        employmentDate: normalizeDate(r.employmentDate),
        rawEmploymentDate: r.employmentDate,
        contractType,
        emergencyContact: r.emergencyContact?.trim() || null,
      };
    });

    for (const r of normalized) {
      if (!r.fullName) throw new StaffImportError("INVALID", `Row ${r.row}: Full name is required.`);
      if (!isRole(r.role)) throw new StaffImportError("INVALID", `Row ${r.row}: Invalid role "${rows[r.row - 1].role}".`);
      if (r.rawPhone && !r.phone) throw new StaffImportError("INVALID", `Row ${r.row}: Invalid Kenyan phone number.`);
      if (r.rawEmploymentDate && !r.employmentDate) throw new StaffImportError("INVALID", `Row ${r.row}: Employment date must be YYYY-MM-DD or DD/MM/YYYY.`);
      if (r.contractType && !CONTRACT_TYPES.has(r.contractType)) throw new StaffImportError("INVALID", `Row ${r.row}: Contract type must be PERMANENT, CONTRACT, BOM or INTERN.`);
    }

    const emails = normalized.map((r) => r.email).filter(Boolean) as string[];
    const phones = normalized.map((r) => r.phone).filter(Boolean) as string[];
    const tscs = normalized.map((r) => r.tscNumber).filter(Boolean) as string[];
    const ids = normalized.map((r) => r.nationalId).filter(Boolean) as string[];

    const existingUsers = await db.user.findMany({
      where: { tenantId: user.tenantId, OR: [
        ...(emails.length ? [{ email: { in: emails } }] : []),
        ...(phones.length ? [{ phone: { in: phones } }] : []),
      ] },
      select: { email: true, phone: true, fullName: true },
    });
    const existingProfiles = await db.staffProfile.findMany({
      where: { tenantId: user.tenantId, OR: [
        ...(tscs.length ? [{ tscNumber: { in: tscs } }] : []),
        ...(ids.length ? [{ nationalId: { in: ids } }] : []),
      ] },
      select: { tscNumber: true, nationalId: true },
    });

    for (const r of normalized) {
      if (r.email && existingUsers.some((u) => u.email === r.email)) throw new StaffImportError("DUPLICATE", `Import denied: email "${r.email}" already exists.`);
      if (r.phone && existingUsers.some((u) => u.phone === r.phone)) throw new StaffImportError("DUPLICATE", `Import denied: phone "${r.phone}" already exists.`);
      if (r.tscNumber && existingProfiles.some((p) => p.tscNumber === r.tscNumber)) throw new StaffImportError("DUPLICATE", `Import denied: TSC number "${r.tscNumber}" already exists.`);
      if (r.nationalId && existingProfiles.some((p) => p.nationalId === r.nationalId)) throw new StaffImportError("DUPLICATE", `Import denied: National ID "${r.nationalId}" already exists.`);
    }

    const result: StaffImportResult = { totalRows: rows.length, created: 0, skipped: 0, errors: [] };

    for (const r of normalized) {
      const loginId = await generateNeyoLoginId();
      const staffUser = await db.user.create({
        data: {
          tenantId: user.tenantId,
          neyoLoginId: loginId,
          fullName: r.fullName,
          phone: r.phone,
          email: r.email,
          role: r.role as Role,
          isActive: true,
        },
      });
      await db.staffProfile.create({
        data: {
          tenantId: user.tenantId,
          userId: staffUser.id,
          tscNumber: r.tscNumber,
          nationalId: r.nationalId,
          kraPin: r.kraPin,
          qualifications: r.qualifications,
          employmentDate: r.employmentDate,
          contractType: r.contractType ?? undefined,
          emergencyContact: r.emergencyContact,
        },
      });
      result.created++;
    }

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "hr.staff_bulk_imported",
        entityType: "user",
        entityId: user.id,
        metadata: JSON.stringify({ created: result.created, skipped: result.skipped, source: "rule_based_staff_import" }),
      },
    });

    return result;
  });
}
