import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../../components/operations/QuantitySummaryCard.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getAdjustmentDocumentById } from '../../../services/adjustmentService.js';

const lineColumns = [
  { key: 'line_no', header: 'Line' },
  { key: 'product_id', header: 'Product' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'warehouse_id', header: 'Warehouse' },
  { key: 'location_id', header: 'Location' },
  { key: 'adjustment_direction', header: 'Direction' },
  { key: 'adjustment_qty', header: 'Qty' },
  { key: 'uom', header: 'UOM' },
];

export function AdjustmentDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getAdjustmentDocumentById(id).then(({ data, error }) => {
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
      <PageHeader title="Adjustment Detail" description="Read-only adjustment document detail." />
      <Link className="action-link" to="/operations/adjustment">Back to adjustment</Link>
      <DocumentStatusCard
        title={document?.adjustment_no}
        status={document?.status}
        fields={[
          { label: 'Customer', value: document?.customer_id },
          { label: 'Warehouse', value: document?.warehouse_id },
          { label: 'Type', value: document?.adjustment_type },
          { label: 'Reason', value: document?.remark },
          { label: 'Created At', value: document?.created_at },
        ]}
      />
      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={document?.tgd_adjustment_lines?.length ?? 0} helperText="Read-only adjustment line count." />
      </DocumentSection>
      <DocumentSection title="Lines">
        <DocumentLineTable lines={document?.tgd_adjustment_lines ?? []} columns={lineColumns} />
      </DocumentSection>
    </section>
  );
}
