import * as XLSX from 'xlsx';

// Parses a customer's own ERP-exported "ใบส่งสินค้า" report — a
// semi-structured export, NOT a fixed-column template like the other
// Excel importers in this app. Each sales-order (SO) block looks like:
//   [date, "SO-F256907/166", debtor_code, debtor_name, " สาขา :", ...]  <- block header
//   [product_code, product_name, "", unit, qty]                        <- one or more product lines
//   [" รวม เอกสาร ", so_number, "", total_qty, 0]                      <- subtotal (skipped)
// followed eventually by "รวม วันที่ / รวม ทั้งหมด / หมายเหตุ" summary
// rows at the end of the file (also skipped).
//
// A block header is recognized by a DD/MM/YYYY-shaped value in column 0
// AND an "SO-" prefixed value in column 1 — the only two things distinct
// enough to not collide with a product line (whose column 0 is a product
// code, never date-shaped) or a subtotal row (whose column 0 always
// starts with "รวม").

const DATE_LIKE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const SUMMARY_ROW_PREFIXES = ['รวม', 'หมายเหตุ'];

// The file's block-header date is DD/MM/YYYY in the Buddhist Era (พ.ศ.,
// current year = Gregorian + 543) — e.g. "18/07/2569" is 2026-07-18.
// Returns an ISO yyyy-mm-dd string, or null if the input isn't date-like.
export function buddhistDateToIso(value) {
  const trimmed = String(value ?? '').trim();
  if (!DATE_LIKE.test(trimmed)) return null;
  const [day, month, buddhistYear] = trimmed.split('/').map(Number);
  const gregorianYear = buddhistYear - 543;
  return `${gregorianYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Units that represent a weight quantity rather than a box/pack count —
// everything else (ซอง, แพ็ค, กล่อง, ...) is treated as a count.
const WEIGHT_UNITS = new Set(['กิโลกรัม', 'กก.', 'กก', 'kg', 'KG']);

export function fixMojibakeThaiString(str) {
  if (typeof str !== 'string' || !str) return str;
  let hasLatin1Upper = false;
  let hasThai = false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0x0E00 && code <= 0x0E7F) {
      hasThai = true;
      break;
    }
    if (code >= 128 && code <= 255) {
      hasLatin1Upper = true;
    }
  }
  if (hasThai || !hasLatin1Upper) return str;

  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xFF;
  }
  return new TextDecoder('windows-874').decode(bytes);
}

export async function readSalesOrderExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const u8 = new Uint8Array(buffer);

  // Check magic numbers to see if it's a real binary Excel file
  // ZIP/XLSX: 50 4B 03 04 (PK\x03\x04)
  // OLE2/XLS: D0 CF 11 E0 A1 B1 1A E1
  const isZip = u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04;
  const isOle2 = u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0;

  let workbook;
  if (!isZip && !isOle2) {
    // It's likely an HTML or CSV file exported from an ERP with an .xls extension.
    // Such legacy systems in Thailand usually use TIS-620/Windows-874 encoding.
    let str;
    try {
      // First try to decode as strict UTF-8
      str = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (e) {
      // If it contains invalid UTF-8 bytes (like Thai TIS-620 characters),
      // it will throw an error. Fallback to windows-874.
      str = new TextDecoder('windows-874').decode(buffer);
    }
    workbook = XLSX.read(str, { type: 'string' });
  } else {
    // Real binary Excel file (XLS/XLSX)
    workbook = XLSX.read(buffer, { type: 'array' });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  // If it was a real .xls file (OLE2) without cptable, XLSX parses it as Latin-1,
  // causing Thai Mojibake. We recursively fix strings that look like Mojibake.
  return rawRows.map((row) => 
    row.map((cell) => typeof cell === 'string' ? fixMojibakeThaiString(cell) : cell)
  );
}

// rawRows: array-of-arrays (XLSX.utils.sheet_to_json with header: 1).
// Returns a flat list of { soNumber, debtorCode, debtorName, productCode,
// productName, unit, qty } — one entry per product line, block headers
// and subtotal/summary rows already stripped out.
export function extractSalesOrderLines(rawRows = []) {
  const lines = [];
  let currentBlock = null;

  for (const row of rawRows) {
    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();

    if (DATE_LIKE.test(col0) && col1.startsWith('SO-')) {
      currentBlock = {
        date: buddhistDateToIso(col0),
        soNumber: col1,
        debtorCode: String(row[2] ?? '').trim(),
        debtorName: String(row[3] ?? '').trim(),
      };
      continue;
    }

    if (SUMMARY_ROW_PREFIXES.some((prefix) => col0.startsWith(prefix))) {
      continue;
    }

    if (currentBlock && col0) {
      const qty = Number(row[4]);
      if (!Number.isFinite(qty)) continue;
      lines.push({
        date: currentBlock.date,
        soNumber: currentBlock.soNumber,
        debtorCode: currentBlock.debtorCode,
        debtorName: currentBlock.debtorName,
        productCode: col0,
        productName: col1,
        unit: String(row[3] ?? '').trim(),
        qty,
      });
    }
  }

  return lines;
}

// Groups lines by debtor (code + name — the "customer group" a separate
// withdrawal request gets created for), aggregating quantity per product
// code within each group so the same SKU ordered across multiple SOs for
// the same debtor becomes one withdrawal line, not several.
export function groupSalesOrderLinesByDebtor(lines = []) {
  const groups = new Map();

  for (const line of lines) {
    const groupKey = `${line.debtorCode}|${line.debtorName}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        debtorCode: line.debtorCode,
        debtorName: line.debtorName,
        date: line.date,
        soNumbers: new Set(),
        products: new Map(),
      });
    }
    const group = groups.get(groupKey);
    group.soNumbers.add(line.soNumber);

    const productKey = String(line.productCode).trim().toUpperCase();
    const existing = group.products.get(productKey) ?? {
      productCode: line.productCode,
      productName: line.productName,
      unit: line.unit,
      qty: 0,
    };
    existing.qty += line.qty;
    group.products.set(productKey, existing);
  }

  return [...groups.values()].map((group) => ({
    debtorCode: group.debtorCode,
    debtorName: group.debtorName,
    date: group.date,
    soNumbers: [...group.soNumbers],
    products: [...group.products.values()],
  }));
}

// Resolves each group's product codes against this customer's own catalog
// (same matching convention as the other Excel importers — trim + uppercase
// exact code match, see customerDepositLineExcelUtils.js /
// customerWithdrawalLineExcelUtils.js). A code with no catalog match is
// flagged in `unmatchedCodes` — the caller blocks submission until the
// list is empty, per the explicit decision that this import must not
// silently create partial withdrawal requests.
export function matchSalesOrderGroupsToCatalog(groups = [], catalogProducts = []) {
  const catalogByCode = new Map(
    catalogProducts.map((p) => [String(p.customer_product_code ?? '').trim().toUpperCase(), p]),
  );
  const unmatchedCodes = new Set();

  const matchedGroups = groups.map((group) => ({
    ...group,
    products: group.products.map((product) => {
      const catalog = catalogByCode.get(String(product.productCode).trim().toUpperCase());
      if (!catalog) unmatchedCodes.add(product.productCode);
      const isWeight = WEIGHT_UNITS.has(String(product.unit).trim());
      return {
        ...product,
        catalogProductId: catalog?.id ?? null,
        // The canonical catalog code, not the raw as-typed file value — the
        // file's code only needs to match case/whitespace-insensitively to
        // resolve a catalog entry, but the byte-exact code is what downstream
        // screens (e.g. the withdrawal edit page's catalogByCode lookup)
        // match against verbatim. Storing the raw value here left orphaned
        // withdrawal lines whose product dropdown silently showed blank even
        // though the import itself matched the code correctly.
        matchedProductCode: catalog?.customer_product_code ?? null,
        matchedProductName: catalog?.product_name ?? null,
        requestedBoxes: catalog && !isWeight ? product.qty : null,
        requestedWeight: catalog && isWeight ? product.qty : null,
        matched: Boolean(catalog),
      };
    }),
  }));

  return { groups: matchedGroups, unmatchedCodes: [...unmatchedCodes] };
}

// End-to-end convenience: raw rows straight from the file to matched,
// debtor-grouped result.
export function parseSalesOrderRows(rawRows, catalogProducts = []) {
  const lines = extractSalesOrderLines(rawRows);
  const groups = groupSalesOrderLinesByDebtor(lines);
  return matchSalesOrderGroupsToCatalog(groups, catalogProducts);
}
