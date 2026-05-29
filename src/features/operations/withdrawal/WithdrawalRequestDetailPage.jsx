import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../../components/operations/QuantitySummaryCard.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getWithdrawalRequestById } from '../../../services/withdrawalRequestService.js';

const lineColumns = [
  { key: 'line_no', header: 'Line' },
  { key: 'product_id', header: 'Product' },
  { key: 'requested_lot_no', header: 'Requested Lot' },
  { key: 'requested_qty', header: 'Requested Qty' },
  { key: 'allocated_qty', header: 'Allocated Qty' },
  { key: 'picked_qty', header: 'Picked Qty' },
  { key: 'dispatched_qty', header: 'Dispatched Qty' },
  { key: 'uom', header: 'UOM' },
];

export function WithdrawalRequestDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    getWithdrawalRequestById(id).then(({ data, error }) => {
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
      <PageHeader title="Withdrawal Request Detail" description="Read-only withdrawal request detail." />
      <Link className="action-link" to="/operations/withdrawal-requests">Back to withdrawal requests</Link>
      <DocumentStatusCard
        title={document?.withdrawal_no}
        status={document?.status}
        fields={[
          { label: 'Customer', value: document?.customer_id },
          { label: 'Warehouse', value: document?.warehouse_id },
          { label: 'Type', value: document?.withdrawal_type },
          { label: 'Requested Dispatch', value: document?.requested_dispatch_date },
          { label: 'Priority', value: document?.priority },
          { label: 'Created At', value: document?.created_at },
        ]}
      />
      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={document?.tgd_withdrawal_request_lines?.length ?? 0} helperText="Read-only withdrawal line count." />
      </DocumentSection>
      <DocumentSection title="Lines">
        <DocumentLineTable lines={document?.tgd_withdrawal_request_lines ?? []} columns={lineColumns} />
      </DocumentSection>
    </section>
  );
}
