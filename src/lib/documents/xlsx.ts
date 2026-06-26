/**
 * XLSX builder (Feature A.10 — via exceljs).
 */
import ExcelJS from "exceljs";

export async function toXlsx(
  sheetName: string,
  columns: { key: string; label: string; width?: number }[],
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NEYO";
  const ws = wb.addWorksheet(sheetName.slice(0, 31));

  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width ?? 18,
  }));

  // Bold header row.
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle" };

  rows.forEach((r) => ws.addRow(r));

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
