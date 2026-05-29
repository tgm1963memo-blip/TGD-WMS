export const ROUTES = {
  dashboard: {
    path: '/',
    label: 'Dashboard',
  },
  customers: {
    path: '/customers',
    label: 'Customers',
  },
  products: {
    path: '/products',
    label: 'Products',
  },
  locations: {
    path: '/locations',
    label: 'Locations',
  },
  receiving: {
    path: '/receiving',
    label: 'Receiving',
  },
  inventory: {
    path: '/inventory',
    label: 'Inventory',
  },
  movementLedger: {
    path: '/movement-ledger',
    label: 'Movement Ledger',
  },
  picking: {
    path: '/picking',
    label: 'Picking',
  },
  transfer: {
    path: '/transfer',
    label: 'Transfer',
  },
  adjustment: {
    path: '/adjustment',
    label: 'Adjustment',
  },
  audit: {
    path: '/audit',
    label: 'Audit',
  },
};

export const NAV_ROUTES = Object.values(ROUTES);

