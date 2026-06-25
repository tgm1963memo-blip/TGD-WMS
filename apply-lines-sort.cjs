const fs = require('fs');
const path = require('path');

function addSortingToLinesDisplay(filePath, dataVar, keyMap) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('useTableSort')) return; // already processed

  // import useTableSort
  content = "import { useTableSort } from '../../hooks/useTableSort.js';\n" + content;

  // Add hook call
  const fnMatch = content.match(/export function \w+\([^)]*\)\s*\{/);
  if (fnMatch) {
    const insertPos = fnMatch.index + fnMatch[0].length;
    const hookCall = `\n  const { sortedData, requestSort, getSortIndicator } = useTableSort(${dataVar});\n`;
    content = content.slice(0, insertPos) + hookCall + content.slice(insertPos);
  }

  // replace map call
  content = content.replace(new RegExp(`${dataVar}\\.length \\? ${dataVar}\\.map`), `sortedData.length ? sortedData.map`);

  // replace th tags based on keyMap
  content = content.replace(/<th>(.*?)<\/th>/g, (match, inner) => {
    // If it's a translation call
    let tMatch = inner.match(/\{t\('([^']+)'\)\}/);
    if (tMatch && keyMap[tMatch[1]]) {
      const sortKey = keyMap[tMatch[1]];
      return `<th onClick={() => requestSort('${sortKey}')} style={{ cursor: 'pointer' }}>${inner} {getSortIndicator('${sortKey}')}</th>`;
    }
    // If it's just raw text
    if (keyMap[inner]) {
      const sortKey = keyMap[inner];
      return `<th onClick={() => requestSort('${sortKey}')} style={{ cursor: 'pointer' }}>${inner} {getSortIndicator('${sortKey}')}</th>`;
    }
    return match;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Processed', filePath);
}

const depositKeyMap = {
  '#': 'line_no',
  'catalog_col_customer_code': 'customer_product_code',
  'catalog_col_product_name': 'product_name',
  'customer_col_weight_per_box': 'weight_per_box',
  'customer_col_total_deposit_weight': 'expected_weight',
  'customer_col_box_count': 'expected_boxes',
  'เลข LOT': 'lot_no',
  'วันผลิต': 'mfg_date',
  'วันหมดอายุ': 'exp_date',
  'รับจริง (กล่อง)': 'actual_boxes',
  'รับจริง (กก.)': 'actual_weight',
  'customer_col_line_note': 'note'
};

const withdrawalKeyMap = {
  '#': 'line_no',
  'catalog_col_product_code': 'product_code',
  'catalog_col_product_name': 'product_name',
  'customer_col_weight_per_box': 'unit_weight',
  'customer_col_box_count': 'expected_boxes',
  'customer_col_total_withdrawal_weight': 'expected_weight',
  'LOT (ที่ระบุไว้)': 'lot_no',
  'LOT (จ่ายจริง)': 'actual_lot_no',
  'จ่ายจริง (กล่อง)': 'actual_boxes',
  'จ่ายจริง (กก.)': 'actual_weight',
  'customer_col_line_note': 'note'
};

addSortingToLinesDisplay('src/components/customer/CustomerDepositRequestLinesDisplay.jsx', 'lines', depositKeyMap);
if (fs.existsSync('src/components/customer/CustomerWithdrawalRequestLinesDisplay.jsx')) {
  addSortingToLinesDisplay('src/components/customer/CustomerWithdrawalRequestLinesDisplay.jsx', 'lines', withdrawalKeyMap);
}

