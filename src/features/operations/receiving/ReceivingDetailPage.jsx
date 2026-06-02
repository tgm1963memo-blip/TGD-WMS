import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../../components/operations/QuantitySummaryCard.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { getCurrentUserRole } from '../../../security/currentUserRole.js';
import { hasRoleAccess } from '../../../security/permissionGuard.js';
import {
  getReceivingDocumentById,
  getReceivingStockMovements,
  postReceivingDocument,
} from '../../../services/receivingService.js';

const lineColumns = [
  { key: 'product_id', header: 'Product ID' },
  { key: 'lot_id', header: 'Lot ID', render: (row) => row.lot_id ?? row.lot_no ?? '-' },
  { key: 'location_id', header: 'Location ID', render: (row) => row.location_id ?? row.to_location_id ?? '-' },
  { key: 'quantity', header: 'Quantity', render: (row) => row.quantity ?? row.received_qty ?? row.expected_qty ?? '-' },
  { key: 'weight', header: 'Weight', render: (row) => row.weight ?? '-' },
  { key: 'source_line_id', header: 'Source Line ID', render: (row) => row.source_line_id ?? row.id ?? '-' },
];

const movementColumns = [
  { key: 'id', header: 'Movement ID' },
  { key: 'movement_type', header: 'Movement Type' },
  { key: 'quantity', header: 'Quantity' },
  { key: 'weight', header: 'Weight', render: (row) => row.weight ?? '-' },
  { key: 'to_location_id', header: 'To Location ID' },
  { key: 'source_line_id', header: 'Source Line ID' },
  { key: 'created_at', header: 'Created At' },
];

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #d9e2ec',
  borderRadius: 8,
  marginBottom: 18,
  padding: 16,
};

export function ReceivingDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [movementsState, setMovementsState] = useState({ data: [], loading: false, error: null });
  const [isPosting, setIsPosting] = useState(false);
  const [postSucceeded, setPostSucceeded] = useState(false);
  const [postMessage, setPostMessage] = useState('');
  const [postError, setPostError] = useState('');

  const loadDetail = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }
    setMovementsState((prev) => ({ ...prev, error: null }));

    const documentResult = await getReceivingDocumentById(id);
    setState({ data: documentResult.data, loading: false, error: documentResult.error });

    if (documentResult.error || documentResult.data?.status !== 'CONFIRMED') {
      setMovementsState({ data: [], loading: false, error: null });
      return;
    }

    setMovementsState({ data: [], loading: true, error: null });
    const movementResult = await getReceivingStockMovements(documentResult.data.id);
    setMovementsState({
      data: movementResult.data ?? [],
      loading: false,
      error: movementResult.error,
    });
  }, [id]);

  useEffect(() => {
    let isMounted = true;

    setPostSucceeded(false);
    loadDetail().finally(() => {
      if (!isMounted) return;
    });

    return () => {
      isMounted = false;
    };
  }, [loadDetail]);

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState message={state.error.message} />;

  const document = state.data;
  const status = postSucceeded ? 'CONFIRMED' : document?.status;
  const isDraft = status === 'DRAFT';
  const isConfirmed = status === 'CONFIRMED';
  const lineCount = document?.tgd_receiving_lines?.length ?? 0;

  const userRole = getCurrentUserRole();
  const canWrite = hasRoleAccess(userRole, 'warehouse_staff');

  const showPostButton = isDraft && !postSucceeded && canWrite;
  const postButtonDisabled = !document?.id || isPosting || !isDraft || !canWrite;

  const handleConfirmPost = async () => {
    if (!document?.id || !isDraft || isPosting) return;

    setPostError('');
    setPostMessage('');
    setIsPosting(true);

    const result = await postReceivingDocument(document.id);
    setIsPosting(false);

    if (result?.error) {
      setPostError(result.error.message || 'Unable to Confirm/Post receiving document.');
      return;
    }

    setPostMessage('Receiving document Confirm/Post completed.');
    setPostSucceeded(true);
    await loadDetail({ showLoading: false });
    setState((prev) => ({
      ...prev,
      data: prev.data ? { ...prev.data, status: 'CONFIRMED' } : prev.data,
    }));
  };

  const handleRefresh = () => {
    setPostError('');
    loadDetail({ showLoading: false });
  };

  return (
    <section className="page-shell">
      <PageHeader
        title="Receiving Detail"
        description="Receiving document detail with controlled Confirm/Post."
      />
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <Link className="action-link" to="/operations/receiving">Back to receiving list</Link>
        <Link className="action-link" to="/operations/receiving/create">Create another receiving draft</Link>
        <button type="button" onClick={handleRefresh} style={secondaryButtonStyle}>
          Refresh
        </button>
      </nav>

      {postError ? (
        <section role="alert" style={{ ...cardStyle, borderColor: '#fecaca', color: '#991b1b' }}>
          {postError}
        </section>
      ) : null}

      {postMessage ? (
        <section role="status" style={{ ...cardStyle, borderColor: '#bbf7d0', color: '#166534' }}>
          {postMessage}
        </section>
      ) : null}

      <section style={cardStyle}>
        <p style={{ color: '#52606d', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Document No</p>
        <h2 style={{ fontSize: 24, margin: '0 0 12px' }}>{document?.document_no || document?.receiving_no || document?.id}</h2>
        <StatusBadge value={status} />
      </section>

      <DocumentStatusCard
        title={document?.receiving_no || document?.document_no}
        status={status}
        fields={[
          { label: 'Customer', value: document?.customer_id },
          { label: 'Warehouse', value: document?.warehouse_id },
          { label: 'Type', value: document?.receiving_type },
          { label: 'Reference', value: document?.source_no },
          { label: 'Created At', value: document?.created_at },
        ]}
      />

      <section style={{ ...cardStyle, borderColor: '#fed7aa', color: '#9a3412' }}>
        <strong>Controlled Confirm/Post</strong>
        <p style={{ marginBottom: 0 }}>
          {isDraft && canWrite
            ? 'This document is DRAFT. You may Confirm/Post using the receiving post service wrapper.'
            : null}
          {isDraft && !canWrite
            ? 'Confirm/Post is restricted.'
            : null}
          {isConfirmed ? 'Confirm/Post completed. Stock movement display is read-only.' : null}
          {!isDraft && !isConfirmed ? 'Confirm/Post is not available for this document status.' : null}
        </p>
        {showPostButton ? (
          <button
            type="button"
            disabled={postButtonDisabled}
            onClick={handleConfirmPost}
            style={{
              background: isPosting ? '#94a3b8' : '#b45309',
              border: 0,
              borderRadius: 8,
              color: '#ffffff',
              cursor: postButtonDisabled ? 'not-allowed' : 'pointer',
              marginTop: 16,
              minHeight: 42,
              padding: '10px 16px',
            }}
          >
            {isPosting ? 'Posting receiving...' : 'Confirm/Post Receiving'}
          </button>
        ) : null}
        {isConfirmed ? (
          <p style={{ color: '#166534', fontWeight: 600, marginBottom: 0 }}>
            Status: CONFIRMED
          </p>
        ) : null}
      </section>

      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={lineCount} helperText="Receiving line count." />
      </DocumentSection>
      <DocumentSection title={`Lines (${lineCount})`}>
        <DocumentLineTable lines={document?.tgd_receiving_lines ?? []} columns={lineColumns} />
      </DocumentSection>
      <DocumentSection title="Stock Movements">
        {isDraft ? (
          <section style={cardStyle}>No stock movement until Confirm/Post</section>
        ) : null}
        {isConfirmed ? (
          <section style={{ ...cardStyle, overflowX: 'auto' }}>
            <DataTable
              columns={movementColumns}
              data={movementsState.data}
              loading={movementsState.loading}
              error={movementsState.error}
              emptyMessage="No stock movements found for this confirmed receiving document."
            />
          </section>
        ) : null}
        {!isDraft && !isConfirmed ? (
          <section style={cardStyle}>Stock movement display is not available for this document status.</section>
        ) : null}
      </DocumentSection>
    </section>
  );
}

const secondaryButtonStyle = {
  background: '#f0f4f8',
  border: '1px solid #d9e2ec',
  borderRadius: 7,
  color: '#334e68',
  cursor: 'pointer',
  fontWeight: 700,
  minHeight: 40,
  padding: '8px 12px',
};
