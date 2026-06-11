export const CUSTOMER_PORTAL_DASHBOARD_SUMMARY = {
  pendingDepositRequests: 2,
  availableStockLots: 5,
  pendingWithdrawalRequests: 1,
  lastActivity: 'Withdrawal request CWR-20260611-0002 submitted (demo)',
};

export const CUSTOMER_DEPOSIT_STATUSES = [
  'DRAFT',
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
  'WAREHOUSE_RECEIVING',
  'PALLETIZING',
  'COUNT_VARIANCE_REVIEW',
  'ADMIN_RECOUNT_REQUESTED',
  'RECEIVED_CONFIRMED',
  'CUSTOMER_NOTIFIED',
];

export const CUSTOMER_WITHDRAWAL_STATUSES = [
  'WITHDRAWAL_DRAFT',
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'ADMIN_ACCEPTED',
  'WAREHOUSE_PICKING',
  'PICKED',
  'PACKING_LIST_RECORDED',
  'LOADING',
  'LOADED_CONFIRMED',
  'CUSTOMER_NOTIFIED',
];

export const CUSTOMER_PORTAL_DEMO_DEPOSIT = {
  request_no: 'CDR-20260612-0001',
  customer_code: 'DEMO-CUST-01',
  customer_product_code: 'CUS-CHICKEN-01',
  internal_product_code: 'FRZ-CHKN-01',
  product_name: 'Frozen Chicken Breast',
  lot_no: 'LOT-20260612-A',
  expected_qty: 120,
  expected_boxes: 120,
  expected_weight: 2400,
  received_qty: 118,
  received_boxes: 118,
  received_weight: 2360,
  status: 'COUNT_VARIANCE_REVIEW',
  attachments: ['packing-list-demo.pdf', 'product-photo-demo.jpg', 'temperature-record-demo.xlsx'],
};

export const CUSTOMER_PORTAL_DEMO_PALLETS = [
  {
    pallet_code: 'PLT-DEMO-001',
    storage_code: 'COLD-A-01-02',
    customer_code: 'DEMO-CUST-01',
    customer_product_code: 'CUS-CHICKEN-01',
    internal_product_code: 'FRZ-CHKN-01',
    lot_no: 'LOT-20260612-A',
    box_count: 60,
    total_weight: 1200,
  },
  {
    pallet_code: 'PLT-DEMO-002',
    storage_code: 'COLD-A-01-03',
    customer_code: 'DEMO-CUST-01',
    customer_product_code: 'CUS-CHICKEN-01',
    internal_product_code: 'FRZ-CHKN-01',
    lot_no: 'LOT-20260612-A',
    box_count: 58,
    total_weight: 1160,
  },
];

export const CUSTOMER_PORTAL_DEMO_PACKING_LIST = [
  { box_no: 'BOX-DEMO-001', box_weight: 20, pallet_code: 'PLT-DEMO-001', note: 'Sample box' },
  { box_no: 'BOX-DEMO-002', box_weight: 20, pallet_code: 'PLT-DEMO-001', note: 'Sample box' },
];

export const CUSTOMER_PORTAL_DEMO_WITHDRAWAL = {
  request_no: 'CWR-20260612-0001',
  deposit_request_no: 'CDR-20260612-0001',
  customer_product_code: 'CUS-CHICKEN-01',
  internal_product_code: 'FRZ-CHKN-01',
  lot_no: 'LOT-20260612-A',
  requested_qty: 20,
  requested_boxes: 20,
  requested_weight: 400,
  picking_rule: 'SPECIFIC_DEPOSIT',
  status: 'WAREHOUSE_PICKING',
};

export const CUSTOMER_PORTAL_DEMO_STOCK_ROWS = [
  {
    product_code: 'FRZ-CHKN-01',
    product_name: 'Frozen Chicken Breast',
    lot_no: 'LOT-20260601-A',
    pallet_no: 'PLT-00041',
    location: 'COLD-A-01-02',
    available_qty: 120,
    uom: 'CTN',
    net_weight: 2400,
    expiry_date: '2027-06-01',
    status: 'AVAILABLE',
  },
  {
    product_code: 'FRZ-SFOD-02',
    product_name: 'Frozen Seafood Mix',
    lot_no: 'LOT-20260518-B',
    pallet_no: 'PLT-00022',
    location: 'COLD-B-02-01',
    available_qty: 80,
    uom: 'CTN',
    net_weight: 1600,
    expiry_date: '2026-12-18',
    status: 'AVAILABLE',
  },
  {
    product_code: 'FRZ-BEEF-03',
    product_name: 'Frozen Beef Trim',
    lot_no: 'LOT-20260430-C',
    pallet_no: 'PLT-00015',
    location: 'COLD-A-03-04',
    available_qty: 45,
    uom: 'CTN',
    net_weight: 900,
    expiry_date: '2026-10-30',
    status: 'HOLD',
  },
  {
    product_code: 'FRZ-PORK-04',
    product_name: 'Frozen Pork Shoulder',
    lot_no: 'LOT-20260605-D',
    pallet_no: 'PLT-00058',
    location: 'COLD-C-01-03',
    available_qty: 200,
    uom: 'CTN',
    net_weight: 4000,
    expiry_date: '2027-03-05',
    status: 'AVAILABLE',
  },
];

export const CUSTOMER_PORTAL_DEMO_REQUEST_HISTORY = [
  {
    request_no: 'CDR-20260612-0001',
    request_type: 'DEPOSIT',
    status: 'PENDING_REVIEW',
    requested_date: '2026-06-12',
    note: 'Demo deposit — frozen chicken arrival',
  },
  {
    request_no: 'CDR-20260610-0002',
    request_type: 'DEPOSIT',
    status: 'SUBMITTED',
    requested_date: '2026-06-10',
    note: 'Demo deposit — seafood mix',
  },
  {
    request_no: 'CWR-20260611-0002',
    request_type: 'WITHDRAWAL',
    status: 'DRAFT',
    requested_date: '2026-06-11',
    note: 'Demo withdrawal — customer pickup',
  },
  {
    request_no: 'CWR-20260608-0001',
    request_type: 'WITHDRAWAL',
    status: 'PENDING_REVIEW',
    requested_date: '2026-06-08',
    note: 'Demo withdrawal — delivery to Bangkok DC',
  },
];
