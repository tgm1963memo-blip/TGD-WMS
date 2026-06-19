/**
 * Black & Gold Professional Navigation Groups.
 *
 * Items without a route are marked disabled: true.
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
      { label: 'การรับเข้าสินค้า', key: 'receiving', path: '/operations/receiving' },
    ],
  },
  {
    label: 'Inventory Control',
    key: 'inventory_control',
    items: [
      { label: 'ยอดคงเหลือ', key: 'stock_balance', path: '/inventory' },
      { label: 'Transfer', key: 'transfer', path: '/operations/transfer', disabled: true },
      { label: 'Adjustment', key: 'adjustment', path: '/operations/adjustment', disabled: true },
    ],
  },
  {
    label: 'Outbound Management',
    key: 'outbound_management',
    items: [
      { label: 'การเบิกสินค้า', key: 'withdrawal_request', path: '/operations/withdrawal-requests' },
    ],
  },
  {
    label: 'Barcode / Handheld',
    key: 'barcode_handheld',
    items: [
      { label: 'ศูนย์สแกน / รับเข้า-เบิกออก', key: 'scan_center', path: '/handheld' },
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
      {
        label: 'Facility Usage',
        key: 'customer_facility_usage',
        path: '/customer/facility-usage',
        testId: 'customer-facility-usage-menu-item',
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
      { label: 'ข้อมูลลูกค้า', key: 'master_data', path: '/master/customers' },
      { label: 'Location คลังสินค้า', key: 'warehouse_location_setup', path: '/admin/warehouse-locations' },
      { label: 'User Management', key: 'user_management', path: '/admin/users', testId: 'user-management-menu-item' },
      { label: 'Customer Product Catalog', key: 'customer_product_catalog_admin', path: '/admin/customer-products', testId: 'customer-product-catalog-admin-menu-item' },
      { label: 'Customer Request Policy', key: 'customer_request_policy_admin', path: '/admin/customer-request-policy', testId: 'customer-request-policy-admin-menu-item' },
      { label: 'อัตราค่าบริการตามสินค้า', key: 'product_service_rates_admin', path: '/admin/product-service-rates' },
      { label: 'สิทธิ์และบทบาท', key: 'role_permissions_admin', path: '/admin/role-permissions' },
      { label: 'Users and Roles', key: 'users_and_roles', path: '/admin/auth-readiness' },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
