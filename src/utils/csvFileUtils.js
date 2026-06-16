export function escapeCsvValue(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(headers, rows = []) {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) => headers.map((key) => escapeCsvValue(row[key])).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export function downloadCsvContent(csv, filename) {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseCsvText(text = '') {
  const normalized = String(text).replace(/^\uFEFF/, '').trim();
  if (!normalized) return { headers: [], rows: [] };

  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      lines.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length) lines.push(current);

  const parsedLines = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = [];
      let cell = '';
      let quoted = false;

      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];

        if (char === '"') {
          if (quoted && next === '"') {
            cell += '"';
            index += 1;
          } else {
            quoted = !quoted;
          }
          continue;
        }

        if (char === ',' && !quoted) {
          cells.push(cell.trim());
          cell = '';
          continue;
        }

        cell += char;
      }

      cells.push(cell.trim());
      return cells;
    });

  if (!parsedLines.length) return { headers: [], rows: [] };

  const headers = parsedLines[0].map((header) => header.trim().toLowerCase());
  const rows = parsedLines.slice(1).map((cells, rowIndex) => {
    const row = { __row: rowIndex + 2 };
    headers.forEach((header, cellIndex) => {
      row[header] = cells[cellIndex] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

export function readCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read CSV file.'));
    reader.readAsText(file);
  });
}
