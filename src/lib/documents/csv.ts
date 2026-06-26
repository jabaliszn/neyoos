/**
 * CSV builder (Feature A.10 — "CSV export everywhere").
 * Properly escapes quotes, commas, and newlines.
 */
export function toCsv(
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[]
): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(r[c.key])).join(","))
    .join("\n");
  // BOM so Excel opens UTF-8 (KES sign, Kenyan names) correctly.
  return "\uFEFF" + header + "\n" + body + "\n";
}
