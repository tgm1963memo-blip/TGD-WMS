import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout.jsx';
import { ROUTES } from '../constants/routes.js';
import { AuditPage } from '../features/audit/AuditPage.jsx';
import { CustomersPage } from '../features/customers/CustomersPage.jsx';
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx';
import { AdjustmentPage } from '../features/adjustment/AdjustmentPage.jsx';
import { InventoryPage } from '../features/inventory/InventoryPage.jsx';
import { LocationsPage } from '../features/locations/LocationsPage.jsx';
import { MovementLedgerPage } from '../features/movement-ledger/MovementLedgerPage.jsx';
import { PickingPage } from '../features/picking/PickingPage.jsx';
import { ProductsPage } from '../features/products/ProductsPage.jsx';
import { ReceivingPage } from '../features/receiving/ReceivingPage.jsx';
import { TransferPage } from '../features/transfer/TransferPage.jsx';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path={ROUTES.dashboard.path} element={<DashboardPage />} />
        <Route path={ROUTES.customers.path} element={<CustomersPage />} />
        <Route path={ROUTES.products.path} element={<ProductsPage />} />
        <Route path={ROUTES.locations.path} element={<LocationsPage />} />
        <Route path={ROUTES.receiving.path} element={<ReceivingPage />} />
        <Route path={ROUTES.inventory.path} element={<InventoryPage />} />
        <Route path={ROUTES.movementLedger.path} element={<MovementLedgerPage />} />
        <Route path={ROUTES.picking.path} element={<PickingPage />} />
        <Route path={ROUTES.transfer.path} element={<TransferPage />} />
        <Route path={ROUTES.adjustment.path} element={<AdjustmentPage />} />
        <Route path={ROUTES.audit.path} element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.dashboard.path} replace />} />
    </Routes>
  );
}

