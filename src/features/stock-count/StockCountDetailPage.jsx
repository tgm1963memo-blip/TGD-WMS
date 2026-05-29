import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../components/operations/QuantitySummaryCard.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { getStockCountDocumentById } from '../../services/stockCountService.js';

const lineColumns = [
  { key: 'line_no', header: 'Line' },
  { key: 'product_id', header: 'Product' },
  { key: 'location_id', header: 'Location' },
  { key: 'pallet_id', header: 'Pallet' },
  { key: 'expected_qty', header: 'Expected Qty' },
  { key: 'counted_qty', header: 'Counted Qty' },
  { key: 'variance_qty', header: 'Variance Qty' },
  { key: 'uom', header: 'UOM' },
  { key: 'count_status', header: 'Line Status' },
];

export function StockCountDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getStockCountDocumentById(id).then(({ data, error }) => {
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
      <PageHeader title="Stock Count Detail" description="Read-only stock count document detail." />
      <Link className="action-link" to="/stock-count">Back to stock count</Link>
      <DocumentStatusCard
        title={document?.stock_count_no}
        status={document?.status}
        fields={[
          { label: 'Warehouse', value: document?.warehouse_id },
          { label: 'Count Type', value: document?.count_type },
          { label: 'Count Date', value: document?.count_date },
          { label: 'Remark', value: document?.remark },
          { label: 'Created At', value: document?.created_at },
        ]}
      />
      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={document?.tgd_stock_count_lines?.length ?? 0} helperText="Read-only stock count line count." />
      </DocumentSection>
      <DocumentSection title="Lines">
        <DocumentLineTable lines={document?.tgd_stock_count_lines ?? []} columns={lineColumns} />
      </DocumentSection>
    </section>
  );
}
