import * as XLSX from 'xlsx';

// columnWidths (optional): character-unit widths (XLSX's !cols wch
// convention), one per header in order — lets a caller size the sheet to
// fit its own content instead of every column defaulting to Excel's
// narrow auto-width, which otherwise leaves wide Thai product/customer
// names truncated until the reader manually resizes each column.
export function rowsToSheet(rows = [], headers = [], columnWidths = null) {
  const data = rows.map((row) => {
    const out = {};
    headers.forEach((key) => {
      out[key] = row[key] ?? '';
    });
    return out;
  });
  const sheet = XLSX.utils.json_to_sheet(data, { header: headers });
  if (Array.isArray(columnWidths) && columnWidths.length > 0) {
    sheet['!cols'] = columnWidths.map((wch) => ({ wch }));
  }
  return sheet;
}

export function downloadExcelWorkbook(sheet, filename = 'export.xlsx', sheetName = 'Sheet1') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export function downloadExcelRows(rows, headers, filename, sheetName = 'Sheet1', columnWidths = null) {
  downloadExcelWorkbook(rowsToSheet(rows, headers, columnWidths), filename, sheetName);
}

// Multi-sheet variant of downloadExcelRows/downloadExcelWorkbook — for a
// single downloadable file that needs more than one tab (e.g. a summary tab
// plus a line-detail tab), instead of forcing the caller to produce several
// separate single-sheet files for what's conceptually one report.
export function downloadExcelWorkbookMultiSheet(sheets = [], filename = 'export.xlsx') {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ name, rows, headers, columnWidths }) => {
    const sheet = rowsToSheet(rows, headers, columnWidths);
    // Excel sheet names are capped at 31 characters and can't be blank.
    XLSX.utils.book_append_sheet(workbook, sheet, String(name || 'Sheet').slice(0, 31));
  });
  XLSX.writeFile(workbook, filename);
}

export async function readExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[sheetName];

  // Read the header row directly so it's available even when the sheet has
  // zero data rows (sheet_to_json's default json output has no rows to pull
  // Object.keys from in that case, which used to make a valid, header-only
  // template file look like it was missing its required columns).
  const [headerRow] = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 });
  const headers = (headerRow ?? []).map((h) => String(h ?? '').trim());

  const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  const rows = json.map((row, index) => ({
    ...row,
    __row: index + 2,
  }));

  return { headers, rows };
}

export function formatExcelDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}
