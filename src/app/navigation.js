/**
 * 17B Black & Gold Professional Navigation Groups.
 *
 * Rules:
 * - Full professional text labels.
 * - No emoji icons.
 * - No short code-only labels (RCV, PTW, PCK, PST).
 * - Groups match the 17A design spec.
 * - Items that map to existing routes get a `path`.
 * - Items without a route are marked `disabled: true`.
 */

export const navigationGroups = [
  {
    label: 'Main Operation',
    key: 'main_operation',
    items: [
      { label: 'Dashboard', key: 'dashboard', path: '/dashboard' },
    ],
  },
  {
    label: 'Inbound Management',
    key: 'inbound_management',
    items: [
      { label: 'Receiving', key: 'receiving', path: '/operations/receiving' },
      { label: 'Putaway', key: 'putaway', path: '/operations/putaway' },
      { label: 'Handheld Receiving', key: 'handheld_receiving', path: '/handheld' },
    ],
  },
  {
    label: 'Inventory Control',
    key: 'inventory_control',
    items: [
      { label: 'Stock Balance', key: 'stock_balance', path: '/stock-count' },
      { label: 'Transfer', key: 'transfer', path: '/operations/transfer' },
      { label: 'Adjustment', key: 'adjustment', path: '/operations/adjustment' },
      { label: 'Lot / Pallet', key: 'lot_pallet', disabled: true },
    ],
  },
  {
    label: 'Outbound Management',
    key: 'outbound_management',
    items: [
      { label: 'Withdrawal Request', key: 'withdrawal_request', path: '/operations/withdrawal-requests' },
      { label: 'Reservation', key: 'reservation', path: '/operations/allocations' },
      { label: 'Picking Confirmation', key: 'picking_confirmation', path: '/operations/picking' },
      { label: 'Post Outbound', key: 'post_outbound', path: '/operations/outbound' },
      { label: 'Dispatch History', key: 'dispatch_history', path: '/operations/dispatch' },
    ],
  },
  {
    label: 'Barcode / Handheld',
    key: 'barcode_handheld',
    items: [
      { label: 'Scan Center', key: 'scan_center', path: '/handheld' },
      { label: 'Barcode Alias', key: 'barcode_alias', disabled: true },
      { label: 'Scan Logs', key: 'scan_logs', disabled: true },
    ],
  },
  {
    label: 'Customer Portal',
    key: 'customer_portal',
    items: [
      {
        label: 'Portal Overview',
        key: 'customer_portal_home',
        path: '/customer',
        testId: 'customer-portal-menu-item',
      },
      {
        label: 'Customer Deposit',
        key: 'customer_deposit_request',
        path: '/customer/deposit-request',
        testId: 'customer-deposit-request-menu-item',
      },
      {
        label: 'Customer Stock',
        key: 'customer_stock_balance',
        path: '/customer/stock-balance',
        testId: 'customer-stock-balance-menu-item',
      },
      {
        label: 'Customer Withdrawal',
        key: 'customer_withdrawal_request',
        path: '/customer/withdrawal-request',
        testId: 'customer-withdrawal-request-menu-item',
      },
      {
        label: 'Customer Requests',
        key: 'customer_request_history',
        path: '/customer/requests',
        testId: 'customer-request-history-menu-item',
      },
    ],
  },
  {
    label: 'Billing',
    key: 'billing',
    items: [
      {
        label: 'Billing Movement Weight',
        key: 'billing_movement_weight',
        path: '/reports/billing-movement-weight',
        testId: 'billing-menu-item',
      },
      {
        label: 'Invoice Drafts',
        key: 'billing_invoice_drafts',
        path: '/billing/invoice-drafts',
        testId: 'billing-invoice-drafts-menu-item',
      },
    ],
  },
  {
    label: 'Reports',
    key: 'reports',
    items: [
      { label: 'Movement Ledger', key: 'movement_ledger', path: '/reports/movement-ledger' },
      { label: 'Stock Aging', key: 'stock_aging', path: '/reports/storage-aging' },
      { label: 'Operation Summary', key: 'operation_summary', path: '/reports' },
    ],
  },
  {
    label: 'System Administration',
    key: 'system_administration',
    items: [
      { label: 'Master Data', key: 'master_data', path: '/master/customers' },
      { label: 'Users and Roles', key: 'users_and_roles', path: '/admin/auth-readiness' },
      { label: 'Audit Log', key: 'audit_log', disabled: true },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
