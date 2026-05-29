import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../../components/operations/QuantitySummaryCard.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getTransferDocumentById } from '../../../services/transferService.js';

const lineColumns = [
  { key: 'line_no', header: 'Line' },
  { key: 'product_id', header: 'Product' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'from_location_id', header: 'From Location' },
  { key: 'to_location_id', header: 'To Location' },
  { key: 'planned_qty', header: 'Planned' },
  { key: 'transfer_qty', header: 'Transfer Qty' },
  { key: 'uom', header: 'UOM' },
];

export function TransferDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getTransferDocumentById(id).then(({ data, error }) => {
      if (isMounted) {
        setState({ data, loading: false, error });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState message={state.error.message} />;

  const document = state.data;

  return (
    <section className="page-shell">
      <PageHeader title="Transfer Detail" description="Read-only transfer document detail." />
      <Link className="action-link" to="/operations/transfer">Back to transfer</Link>
      <DocumentStatusCard
        title={document?.transfer_no}
        status={document?.status}
        fields={[
          { label: 'Customer', value: document?.customer_id },
          { label: 'From Warehouse', value: document?.from_warehouse_id },
          { label: 'To Warehouse', value: document?.to_warehouse_id },
          { label: 'Type', value: document?.transfer_type },
          { label: 'Source', value: document?.source_no },
          { label: 'Created At', value: document?.created_at },
        ]}
      />
      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={document?.tgd_transfer_lines?.length ?? 0} helperText="Read-only transfer line count." />
      </DocumentSection>
      <DocumentSection title="Lines">
        <DocumentLineTable lines={document?.tgd_transfer_lines ?? []} columns={lineColumns} />
      </DocumentSection>
    </section>
  );
}
