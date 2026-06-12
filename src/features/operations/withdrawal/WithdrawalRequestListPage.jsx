import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { getWithdrawalRequests } from '../../../services/withdrawalRequestService.js';
import { useTranslation } from '../../../i18n/languageProvider.jsx';

const columns = [
  { key: 'withdrawal_no', header: 'Withdrawal No', render: (row) => <Link to={`/operations/withdrawal-requests/${row.id}`}>{row.withdrawal_no}</Link> },
  { key: 'customer_id', header: 'Customer' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} /> },
  { key: 'withdrawal_type', header: 'Type' },
  { key: 'requested_dispatch_date', header: 'Requested Dispatch' },
  { key: 'created_at', header: 'Created At' },
];

export function WithdrawalRequestListPage() {
  const t = useTranslation();
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
    <section className="page-shell">
      <PageHeader title="Withdrawal Requests" description="Customer withdrawal request list." />
      <p className="sprint-status">Sprint status: placeholder only</p>
      <section className="warning-panel meeting-safety-panel" data-testid="withdrawal-source-document-guidance" role="status">
        <p>{t('withdrawal_source_document_guidance')}</p>
      </section>
      <section className="card customer-portal-action-card" style={{ marginBottom: 16, maxWidth: 420 }}>
        <Link className="auth-text-link" data-testid="withdrawal-customer-request-demo-link" to="/customer/warehouse/picking-loading">
          {t('withdrawal_customer_request_demo_link')}
        </Link>
      </section>
      <DocumentToolbar title="Withdrawal Requests" createHref="/operations/withdrawal-requests/new" onRefresh={() => window.location.reload()} />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable columns={columns} data={state.data} loading={state.loading} error={state.error} emptyMessage="No withdrawal requests found." />
    </section>
  );
}
