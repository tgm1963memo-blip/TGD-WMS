import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx';
import { InventoryDashboardPage } from '../features/dashboard/InventoryDashboardPage.jsx';
import { CustomersPage } from '../features/master/CustomersPage.jsx';
import { ProductsPage } from '../features/master/ProductsPage.jsx';
import { WarehousesPage } from '../features/master/WarehousesPage.jsx';
import { LocationsPage } from '../features/master/LocationsPage.jsx';
import { ReceivingPage } from '../features/operations/ReceivingPage.jsx';
import { PutawayPage } from '../features/operations/PutawayPage.jsx';
import { ReceivingCreatePage } from '../features/operations/receiving/ReceivingCreatePage.jsx';
import { ReceivingDetailPage } from '../features/operations/receiving/ReceivingDetailPage.jsx';
import { PutawayCreatePage } from '../features/operations/putaway/PutawayCreatePage.jsx';
import { PutawayDetailPage } from '../features/operations/putaway/PutawayDetailPage.jsx';
import { TransferPage } from '../features/operations/TransferPage.jsx';
import { TransferCreatePage } from '../features/operations/transfer/TransferCreatePage.jsx';
import { TransferDetailPage } from '../features/operations/transfer/TransferDetailPage.jsx';
import { AdjustmentPage } from '../features/operations/AdjustmentPage.jsx';
import { AdjustmentCreatePage } from '../features/operations/adjustment/AdjustmentCreatePage.jsx';
import { AdjustmentDetailPage } from '../features/operations/adjustment/AdjustmentDetailPage.jsx';
import { WithdrawalRequestsPage } from '../features/operations/WithdrawalRequestsPage.jsx';
import { WithdrawalRequestCreatePage } from '../features/operations/withdrawal/WithdrawalRequestCreatePage.jsx';
import { WithdrawalRequestDetailPage } from '../features/operations/withdrawal/WithdrawalRequestDetailPage.jsx';
import { AllocationsPage } from '../features/operations/AllocationsPage.jsx';
import { AllocationCreatePage } from '../features/operations/allocation/AllocationCreatePage.jsx';
import { AllocationDetailPage } from '../features/operations/allocation/AllocationDetailPage.jsx';
import { PickingPage } from '../features/operations/PickingPage.jsx';
import { PickingCreatePage } from '../features/operations/picking/PickingCreatePage.jsx';
import { PickingDetailPage } from '../features/operations/picking/PickingDetailPage.jsx';
import { PickingDraftWorkflowPage } from '../features/operations/picking/PickingDraftWorkflowPage.jsx';
import { DispatchPage } from '../features/operations/DispatchPage.jsx';
import { DispatchCreatePage } from '../features/operations/dispatch/DispatchCreatePage.jsx';
import { DispatchDetailPage } from '../features/operations/dispatch/DispatchDetailPage.jsx';
import { OutboundDraftPage } from '../features/operations/outbound/OutboundDraftPage.jsx';
import { OutboundListPage } from '../features/operations/outbound/OutboundListPage.jsx';
import { HandheldPage } from '../features/handheld/HandheldPage.jsx';
import { StockCountPage } from '../features/stock-count/StockCountPage.jsx';
import { StockCountCreatePage } from '../features/stock-count/StockCountCreatePage.jsx';
import { StockCountDetailPage } from '../features/stock-count/StockCountDetailPage.jsx';
import { ReportsPage } from '../features/reports/ReportsPage.jsx';
import { MovementLedgerReportPage } from '../features/reports/MovementLedgerReportPage.jsx';
import { CustomerStorageBalanceReportPage } from '../features/reports/CustomerStorageBalanceReportPage.jsx';
import { StorageAgingReportPage } from '../features/reports/StorageAgingReportPage.jsx';
import { WarehouseOperationPerformanceReportPage } from '../features/reports/WarehouseOperationPerformanceReportPage.jsx';
import { MonthlyStorageBillingSummaryPage } from '../features/reports/MonthlyStorageBillingSummaryPage.jsx';
import { AccountingChargeStagingPreviewPage } from '../features/reports/AccountingChargeStagingPreviewPage.jsx';
import { AccountingChargeHandoffReviewPage } from '../features/reports/AccountingChargeHandoffReviewPage.jsx';
import { SettingsPage } from '../features/settings/SettingsPage.jsx';
import { DocumentBrandingPreviewPage } from '../features/admin/DocumentBrandingPreviewPage.jsx';
import { AuthReadinessPage } from '../features/admin/AuthReadinessPage.jsx';
import { DocumentBrandingAdminPage } from '../features/admin/DocumentBrandingAdminPage.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';

function LegacyPlaceholderPage({ title }) {
  return (
    <section className="page-shell">
      <PageHeader title={title} description="Read-only operational placeholder for the UI foundation." />
      <p className="sprint-status">Sprint status: placeholder only</p>
    </section>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/inventory" element={<InventoryDashboardPage />} />
        <Route path="/master/customers" element={<CustomersPage />} />
        <Route path="/master/products" element={<ProductsPage />} />
        <Route path="/master/warehouses" element={<WarehousesPage />} />
        <Route path="/master/locations" element={<LocationsPage />} />
        <Route path="/operations/receiving" element={<ReceivingPage />} />
        <Route path="/operations/receiving/create" element={<ReceivingCreatePage />} />
        <Route path="/operations/receiving/new" element={<ReceivingCreatePage />} />
        <Route path="/operations/receiving/:id" element={<ReceivingDetailPage />} />
        <Route path="/operations/putaway" element={<PutawayPage />} />
        <Route path="/operations/putaway/new" element={<PutawayCreatePage />} />
        <Route path="/operations/putaway/:id" element={<PutawayDetailPage />} />
        <Route path="/operations/transfer" element={<TransferPage />} />
        <Route path="/operations/transfer/new" element={<TransferCreatePage />} />
        <Route path="/operations/transfer/:id" element={<TransferDetailPage />} />
        <Route path="/operations/adjustment" element={<AdjustmentPage />} />
        <Route path="/operations/adjustment/new" element={<AdjustmentCreatePage />} />
        <Route path="/operations/adjustment/:id" element={<AdjustmentDetailPage />} />
        <Route path="/operations/withdrawal-requests" element={<WithdrawalRequestsPage />} />
        <Route path="/operations/withdrawal-requests/new" element={<WithdrawalRequestCreatePage />} />
        <Route path="/operations/withdrawal-requests/:id" element={<WithdrawalRequestDetailPage />} />
        <Route path="/operations/allocations" element={<AllocationsPage />} />
        <Route path="/operations/allocations/new" element={<AllocationCreatePage />} />
        <Route path="/operations/allocations/:id" element={<AllocationDetailPage />} />
        <Route path="/operations/picking" element={<PickingPage />} />
        <Route path="/operations/picking-draft" element={<PickingDraftWorkflowPage />} />
        <Route path="/operations/picking/new" element={<PickingCreatePage />} />
        <Route path="/operations/picking/:id" element={<PickingDetailPage />} />
        <Route path="/operations/dispatch" element={<DispatchPage />} />
        <Route path="/operations/dispatch/new" element={<DispatchCreatePage />} />
        <Route path="/operations/dispatch/:id" element={<DispatchDetailPage />} />
        <Route path="/operations/outbound" element={<OutboundListPage />} />
        <Route path="/operations/outbound-draft" element={<OutboundDraftPage />} />
        <Route path="/handheld" element={<HandheldPage />} />
        <Route path="/stock-count" element={<StockCountPage />} />
        <Route path="/stock-count/new" element={<StockCountCreatePage />} />
        <Route path="/stock-count/:id" element={<StockCountDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/movement-ledger" element={<MovementLedgerReportPage />} />
        <Route path="/reports/customer-storage-balance" element={<CustomerStorageBalanceReportPage />} />
        <Route path="/reports/storage-aging" element={<StorageAgingReportPage />} />
        <Route path="/reports/warehouse-operation-performance" element={<WarehouseOperationPerformanceReportPage />} />
        <Route path="/reports/monthly-storage-billing-summary" element={<MonthlyStorageBillingSummaryPage />} />
        <Route path="/reports/accounting-charge-staging-preview" element={<AccountingChargeStagingPreviewPage />} />
        <Route path="/reports/accounting-charge-handoff-review" element={<AccountingChargeHandoffReviewPage />} />
        <Route path="/admin/document-branding" element={<DocumentBrandingAdminPage />} />
        <Route path="/admin/document-branding-preview" element={<DocumentBrandingPreviewPage />} />
        <Route path="/admin/auth-readiness" element={<AuthReadinessPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/locations" element={<LocationsPage />} />
        <Route path="/receiving" element={<ReceivingPage />} />
        <Route path="/picking" element={<PickingPage />} />
        <Route path="/transfer" element={<TransferPage />} />
        <Route path="/adjustment" element={<AdjustmentPage />} />
        <Route path="/inventory" element={<LegacyPlaceholderPage title="Inventory" />} />
        <Route path="/movement-ledger" element={<LegacyPlaceholderPage title="Movement Ledger" />} />
        <Route path="/audit" element={<LegacyPlaceholderPage title="Audit" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

