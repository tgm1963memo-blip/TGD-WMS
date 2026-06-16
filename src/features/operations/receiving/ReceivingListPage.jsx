import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentFilterBar } from '../../../components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../../components/operations/DocumentToolbar.jsx';
import { documentLink, renderStatusBadge } from '../../../components/operations/documentListColumnHelpers.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { useUserRole } from '../../../features/auth/UserRoleProvider.jsx';
import { getPageShellClassName, isProductionPresentationActive } from '../../../config/pageShellPresentation.js';
import { canPerformReceivingWrite } from '../../../security/receivingWritePermissions.js';
import { getReceivingDocuments } from '../../../services/receivingService.js';
import { useTranslation } from '../../../i18n/languageProvider.jsx';

const columns = [
  {
    key: 'receiving_no',
    header: 'Receiving No',
    render: (row) => documentLink(`/operations/receiving/${row.id}`, row.receiving_no || row.document_no),
  },
  { key: 'customer_id', header: 'Customer' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'status', header: 'Status', render: renderStatusBadge },
  { key: 'receiving_type', header: 'Type' },
  { key: 'expected_receive_date', header: 'Date' },
  { key: 'created_at', header: 'Created At' },
  {
    key: 'actions',
    header: 'Actions',
    render: (row) => <Link className="document-link" to={`/operations/receiving/${row.id}`}>View detail</Link>,
  },
];

export function ReceivingListPage() {
  const t = useTranslation();
  const goLive = isProductionPresentationActive();
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const { role: userRole } = useUserRole();
  const canWrite = canPerformReceivingWrite(userRole);

  useEffect(() => {
    let isMounted = true;

    getReceivingDocuments().then(({ data, error }) => {
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
        title={t('receiving') || 'Receiving'}
        description={goLive ? t('receiving_list_description_golive') : 'Inbound receiving document list.'}
      />

      {!goLive ? (
        <>
          <p className="sprint-status sprint-status--compact">Sprint status: controlled draft only</p>
          <section className="warning-panel meeting-safety-panel" data-testid="receiving-source-document-guidance" role="status">
            <p>{t('receiving_source_document_guidance')}</p>
            <p style={{ margin: '8px 0 0' }}>{t('receiving_internal_draft_note')}</p>
          </section>
          <section className="card customer-portal-action-card" style={{ marginBottom: 16, maxWidth: 420 }}>
            <Link className="auth-text-link" data-testid="receiving-customer-deposit-demo-link" to="/customer/warehouse/receiving">
              {t('receiving_customer_deposit_demo_link')}
            </Link>
          </section>
        </>
      ) : (
        <section className="card customer-portal-action-card operations-live-action-card" style={{ marginBottom: 16, maxWidth: 480 }}>
          <Link className="auth-text-link" data-testid="receiving-customer-deposit-live-link" to="/customer/admin/deposit-review">
            {t('receiving_customer_deposit_live_link')}
          </Link>
        </section>
      )}

      <DocumentToolbar
        title="Receiving Documents"
        createHref={canWrite ? '/operations/receiving/create' : null}
        createLabel={canWrite ? t('receiving_create_internal_draft') : null}
        onRefresh={() => window.location.reload()}
      />
      <DocumentFilterBar onChange={() => {}} />
      <DataTable
        columns={columns}
        data={state.data}
        loading={state.loading}
        error={state.error}
        emptyMessage={goLive ? t('receiving_empty_message_golive') : 'No receiving documents found.'}
      />
    </section>
  );
}
