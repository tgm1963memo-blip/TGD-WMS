import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../../components/operations/QuantitySummaryCard.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getDispatchDocumentById } from '../../../services/dispatchService.js';

const lineColumns = [
  { key: 'line_no', header: 'Line' },
  { key: 'product_id', header: 'Product' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'location_id', header: 'Location' },
  { key: 'pallet_id', header: 'Pallet' },
  { key: 'picked_qty', header: 'Picked Qty' },
  { key: 'dispatch_qty', header: 'Dispatch Qty' },
  { key: 'uom', header: 'UOM' },
];

export function DispatchDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getDispatchDocumentById(id).then(({ data, error }) => {
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
      <PageHeader title="Dispatch Detail" description="Read-only dispatch document detail." />
      <Link className="action-link" to="/operations/dispatch">Back to dispatch</Link>
      <DocumentStatusCard
        title={document?.dispatch_no}
        status={document?.status}
        fields={[
          { label: 'Withdrawal Request', value: document?.withdrawal_request_id },
          { label: 'Picking Document', value: document?.picking_document_id },
          { label: 'Customer', value: document?.customer_id },
          { label: 'Warehouse', value: document?.warehouse_id },
          { label: 'Type', value: document?.dispatch_type },
          { label: 'Dispatch Date', value: document?.dispatch_date },
          { label: 'Transport Type', value: document?.transport_type },
          { label: 'Vehicle No', value: document?.vehicle_no },
          { label: 'Driver', value: document?.driver_name },
        ]}
      />
      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={document?.tgd_dispatch_lines?.length ?? 0} helperText="Read-only dispatch line count." />
      </DocumentSection>
      <DocumentSection title="Lines">
        <DocumentLineTable lines={document?.tgd_dispatch_lines ?? []} columns={lineColumns} />
      </DocumentSection>
    </section>
  );
}
