import * as XLSX from 'xlsx';

export function rowsToSheet(rows = [], headers = []) {
  const data = rows.map((row) => {
    const out = {};
    headers.forEach((key) => {
      out[key] = row[key] ?? '';
    });
    return out;
  });
  return XLSX.utils.json_to_sheet(data, { header: headers });
}

export function downloadExcelWorkbook(sheet, filename = 'export.xlsx', sheetName = 'Sheet1') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export function downloadExcelRows(rows, headers, filename, sheetName = 'Sheet1') {
  downloadExcelWorkbook(rowsToSheet(rows, headers), filename, sheetName);
}

export async function readExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  const headers = json.length
    ? Object.keys(json[0])
    : [];

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
