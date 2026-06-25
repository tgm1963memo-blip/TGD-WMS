const fs = require('fs');

function replaceHeaders(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const keyMap = {
    'customer_col_request_no': 'request_no',
    'customer_col_customer_name': 'customer_id',
    'customer_col_status': 'status',
    'customer_field_expected_arrival_date': 'expected_arrival_date',
    'customer_field_contact_name': 'contact_name',
    'customer_field_contact_phone': 'contact_phone',
    'customer_col_note': 'note',
    'customer_history_latest_action': 'updated_at',
    'customer_col_withdrawal_no': 'request_no',
    'customer_field_pickup_date': 'pickup_date',
    'catalog_col_product_code': 'product_code',
    'catalog_col_product_name': 'product_name',
    'catalog_col_base_uom': 'base_uom',
    'catalog_col_category': 'category',
    'catalog_col_unit_weight': 'unit_weight',
    'customer_col_doc_no': 'document_no',
    'customer_col_date': 'movement_date',
    'customer_col_type': 'movement_type',
    'customer_col_product': 'product_name',
    'customer_col_lot_no': 'lot_no',
    'customer_col_boxes': 'quantity_boxes',
    'customer_col_weight': 'quantity_weight',
    'inventory_balance_col_product': 'product_name',
    'inventory_balance_col_lot_no': 'lot_no',
    'inventory_balance_col_receiving_date': 'receiving_date',
    'inventory_balance_col_boxes': 'quantity_boxes',
    'inventory_balance_col_weight': 'quantity_weight',
    'customer_col_created_at': 'created_at',
    'customer_col_facility': 'facility',
    'customer_col_start_date': 'start_date',
    'customer_col_end_date': 'end_date',
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
  'src/features/customer/CustomerDepositRequestListPage.jsx',
  'src/features/customer/CustomerWithdrawalRequestListPage.jsx',
  'src/features/customer/CustomerStockBalancePage.jsx',
  'src/features/customer/CustomerRequestHistoryPage.jsx',
  'src/features/customer/CustomerFacilityUsageRequestPage.jsx',
  'src/features/customer/CustomerProductCatalogPage.jsx'
];

files.forEach(f => replaceHeaders(f));
