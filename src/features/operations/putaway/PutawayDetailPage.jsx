import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../../components/operations/QuantitySummaryCard.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getPutawayDocumentById } from '../../../services/putawayService.js';

const lineColumns = [
  { key: 'line_no', header: 'Line' },
  { key: 'product_id', header: 'Product' },
  { key: 'lot_id', header: 'Lot' },
  { key: 'from_location_id', header: 'From' },
  { key: 'to_location_id', header: 'To' },
  { key: 'planned_qty', header: 'Planned' },
  { key: 'putaway_qty', header: 'Putaway' },
  { key: 'uom', header: 'UOM' },
];

export function PutawayDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getPutawayDocumentById(id).then(({ data, error }) => {
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
      <PageHeader title="Putaway Detail" description="Read-only putaway document detail." />
      <Link className="action-link" to="/operations/putaway">Back to putaway</Link>
      <DocumentStatusCard
        title={document?.putaway_no}
        status={document?.status}
        fields={[
          { label: 'Customer', value: document?.customer_id },
          { label: 'Warehouse', value: document?.warehouse_id },
          { label: 'Source Type', value: document?.source_type },
          { label: 'Source No', value: document?.source_no },
          { label: 'Created At', value: document?.created_at },
        ]}
      />
      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={document?.tgd_putaway_lines?.length ?? 0} helperText="Read-only putaway line count." />
      </DocumentSection>
      <DocumentSection title="Lines">
        <DocumentLineTable lines={document?.tgd_putaway_lines ?? []} columns={lineColumns} />
      </DocumentSection>
    </section>
  );
}
