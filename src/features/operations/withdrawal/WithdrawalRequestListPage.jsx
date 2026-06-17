import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerWithdrawalNotificationsSection } from '../../../components/customer/CustomerWithdrawalNotificationsSection.jsx';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { documentLink, renderStatusBadge } from '../../../components/operations/documentListColumnHelpers.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getPageShellClassName, isProductionPresentationActive } from '../../../config/pageShellPresentation.js';
import { getWithdrawalRequests } from '../../../services/withdrawalRequestService.js';
import { useTranslation } from '../../../i18n/languageProvider.jsx';

const columns = [
  { key: 'withdrawal_no', header: 'Withdrawal No', render: (row) => documentLink(`/operations/withdrawal-requests/${row.id}`, row.withdrawal_no) },
  { key: 'customer_id', header: 'Customer' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: renderStatusBadge },
  { key: 'withdrawal_type', header: 'Type' },
  { key: 'requested_dispatch_date', header: 'Requested Dispatch' },
  { key: 'created_at', header: 'Created At' },
];

export function WithdrawalRequestListPage() {
  const t = useTranslation();
  const goLive = isProductionPresentationActive();
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getWithdrawalRequests().then(({ data, error }) => {
      if (isMounted) {
        setState({ data: data ?? [], loading: false, error });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className={getPageShellClassName()}>
      <PageHeader
        title="Withdrawal Requests"
        description={goLive ? t('withdrawal_list_description_golive') : 'Customer withdrawal request list.'}
      />

      {!goLive ? (
        <>
          <section className="warning-panel meeting-safety-panel" data-testid="withdrawal-source-document-guidance" role="status">
            <p>{t('withdrawal_source_document_guidance')}</p>
          </section>
          <section className="card customer-portal-action-card" style={{ marginBottom: 16, maxWidth: 420 }}>
            <Link className="auth-text-link" data-testid="withdrawal-customer-request-demo-link" to="/customer/warehouse/picking-loading">
              {t('withdrawal_customer_request_demo_link')}
            </Link>
          </section>
        </>
      ) : (
        <section className="card customer-portal-action-card operations-live-action-card" style={{ marginBottom: 16, maxWidth: 480 }}>
          <Link className="auth-text-link" data-testid="withdrawal-customer-request-live-link" to="/customer/admin/withdrawal-review">
            {t('withdrawal_customer_request_live_link')}
          </Link>
        </section>
      )}

      <CustomerWithdrawalNotificationsSection />

      <DocumentToolbar title="Withdrawal Requests" createHref="/operations/withdrawal-requests/new" onRefresh={() => window.location.reload()} />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage={goLive ? t('withdrawal_empty_message_golive') : 'No withdrawal requests found.'} />
    </section>
  );
}
