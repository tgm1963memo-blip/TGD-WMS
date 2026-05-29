import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../../components/operations/QuantitySummaryCard.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getPickingDocumentById } from '../../../services/pickingService.js';

const lineColumns = [
  { key: 'line_no', header: 'Line' },
  { key: 'product_id', header: 'Product' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'location_id', header: 'Location' },
  { key: 'pallet_id', header: 'Pallet' },
  { key: 'allocated_qty', header: 'Allocated Qty' },
  { key: 'picked_qty', header: 'Picked Qty' },
  { key: 'variance_qty', header: 'Variance Qty' },
  { key: 'uom', header: 'UOM' },
];

export function PickingDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getPickingDocumentById(id).then(({ data, error }) => {
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
      <PageHeader title="Picking Detail" description="Read-only picking document detail." />
      <Link className="action-link" to="/operations/picking">Back to picking</Link>
      <DocumentStatusCard
        title={document?.picking_no}
        status={document?.status}
        fields={[
          { label: 'Withdrawal Request', value: document?.withdrawal_request_id },
          { label: 'Allocation', value: document?.allocation_id },
          { label: 'Customer', value: document?.customer_id },
          { label: 'Warehouse', value: document?.warehouse_id },
          { label: 'Method', value: document?.picking_method },
          { label: 'Created At', value: document?.created_at },
        ]}
      />
      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={document?.tgd_picking_lines?.length ?? 0} helperText="Read-only picking line count." />
      </DocumentSection>
      <DocumentSection title="Lines">
        <DocumentLineTable lines={document?.tgd_picking_lines ?? []} columns={lineColumns} />
      </DocumentSection>
    </section>
  );
}
