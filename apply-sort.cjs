const fs = require('fs');
const path = require('path');
const dir = 'src/features/customer';

function processFile(filename, tableDataVar) {
  const filepath = path.join(dir, filename);
  if (!fs.existsSync(filepath)) return;
  
  let content = fs.readFileSync(filepath, 'utf8');
  if (content.includes('useTableSort')) return; // Already processed
  
  // 1. Add import
  const importStatement = "import { useTableSort } from '../../hooks/useTableSort.js';\n";
  content = importStatement + content;
  
  // 2. Add hook call
  const fnMatch = content.match(/export function \w+\([^)]*\)\s*\{/);
  if (fnMatch) {
    const insertPos = fnMatch.index + fnMatch[0].length;
    const hookCall = `\n  const { sortedData, requestSort, getSortIndicator } = useTableSort(${tableDataVar});\n`;
    content = content.slice(0, insertPos) + hookCall + content.slice(insertPos);
  }
  
  // 3. Replace mapping to use sortedData
  content = content.replace(new RegExp(tableDataVar.replace(/\./g, '\\.'), 'g'), 'sortedData');
  
  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Processed', filename);
}

processFile('CustomerDepositRequestListPage.jsx', 'state.rows');
processFile('CustomerWithdrawalRequestListPage.jsx', 'state.rows');
processFile('CustomerStockBalancePage.jsx', 'state.rows');
processFile('CustomerRequestHistoryPage.jsx', 'state.rows');
processFile('CustomerFacilityUsageRequestPage.jsx', 'state.rows');
processFile('CustomerProductCatalogPage.jsx', 'state.rows');
