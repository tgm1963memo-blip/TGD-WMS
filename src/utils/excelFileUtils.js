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

// Converts an Excel date SERIAL NUMBER (the raw cell value under a date
// number format, e.g. 46266) to an exact ISO YYYY-MM-DD using SheetJS's own
// date-code parser -- deliberately NOT `new Date(...)` + cellDates:true.
// That path was tried first and found to silently corrupt real files: for
// serial 46266 (Excel's own cached display: "9/1/26", i.e. 2026-09-01),
// cellDates:true produced a JS Date landing at 2026-08-31T23:59:56 local
// (4 seconds short of midnight -- a known SheetJS float-precision quirk in
// its serial-to-Date epoch math), which both toISOString() and the local
// y/m/d getters then read back as August 31 -- one day off, on a field
// (mfg_date/exp_date) where being off by a day is a real food-safety
// concern, not just cosmetic. SSF.parse_date_code works directly off the
// integer serial with no such rounding.
function excelSerialToIsoDate(serial) {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
}

export async function readExcelFile(file) {
  const buffer = await file.arrayBuffer();
  // Two parses of the same buffer: cellDates:true only to DETECT which
  // cells are genuinely date-formatted (Date instances are just a signal
  // here, their own y/m/d are not trusted -- see excelSerialToIsoDate);
  // the default (cellDates unset) keeps numeric-formatted-as-date cells as
  // their raw serial number, which is what actually gets converted.
  const workbookDates = XLSX.read(buffer, { type: 'array', cellDates: true });
  const workbookRaw = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbookDates.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const sheetDates = workbookDates.Sheets[sheetName];
  const sheetRaw = workbookRaw.Sheets[sheetName];

  // Read the header row directly so it's available even when the sheet has
  // zero data rows (sheet_to_json's default json output has no rows to pull
  // Object.keys from in that case, which used to make a valid, header-only
  // template file look like it was missing its required columns).
  const [headerRow] = XLSX.utils.sheet_to_json(sheetDates, { header: 1, range: 0 });
  const headers = (headerRow ?? []).map((h) => String(h ?? '').trim());

  const json = XLSX.utils.sheet_to_json(sheetDates, { defval: '', raw: false });
  // raw:false renders every cell (including a real Excel date cell) as its
  // locale-formatted DISPLAY text -- e.g. a date cell shows as "9/1/26" or
  // "1/9/2027" depending on the cell's own number format, not an unambiguous
  // ISO string, so it silently fails whatever expects YYYY-MM-DD downstream
  // (a native <input type="date"> just renders blank for a non-ISO value)
  // with no error to explain why the date "isn't showing". The Date-signal
  // pass below finds which cells actually need correcting; the raw-serial
  // pass supplies the exact number excelSerialToIsoDate converts.
  const jsonDateSignal = XLSX.utils.sheet_to_json(sheetDates, { defval: '', raw: true });
  const jsonRawSerial = XLSX.utils.sheet_to_json(sheetRaw, { defval: '', raw: true });
  const rows = json.map((row, index) => {
    const signalRow = jsonDateSignal[index] ?? {};
    const rawRow = jsonRawSerial[index] ?? {};
    const corrected = { ...row };
    for (const key of Object.keys(row)) {
      if (signalRow[key] instanceof Date && typeof rawRow[key] === 'number') {
        corrected[key] = excelSerialToIsoDate(rawRow[key]);
      }
    }
    return { ...corrected, __row: index + 2 };
  });

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
