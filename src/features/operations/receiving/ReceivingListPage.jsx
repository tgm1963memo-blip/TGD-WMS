import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerDepositNotificationsSection } from '../../../components/customer/CustomerDepositNotificationsSection.jsx';
import { documentLink, renderStatusBadge } from '../../../components/operations/documentListColumnHelpers.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getPageShellClassName, isProductionPresentationActive } from '../../../config/pageShellPresentation.js';
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
        description={goLive ? t('receiving_list_description_golive') : t('receiving_customer_deposit_section_hint')}
      />

      {!goLive ? (
        <section className="warning-panel meeting-safety-panel" data-testid="receiving-source-document-guidance" role="status">
          <p>{t('receiving_source_document_guidance')}</p>
        </section>
      ) : null}

      <CustomerDepositNotificationsSection />

      <div className="table-card" style={{ marginTop: 24 }}>
        <div className="table-card-header">
          <h3>{t('receiving_documents_linked_title') || 'Receiving documents (from customer deposit requests)'}</h3>
        </div>
        <DataTable
          columns={columns}
          data={state.data}
          loading={state.loading}
          error={state.error}
          emptyMessage={t('receiving_documents_empty') || 'No receiving documents linked to customer deposit requests yet.'}
        />
      </div>
    </section>
  );
}
