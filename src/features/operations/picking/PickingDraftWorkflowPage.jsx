import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import {
  confirmOutboundPickDraft,
  getOutboundDocumentDetail,
} from '../../../services/outboundPickingService.js';

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
const pickConfirmSafetyNote = 'Confirm Pick updates outbound picking state only. No stock posting. No stock movement OUT. No stock balance update.';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUuid(value, requiredMessage, invalidMessage) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return requiredMessage;
  }

  if (!uuidPattern.test(normalizedValue)) {
    return invalidMessage;
  }

  return '';
}

function validateDocumentId(value) {
  return validateUuid(
    value,
    'Outbound Document ID is required.',
    'Outbound Document ID must be a valid UUID.',
  );
}

function validatePickConfirmation({
  documentId,
  outboundLineId,
  reservationId,
  pickedQuantity,
  pickedWeight,
  pickReference,
}) {
  const documentError = validateDocumentId(documentId);
  if (documentError) {
    return documentError;
  }

  const lineError = validateUuid(
    outboundLineId,
    'Outbound line ID is required.',
    'Outbound line ID must be a valid UUID.',
  );
  if (lineError) {
    return lineError;
  }

  const reservationError = validateUuid(
    reservationId,
    'Reservation ID is required.',
    'Reservation ID must be a valid UUID.',
  );
  if (reservationError) {
    return reservationError;
  }

  const quantityValue = pickedQuantity.trim();
  if (!quantityValue || Number(quantityValue) <= 0 || Number.isNaN(Number(quantityValue))) {
    return 'Picked quantity must be greater than 0.';
  }

  const weightValue = pickedWeight.trim();
  if (weightValue !== '' && (Number.isNaN(Number(weightValue)) || Number(weightValue) < 0)) {
    return 'Picked weight must be 0 or greater.';
  }

  if (!pickReference.trim()) {
    return 'Pick reference is required for idempotency.';
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
  const [outboundLineId, setOutboundLineId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [pickedQuantity, setPickedQuantity] = useState('');
  const [pickedWeight, setPickedWeight] = useState('0');
  const [pickReference, setPickReference] = useState('');
  const [pickNote, setPickNote] = useState('');
  const [pickConfirmLoading, setPickConfirmLoading] = useState(false);
  const [pickConfirmError, setPickConfirmError] = useState('');
  const [pickConfirmSuccess, setPickConfirmSuccess] = useState('');
  const [pickConfirmResult, setPickConfirmResult] = useState(null);

  async function loadDocumentDetail(nextDocumentId) {
    const nextDetail = await getOutboundDocumentDetail(nextDocumentId.trim());
    const serviceError = nextDetail?.error;

    if (serviceError) {
      setError('Unable to load outbound document detail. Please check the document ID or your permission.');
      return null;
    }

    if (!nextDetail?.document) {
      setEmptyDetailMessage('Outbound document was not found or you do not have permission to view it.');
      return null;
    }

    const normalizedDetail = {
      ...nextDetail,
      lines: nextDetail.lines ?? [],
      reservations: nextDetail.reservations ?? [],
    };

    setDetail(normalizedDetail);
    setEmptyDetailMessage('');
    return normalizedDetail;
  }

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
      await loadDocumentDetail(documentId);
    } catch {
      setError('Unable to load outbound document detail. Please check the document ID or your permission.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPickDraft(event) {
    event.preventDefault();

    const activeDocumentId = (detail?.document?.id ?? documentId).trim();
    const validationError = validatePickConfirmation({
      documentId: activeDocumentId,
      outboundLineId,
      reservationId,
      pickedQuantity,
      pickedWeight,
      pickReference,
    });

    setPickConfirmError('');
    setPickConfirmSuccess('');
    setPickConfirmResult(null);

    if (validationError) {
      setPickConfirmError(validationError);
      return;
    }

    setPickConfirmLoading(true);

    try {
      const result = await confirmOutboundPickDraft({
        outboundDocumentId: activeDocumentId,
        outboundLineId: outboundLineId.trim(),
        reservationId: reservationId.trim(),
        pickedQuantity: Number(pickedQuantity),
        pickedWeight: pickedWeight.trim() === '' ? 0 : Number(pickedWeight),
        pickReference: pickReference.trim(),
        note: pickNote.trim() || null,
      });

      setPickConfirmSuccess('Pick confirmation draft saved.');
      setPickConfirmResult(result);

      setLoading(true);
      setError('');
      await loadDocumentDetail(activeDocumentId);
    } catch {
      setPickConfirmError('Unable to confirm pick draft. Please check reservation status, quantities, or permission.');
    } finally {
      setPickConfirmLoading(false);
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
        <h3 style={{ marginTop: 0 }}>Controlled Pick Confirmation Draft</h3>
        <section role="status" style={{ border: '1px solid #fde68a', borderRadius: 8, color: '#92400e', marginBottom: 14, padding: 12 }}>
          {pickConfirmSafetyNote}
        </section>

        {pickConfirmError ? (
          <section role="alert" style={{ border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 14, padding: 12 }}>
            {pickConfirmError}
          </section>
        ) : null}

        {pickConfirmSuccess ? (
          <section role="status" style={{ border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534', marginBottom: 14, padding: 12 }}>
            {pickConfirmSuccess}
          </section>
        ) : null}

        {pickConfirmResult ? (
          <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 14, overflowX: 'auto', padding: 12 }}>
            {JSON.stringify(pickConfirmResult, null, 2)}
          </pre>
        ) : null}

        <form onSubmit={handleConfirmPickDraft} style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            Outbound Document ID
            <input
              aria-label="Pick confirmation outbound document id"
              readOnly
              style={{ ...inputStyle, background: '#f8fafc' }}
              value={detail?.document?.id ?? documentId}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Outbound Line ID
            <input
              aria-label="Pick confirmation outbound line id"
              style={inputStyle}
              value={outboundLineId}
              onChange={(event) => setOutboundLineId(event.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Reservation ID
            <input
              aria-label="Pick confirmation reservation id"
              style={inputStyle}
              value={reservationId}
              onChange={(event) => setReservationId(event.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Picked Quantity
            <input
              aria-label="Pick confirmation picked quantity"
              style={inputStyle}
              value={pickedQuantity}
              onChange={(event) => setPickedQuantity(event.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Picked Weight
            <input
              aria-label="Pick confirmation picked weight"
              style={inputStyle}
              value={pickedWeight}
              onChange={(event) => setPickedWeight(event.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Pick Reference
            <input
              aria-label="Pick confirmation pick reference"
              style={inputStyle}
              value={pickReference}
              onChange={(event) => setPickReference(event.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            Pick Note
            <textarea
              aria-label="Pick confirmation pick note"
              rows={3}
              style={inputStyle}
              value={pickNote}
              onChange={(event) => setPickNote(event.target.value)}
            />
          </label>
          <button disabled={pickConfirmLoading} type="submit" style={buttonStyle}>
            {pickConfirmLoading ? 'Saving...' : 'Save Pick Confirmation Draft'}
          </button>
        </form>
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
