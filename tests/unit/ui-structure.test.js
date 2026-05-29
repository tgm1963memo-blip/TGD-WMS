import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 5A UI structure', () => {
  const appSqlForbiddenTerms = [
    'tgd_post_inventory_movement',
    'tgd_post_receiving_document',
    'tgd_post_putaway_document',
    'tgd_post_transfer_document',
    'tgd_post_adjustment_document',
    'tgd_post_withdrawal_allocation',
    'tgd_confirm_picking_document',
    'tgd_post_dispatch_document',
  ];

  it('keeps App.jsx small and delegates routing', () => {
    const appPath = resolve(projectRoot, 'src/app/App.jsx');
    const appSource = readFileSync(appPath, 'utf8');

    expect(statSync(appPath).isFile()).toBe(true);
    expect(appSource.split('\n').length).toBeLessThanOrEqual(14);
    expect(appSource).toContain('AppRoutes');
    expect(appSource).not.toContain('tgd_');
  });

  it('creates route, navigation, layout, and shared UI files', () => {
    [
      'src/app/routes.jsx',
      'src/app/navigation.js',
      'src/components/layout/AppLayout.jsx',
      'src/components/layout/Sidebar.jsx',
      'src/components/layout/Topbar.jsx',
      'src/components/ui/DataTable.jsx',
      'src/components/ui/PageHeader.jsx',
      'src/components/ui/StatusBadge.jsx',
      'src/components/ui/LoadingState.jsx',
      'src/components/ui/ErrorState.jsx',
      'src/components/ui/EmptyState.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('defines required route groups', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    [
      '/dashboard',
      '/master/customers',
      '/master/products',
      '/master/warehouses',
      '/master/locations',
      '/operations/receiving',
      '/operations/putaway',
      '/operations/transfer',
      '/operations/adjustment',
      '/operations/withdrawal-requests',
      '/operations/allocations',
      '/operations/picking',
      '/operations/dispatch',
      '/handheld',
      '/stock-count',
      '/reports',
      '/settings',
    ].forEach((routePath) => {
      expect(routesSource).toContain(routePath);
    });
  });

  it('creates read-only master data service functions', () => {
    const servicePath = resolve(projectRoot, 'src/services/masterDataService.js');
    const serviceSource = readFileSync(servicePath, 'utf8');

    expect(statSync(servicePath).isFile()).toBe(true);
    ['getCustomers', 'getProducts', 'getWarehouses', 'getLocations'].forEach((functionName) => {
      expect(serviceSource).toContain(`function ${functionName}`);
    });
    expect(serviceSource).not.toContain('.insert(');
    expect(serviceSource).not.toContain('.update(');
    expect(serviceSource).not.toContain('.delete(');
    expect(serviceSource).not.toContain('.rpc(');
  });

  it('does not import posting RPC functions into UI pages', () => {
    const uiFiles = [
      'src/app/App.jsx',
      'src/app/routes.jsx',
      'src/components/layout/AppLayout.jsx',
      'src/features/dashboard/DashboardPage.jsx',
      'src/features/master/CustomersPage.jsx',
      'src/features/master/ProductsPage.jsx',
      'src/features/master/WarehousesPage.jsx',
      'src/features/master/LocationsPage.jsx',
      'src/features/operations/ReceivingPage.jsx',
      'src/features/operations/PutawayPage.jsx',
      'src/features/operations/TransferPage.jsx',
      'src/features/operations/AdjustmentPage.jsx',
      'src/features/operations/WithdrawalRequestsPage.jsx',
      'src/features/operations/AllocationsPage.jsx',
      'src/features/operations/PickingPage.jsx',
      'src/features/operations/DispatchPage.jsx',
      'src/features/handheld/HandheldPage.jsx',
      'src/features/stock-count/StockCountPage.jsx',
      'src/features/reports/ReportsPage.jsx',
      'src/features/settings/SettingsPage.jsx',
    ];

    const combinedUiSource = uiFiles.map(readProjectFile).join('\n');

    appSqlForbiddenTerms.forEach((term) => {
      expect(combinedUiSource).not.toContain(term);
    });
  });

  it('does not create Express sync artifacts or rely on legacy-reference content', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'src/features/handheld/HandheldPage.jsx'))).toBe(true);
  });
});
