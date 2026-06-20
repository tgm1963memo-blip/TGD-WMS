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
import { InventoryBalancePage } from '../features/inventory/InventoryBalancePage.jsx';
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
import { BillingMovementWeightReportPage } from '../features/reports/BillingMovementWeightReportPage.jsx';
import { InvoiceDraftListPage } from '../features/billing/InvoiceDraftListPage.jsx';
import { InvoiceDraftDetailPage } from '../features/billing/InvoiceDraftDetailPage.jsx';
import { SettingsPage } from '../features/settings/SettingsPage.jsx';
import { EmailSettingsPage } from '../features/settings/EmailSettingsPage.jsx';
import { ChangePasswordPage } from '../features/settings/ChangePasswordPage.jsx';
import { DocumentBrandingPreviewPage } from '../features/admin/DocumentBrandingPreviewPage.jsx';
import { AuthReadinessPage } from '../features/admin/AuthReadinessPage.jsx';
import { DocumentBrandingAdminPage } from '../features/admin/DocumentBrandingAdminPage.jsx';
import { UserManagementPage } from '../features/admin/UserManagementPage.jsx';
import { WarehouseLocationSetupPage } from '../features/admin/WarehouseLocationSetupPage.jsx';
import { CustomerProductCatalogAdminPage } from '../features/admin/CustomerProductCatalogAdminPage.jsx';
import { CustomerRequestPolicyAdminPage } from '../features/admin/CustomerRequestPolicyAdminPage.jsx';
import { CustomerStorageRateRulesAdminPage } from '../features/admin/CustomerStorageRateRulesAdminPage.jsx';
import { CustomerProductServiceRatesPage } from '../features/admin/CustomerProductServiceRatesPage.jsx';
import { RolePermissionsAdminPage } from '../features/admin/RolePermissionsAdminPage.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { getPageShellClassName } from '../config/pageShellPresentation.js';
import { UatOnly } from '../components/common/UatOnly.jsx';

import { AuthGuard } from '../features/auth/AuthGuard.jsx';
import { RoutePermissionGuard } from '../features/auth/RoutePermissionGuard.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { DefaultHomeRedirect } from '../features/auth/DefaultHomeRedirect.jsx';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage.jsx';
import { ProfileSettingsPage } from '../features/settings/ProfileSettingsPage.jsx';
import { CustomerPortalDashboardPage } from '../features/customer/CustomerPortalDashboardPage.jsx';
import { CustomerDepositRequestPage } from '../features/customer/CustomerDepositRequestPage.jsx';
import { CustomerDepositRequestCreatePage } from '../features/customer/CustomerDepositRequestCreatePage.jsx';
import { CustomerDepositRequestDetailPage } from '../features/customer/CustomerDepositRequestDetailPage.jsx';
import { CustomerStockBalancePage } from '../features/customer/CustomerStockBalancePage.jsx';
import { CustomerWithdrawalRequestPage } from '../features/customer/CustomerWithdrawalRequestPage.jsx';
import { CustomerWithdrawalRequestCreatePage } from '../features/customer/CustomerWithdrawalRequestCreatePage.jsx';
import { CustomerWithdrawalRequestDetailPage } from '../features/customer/CustomerWithdrawalRequestDetailPage.jsx';
import { CustomerFacilityUsageRequestPage } from '../features/customer/CustomerFacilityUsageRequestPage.jsx';
import { CustomerRequestHistoryPage } from '../features/customer/CustomerRequestHistoryPage.jsx';
import { CustomerProductCatalogPage } from '../features/customer/CustomerProductCatalogPage.jsx';
import { CustomerAdminDepositReviewPage } from '../features/customer/CustomerAdminDepositReviewPage.jsx';
import { CustomerWarehouseReceivingDemoPage } from '../features/customer/CustomerWarehouseReceivingDemoPage.jsx';
import { CustomerAdminReceivingVerificationPage } from '../features/customer/CustomerAdminReceivingVerificationPage.jsx';
import { CustomerAdminWithdrawalReviewPage } from '../features/customer/CustomerAdminWithdrawalReviewPage.jsx';
import { CustomerWarehousePickingLoadingDemoPage } from '../features/customer/CustomerWarehousePickingLoadingDemoPage.jsx';

function LegacyPlaceholderPage({ title }) {
  return (
    <section className={getPageShellClassName()}>
      <PageHeader title={title} description="Read-only operational placeholder for the UI foundation." />
      <UatOnly><p className="sprint-status">Sprint status: placeholder only</p></UatOnly>
    </section>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<RoutePermissionGuard />}>
          {/* Handheld scanner — full-screen mobile, no sidebar */}
          <Route path="/handheld" element={<HandheldPage />} />

          <Route element={<AppLayout />}>
          <Route index element={<DefaultHomeRedirect />} />
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
          <Route path="/inventory" element={<InventoryBalancePage />} />
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
          <Route path="/reports/billing-movement-weight" element={<BillingMovementWeightReportPage />} />
          <Route path="/billing/invoice-drafts" element={<InvoiceDraftListPage />} />
          <Route path="/billing/invoice-drafts/:draftId" element={<InvoiceDraftDetailPage />} />
          <Route path="/admin/document-branding" element={<DocumentBrandingAdminPage />} />
          <Route path="/admin/document-branding-preview" element={<DocumentBrandingPreviewPage />} />
          <Route path="/admin/auth-readiness" element={<AuthReadinessPage />} />
          <Route path="/admin/users" element={<UserManagementPage />} />
          <Route path="/admin/warehouse-locations" element={<WarehouseLocationSetupPage />} />
          <Route path="/admin/customer-products" element={<CustomerProductCatalogAdminPage />} />
          <Route path="/admin/customer-request-policy" element={<CustomerRequestPolicyAdminPage />} />
          <Route path="/admin/customer-storage-rates" element={<CustomerStorageRateRulesAdminPage />} />
          <Route path="/admin/product-service-rates" element={<CustomerProductServiceRatesPage />} />
          <Route path="/admin/role-permissions" element={<RolePermissionsAdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/profile" element={<ProfileSettingsPage />} />
          <Route path="/settings/email" element={<EmailSettingsPage />} />
          <Route path="/settings/change-password" element={<ChangePasswordPage />} />
          <Route path="/customer" element={<CustomerPortalDashboardPage />} />
          <Route path="/customer/deposit-request" element={<CustomerDepositRequestPage />} />
          <Route path="/customer/deposit-request/new" element={<CustomerDepositRequestCreatePage />} />
          <Route path="/customer/deposit-request/:requestId" element={<CustomerDepositRequestDetailPage />} />
          <Route path="/customer/stock-balance" element={<CustomerStockBalancePage />} />
          <Route path="/customer/withdrawal-request" element={<CustomerWithdrawalRequestPage />} />
          <Route path="/customer/withdrawal-request/new" element={<CustomerWithdrawalRequestCreatePage />} />
          <Route path="/customer/withdrawal-request/:requestId" element={<CustomerWithdrawalRequestDetailPage />} />
          <Route path="/customer/requests" element={<CustomerRequestHistoryPage />} />
          <Route path="/customer/facility-usage" element={<CustomerFacilityUsageRequestPage />} />
          <Route path="/customer/products" element={<CustomerProductCatalogPage />} />
          <Route path="/customer/admin/deposit-review" element={<CustomerAdminDepositReviewPage />} />
          <Route path="/customer/admin/deposit-review/:requestId" element={<CustomerAdminDepositReviewPage />} />
          <Route path="/customer/warehouse/receiving" element={<CustomerWarehouseReceivingDemoPage />} />
          <Route path="/customer/admin/receiving-verification" element={<CustomerAdminReceivingVerificationPage />} />
          <Route path="/customer/admin/withdrawal-review" element={<CustomerAdminWithdrawalReviewPage />} />
          <Route path="/customer/warehouse/picking-loading" element={<CustomerWarehousePickingLoadingDemoPage />} />

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
        </Route>
      </Route>
      <Route path="*" element={<DefaultHomeRedirect />} />
    </Routes>
  );
}
