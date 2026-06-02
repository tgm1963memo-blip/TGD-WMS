import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import {
  addReceivingLine,
  createReceivingDocument,
} from '../../../services/receivingService.js';

const fieldStyle = {
  display: 'grid',
  gap: 6,
};

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
  padding: '10px 12px',
};

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #d9e2ec',
  borderRadius: 8,
  marginBottom: 18,
  padding: 16,
};

function getCreatedDocumentId(result) {
  if (!result?.data) return '';
  if (typeof result.data === 'string') return result.data;
  return result.data.id || result.data.document_id || '';
}

function getCreatedLineId(result) {
  if (!result?.data) return '';
  if (typeof result.data === 'string') return result.data;
  return result.data.id || result.data.line_id || '';
}

export function ReceivingCreatePage() {
  const [draftForm, setDraftForm] = useState({
    customer_id: '',
    document_no: '',
  });
  const [lineForm, setLineForm] = useState({
    product_id: '',
    lot_id: '',
    location_id: '',
    quantity: '',
    weight: '',
  });
  const [draft, setDraft] = useState(null);
  const [lastLineId, setLastLineId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isAddingLine, setIsAddingLine] = useState(false);

  const updateDraftField = (field, value) => {
    setDraftForm((current) => ({ ...current, [field]: value }));
  };

  const updateLineField = (field, value) => {
    setLineForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveDraft = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSavingDraft(true);

    const result = await createReceivingDocument({
      customer_id: draftForm.customer_id,
      document_no: draftForm.document_no,
    });

    setIsSavingDraft(false);

    if (result?.error) {
      setError(result.error.message || 'Unable to create receiving draft.');
      return;
    }

    const documentId = getCreatedDocumentId(result);
    setDraft({
      id: documentId,
      document_no: draftForm.document_no,
      status: 'DRAFT',
    });
    setMessage('Receiving draft created.');
  };

  const handleAddLine = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!draft?.id) {
      setError('Add Line requires document id.');
      return;
    }

    setIsAddingLine(true);
    const result = await addReceivingLine({
      document_id: draft.id,
      product_id: lineForm.product_id,
      lot_id: lineForm.lot_id,
      location_id: lineForm.location_id,
      quantity: Number(lineForm.quantity),
      weight: lineForm.weight === '' ? null : Number(lineForm.weight),
    });
    setIsAddingLine(false);

    if (result?.error) {
      setError(result.error.message || 'Unable to add receiving line.');
      return;
    }

    setLastLineId(getCreatedLineId(result));
    setMessage('Receiving line added.');
  };

  return (
    <section className="page-shell">
      <PageHeader
        title="Controlled Receiving Draft"
        description="สร้างเอกสารรับเข้าแบบ Draft เท่านั้น โดยยังไม่เปิด Confirm/Post หรือการตัดสต็อก"
      />

      <section
        className="warning-panel"
        role="status"
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          color: '#92400e',
          marginBottom: 18,
          padding: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Controlled receiving draft mode</h3>
        <ul style={{ marginBottom: 0 }}>
          <li>Staging controlled unlock only</li>
          <li>Save Draft uses receiving RPC only</li>
          <li>Add Line uses receiving RPC only</li>
          <li>Confirm/Post is still locked</li>
          <li>No stock movement or stock balance update is triggered from this page</li>
        </ul>
      </section>

      {error ? (
        <section role="alert" style={{ ...cardStyle, borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </section>
      ) : null}

      {message ? (
        <section role="status" style={{ ...cardStyle, borderColor: '#bbf7d0', color: '#166534' }}>
          {message}
        </section>
      ) : null}

      <form onSubmit={handleSaveDraft} style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Save Draft</h3>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <label style={fieldStyle}>
            Customer ID
            <input
              aria-label="Customer ID"
              required
              style={inputStyle}
              value={draftForm.customer_id}
              onChange={(event) => updateDraftField('customer_id', event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            Document No
            <input
              aria-label="Document No"
              required
              style={inputStyle}
              value={draftForm.document_no}
              onChange={(event) => updateDraftField('document_no', event.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isSavingDraft}
          style={{
            background: '#0f766e',
            border: 0,
            borderRadius: 8,
            color: '#ffffff',
            cursor: isSavingDraft ? 'not-allowed' : 'pointer',
            marginTop: 16,
            minHeight: 42,
            padding: '10px 16px',
          }}
        >
          {isSavingDraft ? 'Saving draft...' : 'Save Draft'}
        </button>
      </form>

      {draft ? (
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Draft Created</h3>
          <dl
            style={{
              display: 'grid',
              gap: 8,
              gridTemplateColumns: 'max-content 1fr',
              margin: 0,
            }}
          >
            <dt>Draft document id</dt>
            <dd>{draft.id}</dd>
            <dt>Draft document no</dt>
            <dd>{draft.document_no}</dd>
            <dt>Status</dt>
            <dd>{draft.status}</dd>
          </dl>
        </section>
      ) : null}

      <form onSubmit={handleAddLine} style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Add Line section</h3>
        <p style={{ color: '#475569', marginTop: 0 }}>Add Line requires document id.</p>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <label style={fieldStyle}>
            Product ID
            <input
              aria-label="Product ID"
              required
              style={inputStyle}
              value={lineForm.product_id}
              onChange={(event) => updateLineField('product_id', event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            Lot ID
            <input
              aria-label="Lot ID"
              required
              style={inputStyle}
              value={lineForm.lot_id}
              onChange={(event) => updateLineField('lot_id', event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            Location ID
            <input
              aria-label="Location ID"
              required
              style={inputStyle}
              value={lineForm.location_id}
              onChange={(event) => updateLineField('location_id', event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            Quantity
            <input
              aria-label="Quantity"
              min="0"
              required
              step="any"
              style={inputStyle}
              type="number"
              value={lineForm.quantity}
              onChange={(event) => updateLineField('quantity', event.target.value)}
            />
          </label>
          <label style={fieldStyle}>
            Weight
            <input
              aria-label="Weight"
              min="0"
              step="any"
              style={inputStyle}
              type="number"
              value={lineForm.weight}
              onChange={(event) => updateLineField('weight', event.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={!draft?.id || isAddingLine}
          style={{
            background: draft?.id ? '#1d4ed8' : '#94a3b8',
            border: 0,
            borderRadius: 8,
            color: '#ffffff',
            cursor: !draft?.id || isAddingLine ? 'not-allowed' : 'pointer',
            marginTop: 16,
            minHeight: 42,
            padding: '10px 16px',
          }}
        >
          {isAddingLine ? 'Adding line...' : 'Add Line'}
        </button>
        {lastLineId ? <p>Last receiving line id: {lastLineId}</p> : null}
      </form>

      <section style={{ ...cardStyle, borderColor: '#fecaca', color: '#991b1b' }}>
        <strong>Confirm/Post is still locked</strong>
        <p style={{ marginBottom: 0 }}>
          This page does not provide Confirm or Post actions and does not create stock movements.
        </p>
      </section>

      <Link className="action-link" to="/operations/receiving">
        Back to receiving
      </Link>
    </section>
  );
}
