/**
 * N.1 — Library Bulk Import service (standard CSV/TSV/paste/XLSX engine).
 * Real parsing (reuses the same delimited/XLSX parsers already proven by
 * B.1/B.9), real DB writes through the SAME `addBook()`-equivalent path as
 * manual cataloguing. An existing ISBN match increases `copiesTotal` instead
 * of creating a duplicate catalog row — matching `addBook()`'s own real
 * duplicate-ISBN rule (B.15), never silently ignored.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { parseDelimited, parseXlsx } from "@/lib/services/student-import.service";
import {
  LIBRARY_HEADER_SYNONYMS,
  type LibraryImportField,
  type LibraryImportRow,
  type LibraryImportResult,
} from "@/lib/validations/library-import";

export class LibraryImportError extends Error {
  constructor(public code: "EMPTY" | "INVALID" | "BAD_FILE", message: string) {
    super(message);
    this.name = "LibraryImportError";
  }
}

function normHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "").trim();
}

function autoMapLibraryColumns(header: string[]): LibraryImportField[] {
  const fields: LibraryImportField[] = header.map(() => "ignore");
  const used = new Set<LibraryImportField>();
  const entries = Object.entries(LIBRARY_HEADER_SYNONYMS) as [Exclude<LibraryImportField, "ignore">, string[]][];

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

export function libraryRowsFromTable(rows: string[][], hasHeader = true): LibraryImportRow[] {
  if (!rows.length) throw new LibraryImportError("EMPTY", "No book rows found in the import file.");
  const fallback: LibraryImportField[] = ["title", "author", "isbn", "category", "shelf", "copiesTotal"];
  const header = hasHeader ? rows[0] : [];
  const fields = hasHeader ? autoMapLibraryColumns(header) : fallback;
  const body = hasHeader ? rows.slice(1) : rows;

  const result = body.map((cells) => {
    const out: Record<string, string> = {};
    fields.forEach((field, index) => {
      if (field === "ignore") return;
      out[field] = cells[index]?.trim() ?? "";
    });
    return {
      title: out.title || "",
      author: out.author || undefined,
      isbn: out.isbn || undefined,
      category: out.category || undefined,
      shelf: out.shelf || undefined,
      copiesTotal: out.copiesTotal ? Math.max(1, Math.trunc(Number(out.copiesTotal)) || 1) : 1,
    } satisfies LibraryImportRow;
  }).filter((r) => r.title.trim().length > 0 && r.title.trim().toLowerCase() !== "title");

  if (!result.length) throw new LibraryImportError("EMPTY", "No valid book rows found after reading the import file.");
  return result;
}

export function libraryRowsFromText(text: string, hasHeader = true) {
  return libraryRowsFromTable(parseDelimited(text), hasHeader);
}

export async function libraryRowsFromFile(fileName: string, bytes: Buffer, hasHeader = true) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) return libraryRowsFromTable(await parseXlsx(bytes), hasHeader);
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) return libraryRowsFromText(bytes.toString("utf8"), hasHeader);
  throw new LibraryImportError("BAD_FILE", "Use a .csv, .tsv, .txt or .xlsx library import file.");
}

/**
 * B.15/N.1 Library Bulk Import. Rule-based today: CSV/TSV/paste/XLSX -> auto
 * column mapping -> real LibraryBook rows. Bundi Intelligent can later read
 * handwritten/photo scans of an accession register and produce the same
 * LibraryImportRow[] input (matching the exact precedent already set by
 * staff-import.service.ts for Bundi/Staff).
 */
export async function importLibraryBatch(
  user: SessionUser,
  rows: LibraryImportRow[],
  meta: { fileName?: string; source: "csv" | "xlsx" | "paste" | "bundi" }
): Promise<LibraryImportResult & { importId: string }> {
  return withTenant(user.tenantId, async () => {
    const tdb = tenantDb();
    const result: LibraryImportResult = { totalRows: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

    // Preflight: reject rows with no title outright (never silently skip
    // without telling the school which row and why).
    rows.forEach((r, i) => {
      if (!r.title || !r.title.trim()) {
        result.errors.push({ row: i + 1, title: `Row ${i + 1}`, message: "Title is required." });
      }
    });

    const validRows = rows.filter((r) => r.title && r.title.trim());
    const isbns = validRows.map((r) => r.isbn?.trim()).filter(Boolean) as string[];
    const existingByIsbn = isbns.length
      ? await tdb.libraryBook.findMany({ where: { isbn: { in: isbns }, archived: false } })
      : [];
    const existingMap = new Map(existingByIsbn.map((b) => [b.isbn, b]));

    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const rowNo = rows.indexOf(r) + 1;
      const isbn = r.isbn?.trim() || null;
      const existing = isbn ? existingMap.get(isbn) : undefined;
      try {
        if (existing) {
          // Real duplicate-ISBN handling (matches addBook()'s own rule):
          // increase the copy count instead of creating a duplicate catalog
          // row or silently dropping the row.
          await tdb.libraryBook.update({
            where: { id: existing.id },
            data: { copiesTotal: existing.copiesTotal + r.copiesTotal },
          });
          existingMap.set(isbn!, { ...existing, copiesTotal: existing.copiesTotal + r.copiesTotal });
          result.updated++;
        } else {
          const created = await tdb.libraryBook.create({
            data: {
              tenantId: user.tenantId,
              title: r.title.trim(),
              author: r.author?.trim() || null,
              isbn: isbn || null,
              category: r.category?.trim() || null,
              shelf: r.shelf?.trim() || null,
              copiesTotal: r.copiesTotal,
            },
          });
          if (isbn) existingMap.set(isbn, created);
          result.created++;
        }
      } catch (e) {
        result.errors.push({ row: rowNo, title: r.title, message: e instanceof Error ? e.message : "Could not import this row." });
        result.skipped++;
      }
    }

    const importRow = await tdb.libraryImport.create({
      data: {
        tenantId: user.tenantId,
        fileName: meta.fileName ?? null,
        source: meta.source,
        totalRows: result.totalRows,
        createdRows: result.created,
        updatedRows: result.updated,
        failedRows: result.skipped,
        errorRows: result.errors.length ? JSON.stringify(result.errors) : null,
        createdById: user.id,
        createdByName: user.fullName,
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "library.bulk_imported",
        entityType: "libraryImport",
        entityId: importRow.id,
        metadata: JSON.stringify({ created: result.created, updated: result.updated, skipped: result.skipped, source: meta.source }),
      },
    });

    return { ...result, importId: importRow.id };
  });
}

export async function listLibraryImports(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().libraryImport.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return rows.map((r) => ({ ...r, errorRows: r.errorRows ? JSON.parse(r.errorRows) : [] }));
  });
}
