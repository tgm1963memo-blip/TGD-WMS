import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx';
import { CustomersPage } from '../features/master/CustomersPage.jsx';
import { ReceivingPage } from '../features/operations/ReceivingPage.jsx';
import { ReceivingDetailPage } from '../features/operations/receiving/ReceivingDetailPage.jsx';
import { HandheldPage } from '../features/handheld/HandheldPage.jsx';
import { InventoryBalancePage } from '../features/inventory/InventoryBalancePage.jsx';
import { StockCountReviewPage } from '../features/inventory/StockCountReviewPage.jsx';
import { ReportsPage } from '../features/reports/ReportsPage.jsx';
import { MovementLedgerReportPage } from '../features/reports/MovementLedgerReportPage.jsx';
import { StorageAgingReportPage } from '../features/reports/StorageAgingReportPage.jsx';
import { InvoiceDraftListPage } from '../features/billing/InvoiceDraftListPage.jsx';
import { InvoiceDraftDetailPage } from '../features/billing/InvoiceDraftDetailPage.jsx';
import { EmailSettingsPage } from '../features/settings/EmailSettingsPage.jsx';
import { ChangePasswordPage } from '../features/settings/ChangePasswordPage.jsx';
import { AuthReadinessPage } from '../features/admin/AuthReadinessPage.jsx';
import { UserManagementPage } from '../features/admin/UserManagementPage.jsx';
import { WarehouseLocationSetupPage } from '../features/admin/WarehouseLocationSetupPage.jsx';
import { CustomerProductCatalogAdminPage } from '../features/admin/CustomerProductCatalogAdminPage.jsx';
import { CustomerRequestPolicyAdminPage } from '../features/admin/CustomerRequestPolicyAdminPage.jsx';
import { CustomerProductServiceRatesPage } from '../features/admin/CustomerProductServiceRatesPage.jsx';
import { RolePermissionsAdminPage } from '../features/admin/RolePermissionsAdminPage.jsx';
import { OpeningBalanceImportPage } from '../features/admin/OpeningBalanceImportPage.jsx';

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
import { CustomerDepositRequestBatchImportPage } from '../features/customer/CustomerDepositRequestBatchImportPage.jsx';
import { CustomerDepositRequestDetailPage } from '../features/customer/CustomerDepositRequestDetailPage.jsx';
import { CustomerStockBalancePage } from '../features/customer/CustomerStockBalancePage.jsx';
import { CustomerWithdrawalRequestPage } from '../features/customer/CustomerWithdrawalRequestPage.jsx';
import { CustomerWithdrawalRequestCreatePage } from '../features/customer/CustomerWithdrawalRequestCreatePage.jsx';
import { CustomerWithdrawalRequestDetailPage } from '../features/customer/CustomerWithdrawalRequestDetailPage.jsx';
import { CustomerFacilityUsageRequestPage } from '../features/customer/CustomerFacilityUsageRequestPage.jsx';
import { CustomerRequestHistoryPage } from '../features/customer/CustomerRequestHistoryPage.jsx';
import { CustomerAdminDepositReviewPage } from '../features/customer/CustomerAdminDepositReviewPage.jsx';
import { CustomerAdminWithdrawalReviewPage } from '../features/customer/CustomerAdminWithdrawalReviewPage.jsx';
import { CustomerProductCatalogPage } from '../features/customer/CustomerProductCatalogPage.jsx';
import { CustomerMovementLedgerPage } from '../features/customer/CustomerMovementLedgerPage.jsx';
import { CustomerTeamRolesPage } from '../features/customer/CustomerTeamRolesPage.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<RoutePermissionGuard />}>
          <Route path="/handheld" element={<HandheldPage />} />

          <Route element={<AppLayout />}>
            <Route index element={<DefaultHomeRedirect />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/master/customers" element={<CustomersPage />} />
            <Route path="/operations/receiving" element={<ReceivingPage />} />
            <Route path="/operations/receiving/:id" element={<ReceivingDetailPage />} />
            <Route path="/inventory" element={<InventoryBalancePage />} />
            <Route path="/inventory/count" element={<StockCountReviewPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/movement-ledger" element={<MovementLedgerReportPage />} />
            <Route path="/reports/storage-aging" element={<StorageAgingReportPage />} />
            <Route path="/billing/invoice-drafts" element={<InvoiceDraftListPage />} />
            <Route path="/billing/invoice-drafts/:draftId" element={<InvoiceDraftDetailPage />} />
            <Route path="/admin/auth-readiness" element={<AuthReadinessPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/warehouse-locations" element={<WarehouseLocationSetupPage />} />
            <Route path="/admin/customer-products" element={<CustomerProductCatalogAdminPage />} />
            <Route path="/admin/customer-request-policy" element={<CustomerRequestPolicyAdminPage />} />
            <Route path="/admin/product-service-rates" element={<CustomerProductServiceRatesPage />} />
            <Route path="/admin/role-permissions" element={<RolePermissionsAdminPage />} />
            <Route path="/admin/opening-balance-import" element={<OpeningBalanceImportPage />} />
            <Route path="/settings/profile" element={<ProfileSettingsPage />} />
            <Route path="/settings/email" element={<EmailSettingsPage />} />
            <Route path="/settings/change-password" element={<ChangePasswordPage />} />
            <Route path="/customer" element={<CustomerPortalDashboardPage />} />
            <Route path="/customer/deposit-request" element={<CustomerDepositRequestPage />} />
            <Route path="/customer/deposit-request/new" element={<CustomerDepositRequestCreatePage />} />
            <Route path="/customer/deposit-request/import" element={<CustomerDepositRequestBatchImportPage />} />
            <Route path="/customer/deposit-request/:requestId" element={<CustomerDepositRequestDetailPage />} />
            <Route path="/customer/stock-balance" element={<CustomerStockBalancePage />} />
            <Route path="/customer/withdrawal-request" element={<CustomerWithdrawalRequestPage />} />
            <Route path="/customer/withdrawal-request/new" element={<CustomerWithdrawalRequestCreatePage />} />
            <Route path="/customer/withdrawal-request/:requestId" element={<CustomerWithdrawalRequestDetailPage />} />
            <Route path="/customer/requests" element={<CustomerRequestHistoryPage />} />
            <Route path="/customer/facility-usage" element={<CustomerFacilityUsageRequestPage />} />
            <Route path="/customer/product-catalog" element={<CustomerProductCatalogPage />} />
            <Route path="/customer/movement-ledger" element={<CustomerMovementLedgerPage />} />
            <Route path="/customer/team-roles" element={<CustomerTeamRolesPage />} />
            <Route path="/customer/admin/deposit-review" element={<CustomerAdminDepositReviewPage />} />
            <Route path="/customer/admin/deposit-review/:requestId" element={<CustomerAdminDepositReviewPage />} />
            <Route path="/customer/admin/withdrawal-review" element={<CustomerAdminWithdrawalReviewPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<DefaultHomeRedirect />} />
    </Routes>
  );
}
