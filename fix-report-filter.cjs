const fs = require('fs');

let page = fs.readFileSync('src/features/reports/MovementLedgerReportPage.jsx', 'utf8');
page = page.replace('let rows = result.data ?? [];', 'let rows = result.data ?? [];\n\n      // User requested to only show confirmed receipt/dispatch transactions\n      rows = rows.filter(r => r.ledger_source === "inventory_ledger");');
fs.writeFileSync('src/features/reports/MovementLedgerReportPage.jsx', page, 'utf8');

let mapper = fs.readFileSync('src/services/operationalReportMapper.js', 'utf8');
mapper = mapper.replace('const filteredRows = rows.filter(row => row.ledger_source === "INVENTORY");\n  const mappedLines = filteredRows.map((row, index) => {', 'const mappedLines = rows.map((row, index) => {');
fs.writeFileSync('src/services/operationalReportMapper.js', mapper, 'utf8');
