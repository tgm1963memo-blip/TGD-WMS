import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../../components/operations/QuantitySummaryCard.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getReceivingDocumentById } from '../../../services/receivingService.js';

const lineColumns = [
  { key: 'line_no', header: 'Line' },
  { key: 'product_id', header: 'Product' },
  { key: 'lot_no', header: 'Lot' },
  { key: 'to_location_id', header: 'Location' },
  { key: 'expected_qty', header: 'Expected' },
  { key: 'received_qty', header: 'Received' },
  { key: 'uom', header: 'UOM' },
];

export function ReceivingDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getReceivingDocumentById(id).then(({ data, error }) => {
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
      <PageHeader title="Receiving Detail" description="Read-only receiving document detail." />
      <Link className="action-link" to="/operations/receiving">Back to receiving</Link>
      <DocumentStatusCard
        title={document?.receiving_no}
        status={document?.status}
        fields={[
          { label: 'Customer', value: document?.customer_id },
          { label: 'Warehouse', value: document?.warehouse_id },
          { label: 'Type', value: document?.receiving_type },
          { label: 'Reference', value: document?.source_no },
          { label: 'Created At', value: document?.created_at },
        ]}
      />
      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={document?.tgd_receiving_lines?.length ?? 0} helperText="Read-only receiving line count." />
      </DocumentSection>
      <DocumentSection title="Lines">
        <DocumentLineTable lines={document?.tgd_receiving_lines ?? []} columns={lineColumns} />
      </DocumentSection>
    </section>
  );
}
