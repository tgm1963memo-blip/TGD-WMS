import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getOutboundDocumentDetail } from '../../../services/outboundPickingService.js';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #d9e2ec',
  borderRadius: 8,
  marginBottom: 18,
  padding: 16,
};

const buttonStyle = {
  background: '#0f766e',
  border: 0,
  borderRadius: 8,
  color: '#ffffff',
  cursor: 'pointer',
  minHeight: 38,
  padding: '8px 14px',
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  color: '#0f172a',
};

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
  padding: '10px 12px',
};

const tableStyle = {
  borderCollapse: 'collapse',
  width: '100%',
};

const cellStyle = {
  borderBottom: '1px solid #e2e8f0',
  padding: '10px 8px',
  textAlign: 'left',
  verticalAlign: 'top',
};

const safetyNote = 'Picking draft workflow only. No stock posting. No stock movement OUT. No stock balance update.';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateDocumentId(value) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return 'Outbound Document ID is required.';
  }

  if (!uuidPattern.test(normalizedValue)) {
    return 'Outbound Document ID must be a valid UUID.';
  }

  return '';
}

function StatusPill({ value }) {
  return (
    <span style={{
      background: '#ecfeff',
      border: '1px solid #a5f3fc',
      borderRadius: 999,
      color: '#155e75',
      display: 'inline-block',
      fontSize: 12,
      fontWeight: 700,
      padding: '3px 8px',
    }}>
      {value || '-'}
    </span>
  );
}

function EmptyRow({ colSpan, label }) {
  return (
    <tr>
      <td style={cellStyle} colSpan={colSpan}>{label}</td>
    </tr>
  );
}

export function PickingDraftWorkflowPage() {
  const [documentId, setDocumentId] = useState('');
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emptyDetailMessage, setEmptyDetailMessage] = useState('');

  async function handleLoadDetail(event) {
    event.preventDefault();
    const validationError = validateDocumentId(documentId);

    setError('');
    setDetail(null);
    setEmptyDetailMessage('');

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const nextDetail = await getOutboundDocumentDetail(documentId.trim());
      const serviceError = nextDetail?.error;

      if (serviceError) {
        setError('Unable to load outbound document detail. Please check the document ID or your permission.');
        return;
      }

      if (!nextDetail?.document) {
        setEmptyDetailMessage('Outbound document was not found or you do not have permission to view it.');
        return;
      }

      setDetail({
        ...nextDetail,
        lines: nextDetail.lines ?? [],
        reservations: nextDetail.reservations ?? [],
      });
    } catch (loadError) {
      setError('Unable to load outbound document detail. Please check the document ID or your permission.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-shell">
      <PageHeader title="Picking Draft Workflow" description="Read-only picking readiness from outbound document detail." />

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <Link to="/operations/outbound" style={{ ...secondaryButtonStyle, alignItems: 'center', display: 'inline-flex', textDecoration: 'none' }}>
          Back to Outbound Documents
        </Link>
      </nav>

      <section role="status" style={{ ...cardStyle, borderColor: '#fde68a', color: '#92400e' }}>
        {safetyNote}
      </section>

      {error ? (
        <section role="alert" style={{ ...cardStyle, borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </section>
      ) : null}

      <form onSubmit={handleLoadDetail} style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Select outbound document</h3>
        <label style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
          Outbound Document ID
          <input
            aria-label="Picking outbound document id"
            style={inputStyle}
            value={documentId}
            onChange={(event) => setDocumentId(event.target.value)}
          />
        </label>
        <button disabled={loading} type="submit" style={{ ...buttonStyle, marginTop: 12 }}>
          {loading ? 'Loading...' : 'Load Document Detail'}
        </button>
      </form>

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Outbound document detail</h3>
        {loading ? <p>Loading outbound document detail...</p> : null}
        {emptyDetailMessage ? <p>{emptyDetailMessage}</p> : null}
        {!loading && !emptyDetailMessage && !detail ? <p>Load an outbound document to review picking readiness.</p> : null}
        {detail ? (
          <dl style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div><dt>Document No</dt><dd>{detail.document?.document_no || '-'}</dd></div>
            <div><dt>Status</dt><dd><StatusPill value={detail.document?.status} /></dd></div>
            <div><dt>Customer ID</dt><dd>{detail.document?.customer_id || '-'}</dd></div>
            <div><dt>Requested Ship Date</dt><dd>{detail.document?.requested_ship_date || '-'}</dd></div>
            <div><dt>Created At</dt><dd>{detail.document?.created_at || '-'}</dd></div>
          </dl>
        ) : null}
      </section>

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Picking checklist draft</h3>
        <p style={{ marginTop: 0 }}>Read-only picking candidates from outbound lines and reservations.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={cellStyle}>Line ID</th>
                <th style={cellStyle}>Product ID</th>
                <th style={cellStyle}>Lot ID</th>
                <th style={cellStyle}>Requested Qty</th>
                <th style={cellStyle}>Picked Qty</th>
                <th style={cellStyle}>Line Status</th>
                <th style={cellStyle}>Reservation Status</th>
                <th style={cellStyle}>Location ID</th>
              </tr>
            </thead>
            <tbody>
              {!detail ? <EmptyRow colSpan={8} label="No picking candidates loaded." /> : null}
              {detail && detail.lines.length === 0 ? <EmptyRow colSpan={8} label="No outbound lines found for this document." /> : null}
              {detail?.lines.map((line) => {
                const reservation = detail.reservations.find((item) => item.outbound_line_id === line.id);

                return (
                  <tr key={line.id}>
                    <td style={cellStyle}>{line.id}</td>
                    <td style={cellStyle}>{line.product_id}</td>
                    <td style={cellStyle}>{line.lot_id || '-'}</td>
                    <td style={cellStyle}>{line.requested_quantity}</td>
                    <td style={cellStyle}>{line.picked_quantity}</td>
                    <td style={cellStyle}><StatusPill value={line.status} /></td>
                    <td style={cellStyle}><StatusPill value={reservation?.status} /></td>
                    <td style={cellStyle}>{reservation?.location_id || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {detail && detail.reservations.length === 0 ? (
          <p>No outbound reservations found for this document.</p>
        ) : null}
      </section>

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Manual picking note / validation readiness</h3>
        <label style={{ display: 'grid', gap: 6 }}>
          Local note
          <textarea
            aria-label="Picking local note"
            rows={5}
            style={inputStyle}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <p style={{ color: '#475569', marginBottom: 0 }}>
          This note is local-only and is not saved to the database.
        </p>
      </section>
    </section>
  );
}
