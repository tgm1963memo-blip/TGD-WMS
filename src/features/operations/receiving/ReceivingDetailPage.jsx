import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentLineTable } from '../../../components/operations/DocumentLineTable.jsx';
import { DocumentSection } from '../../../components/operations/DocumentSection.jsx';
import { DocumentStatusCard } from '../../../components/operations/DocumentStatusCard.jsx';
import { QuantitySummaryCard } from '../../../components/operations/QuantitySummaryCard.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import {
  getReceivingDocumentById,
  postReceivingDocument,
} from '../../../services/receivingService.js';

const lineColumns = [
  { key: 'line_no', header: 'Line' },
  { key: 'product_id', header: 'Product' },
  { key: 'lot_no', header: 'Lot' },
  { key: 'to_location_id', header: 'Location' },
  { key: 'expected_qty', header: 'Expected' },
  { key: 'received_qty', header: 'Received' },
  { key: 'uom', header: 'UOM' },
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
  const [isPosting, setIsPosting] = useState(false);
  const [postSucceeded, setPostSucceeded] = useState(false);
  const [postMessage, setPostMessage] = useState('');
  const [postError, setPostError] = useState('');

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
  const isDraft = document?.status === 'DRAFT';
  const showPostButton = isDraft && !postSucceeded;
  const postButtonDisabled = !document?.id || isPosting || postSucceeded;

  const handleConfirmPost = async () => {
    if (!document?.id || postSucceeded) return;

    setPostError('');
    setPostMessage('');
    setIsPosting(true);

    const result = await postReceivingDocument(document.id);
    setIsPosting(false);

    if (result?.error) {
      setPostError(result.error.message || 'Unable to Confirm/Post receiving document.');
      return;
    }

    setState((prev) => ({
      ...prev,
      data: { ...prev.data, status: 'CONFIRMED' },
    }));
    setPostSucceeded(true);
    setPostMessage('Receiving document Confirm/Post completed.');
  };

  return (
    <section className="page-shell">
      <PageHeader title="Receiving Detail" description="Receiving document detail with controlled Confirm/Post." />
      <Link className="action-link" to="/operations/receiving">Back to receiving</Link>

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

      <DocumentStatusCard
        title={document?.receiving_no || document?.document_no}
        status={document?.status}
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
          {isDraft && !postSucceeded
            ? 'This document is DRAFT. You may Confirm/Post using the receiving post RPC wrapper.'
            : 'Confirm/Post is not available for this document status.'}
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
        {postSucceeded ? (
          <p style={{ color: '#166534', fontWeight: 600, marginBottom: 0 }}>
            Status: CONFIRMED
          </p>
        ) : null}
      </section>

      <DocumentSection title="Quantity Summary">
        <QuantitySummaryCard label="Lines" value={document?.tgd_receiving_lines?.length ?? 0} helperText="Receiving line count." />
      </DocumentSection>
      <DocumentSection title="Lines">
        <DocumentLineTable lines={document?.tgd_receiving_lines ?? []} columns={lineColumns} />
      </DocumentSection>
    </section>
  );
}
