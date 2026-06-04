export const navigationGroups = [
  {
    label: 'Dashboard',
    items: [{ label: 'Dashboard', path: '/dashboard' }],
  },
  {
    label: 'Master Data',
    items: [
      { label: 'Customers', path: '/master/customers' },
      { label: 'Products', path: '/master/products' },
      { label: 'Warehouses', path: '/master/warehouses' },
      { label: 'Locations', path: '/master/locations' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Receiving', path: '/operations/receiving' },
      { label: 'Putaway', path: '/operations/putaway' },
      { label: 'Transfer', path: '/operations/transfer' },
      { label: 'Adjustment', path: '/operations/adjustment' },
      { label: 'Withdrawal Requests', path: '/operations/withdrawal-requests' },
      { label: 'Allocations', path: '/operations/allocations' },
      { label: 'Picking', path: '/operations/picking' },
      { label: 'Dispatch', path: '/operations/dispatch' },
      { label: 'Outbound Documents', path: '/operations/outbound' },
      { label: 'Outbound Draft', path: '/operations/outbound-draft' },
    ],
  },
  {
    label: 'Handheld',
    items: [{ label: 'Handheld', path: '/handheld' }],
  },
  {
    label: 'Stock Count',
    items: [{ label: 'Stock Count', path: '/stock-count' }],
  },
  {
    label: 'Reports',
    items: [{ label: 'Reports', path: '/reports' }],
  },
  {
    label: 'Settings',
    items: [{ label: 'Settings', path: '/settings' }],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
