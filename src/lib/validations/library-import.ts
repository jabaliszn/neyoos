import { z } from "zod";

/**
 * N.1 — Library Bulk Import (standard CSV/paste engine).
 * The Library catalog (B.15) previously had ZERO bulk-import mechanism of
 * any kind — every book had to be added one at a time via `addBook()`. This
 * mirrors the exact CSV/TSV/paste/XLSX pattern already proven by the Staff
 * (B.9) and Student (B.1) import engines rather than inventing a new one.
 */

export const LIBRARY_IMPORT_FIELDS = [
  "title",
  "author",
  "isbn",
  "category",
  "shelf",
  "copiesTotal",
  "ignore",
] as const;
export type LibraryImportField = (typeof LIBRARY_IMPORT_FIELDS)[number];

export const LIBRARY_HEADER_SYNONYMS: Record<Exclude<LibraryImportField, "ignore">, string[]> = {
  title: ["title", "book title", "book name", "name", "jina la kitabu"],
  author: ["author", "writer", "authors", "mwandishi"],
  isbn: ["isbn", "barcode", "isbn number", "book code", "accession no", "accessionno", "acc no"],
  category: ["category", "subject", "genre", "type", "section"],
  shelf: ["shelf", "location", "shelf no", "shelf number", "rack"],
  copiesTotal: ["copies", "copies total", "quantity", "qty", "no of copies", "number of copies", "stock"],
};

export const libraryImportRowSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  author: z.string().trim().max(120).optional(),
  isbn: z.string().trim().max(40).optional(),
  category: z.string().trim().max(60).optional(),
  shelf: z.string().trim().max(40).optional(),
  copiesTotal: z.coerce.number().int().min(1).max(1000).default(1),
});
export type LibraryImportRow = z.infer<typeof libraryImportRowSchema>;

export interface LibraryImportResult {
  totalRows: number;
  created: number;
  updated: number; // existing ISBN matched -> copiesTotal increased, never duplicated
  skipped: number;
  errors: { row: number; title: string; message: string }[];
}
