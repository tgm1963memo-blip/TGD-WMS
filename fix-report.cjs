const fs = require('fs');

// Modifying operationalReportMapper.js
let mapper = fs.readFileSync('src/services/operationalReportMapper.js', 'utf8');
mapper = mapper.replace('const mappedLines = rows.map((row, index) => {', 'const filteredRows = rows.filter(row => row.ledger_source === "INVENTORY");\n  const mappedLines = filteredRows.map((row, index) => {');
fs.writeFileSync('src/services/operationalReportMapper.js', mapper, 'utf8');

// Modifying InventoryMovementReportTemplate.jsx
let template = fs.readFileSync('src/components/reports/InventoryMovementReportTemplate.jsx', 'utf8');
template = template.replace(/{t\('date', 'DATE'\)}/g, "{t('no', 'NO.')}");
template = template.replace(/<td style={{ textAlign: 'center' }}>\{line\.date\}<\/td>/g, "<td style={{ textAlign: 'center' }}>{index + 1}</td>");
template = template.replace(/\{lines\.map\(\(line\) => \(/g, "{lines.map((line, index) => (");

fs.writeFileSync('src/components/reports/InventoryMovementReportTemplate.jsx', template, 'utf8');
