const fs = require('fs');

function processFile(filename, tableDataVar) {
  if (!fs.existsSync(filename)) return;
  
  let content = fs.readFileSync(filename, 'utf8');
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
  
  fs.writeFileSync(filename, content, 'utf8');
  console.log('Processed hook in', filename);
}

function replaceHeaders(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  const keyMap = {
    'customer_col_request_no': 'request_no',
    'customer_col_withdrawal_no': 'request_no',
    'customer_col_customer_name': 'customer_id',
    'customer_col_status': 'status',
    'customer_field_expected_arrival_date': 'expected_arrival_date',
    'customer_field_pickup_date': 'pickup_date',
    'customer_history_latest_action': 'updated_at',
  };

  let replaced = false;

  content = content.replace(/<th>\{t\('([^']+)'\)\}<\/th>/g, (match, tKey) => {
    const sortKey = keyMap[tKey];
    if (sortKey) {
      replaced = true;
      return `<th onClick={() => requestSort('${sortKey}')} style={{ cursor: 'pointer' }}>{t('${tKey}')} {getSortIndicator('${sortKey}')}</th>`;
    }
    return match;
  });

  if (replaced) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Replaced headers in', filePath);
  }
}

const files = [
  'src/features/customer/CustomerAdminDepositReviewPage.jsx',
  'src/features/customer/CustomerAdminWithdrawalReviewPage.jsx',
];

files.forEach(f => {
  processFile(f, 'rows');
  replaceHeaders(f);
});
