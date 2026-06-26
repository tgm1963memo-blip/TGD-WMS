export const SYSTEM_ROUTE_FIXTURES = [
  { path: '/dashboard', testId: null },
  { path: '/operations/receiving', testId: 'receiving-customer-deposit-section' },
  { path: '/inventory', testId: null },
  { path: '/operations/withdrawal-requests', testId: null },
  { path: '/handheld', testId: 'handheld-page', hasAppShell: false },
  { path: '/customer', testId: 'customer-portal-page' },
  { path: '/reports/billing-movement-weight', testId: 'billing-movement-weight-report-page' },
  { path: '/reports/storage-aging', testId: null },
  { path: '/reports/movement-ledger', testId: null },
  { path: '/customer/admin/withdrawal-review', testId: 'customer-admin-withdrawal-review-page' },
  { path: '/master/customers', testId: null },
  { path: '/admin/users', testId: null },
];

export const systemRouteExpectations = SYSTEM_ROUTE_FIXTURES;
