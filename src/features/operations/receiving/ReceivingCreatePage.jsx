import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import {
  addReceivingLine,
  createReceivingDocument,
  getReceivingCustomers,
  getReceivingLocations,
  getReceivingLots,
  getReceivingProducts,
  postReceivingDocument,
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

const helperStyle = {
  color: '#64748b',
  fontSize: 12,
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
  const [masterState, setMasterState] = useState({
    customers: [],
    products: [],
    lots: [],
    locations: [],
    loading: true,
    error: null,
  });
  const [useManualEntry, setUseManualEntry] = useState(false);
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
  const [isPosting, setIsPosting] = useState(false);
  const [postSucceeded, setPostSucceeded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadMasters() {
      const [customers, products, lots, locations] = await Promise.all([
        getReceivingCustomers(),
        getReceivingProducts(),
        getReceivingLots(),
        getReceivingLocations(),
      ]);

      if (!isMounted) return;

      const lookupError = customers.error || products.error || lots.error || locations.error;
      setMasterState({
        customers: customers.data ?? [],
        products: products.data ?? [],
        lots: lots.data ?? [],
        locations: locations.data ?? [],
        loading: false,
        error: lookupError,
      });
    }

    loadMasters();

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleLots = useMemo(() => {
    if (!lineForm.product_id) return masterState.lots;
    const productLots = masterState.lots.filter((lot) => lot.product_id === lineForm.product_id);
    return productLots.length ? productLots : masterState.lots;
  }, [lineForm.product_id, masterState.lots]);

  const canSaveDraft = Boolean(draftForm.customer_id && draftForm.document_no.trim()) && !isSavingDraft;
  const canAddLine = Boolean(
    draft?.id
      && lineForm.product_id
      && lineForm.lot_id
      && lineForm.location_id
      && Number(lineForm.quantity) > 0,
  ) && !isAddingLine;

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
    setPostSucceeded(false);
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

  const handleConfirmPost = async () => {
    setError('');
    setMessage('');

    if (!draft?.id || postSucceeded) {
      return;
    }

    setIsPosting(true);
    const result = await postReceivingDocument(draft.id);
    setIsPosting(false);

    if (result?.error) {
      setError(result.error.message || 'Unable to Confirm/Post receiving document.');
      return;
    }

    setDraft((current) => ({
      ...current,
      status: 'CONFIRMED',
    }));
    setPostSucceeded(true);
    setMessage('Receiving document Confirm/Post completed.');
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
          <li>Confirm/Post uses receiving RPC only after draft creation</li>
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

      <section style={cardStyle}>
        <strong>Master lookup mode</strong>
        <p style={{ color: '#475569', marginBottom: 10 }}>
          {masterState.loading ? 'Loading receiving master pickers...' : 'Use read-only master pickers for receiving IDs.'}
        </p>
        {masterState.error ? (
          <p role="alert" style={{ color: '#991b1b', marginBottom: 10 }}>
            Master lookup error: {masterState.error.message || String(masterState.error)}
          </p>
        ) : null}
        <label style={{ alignItems: 'center', display: 'inline-flex', gap: 8 }}>
          <input
            aria-label="Use manual UUID entry"
            checked={useManualEntry}
            type="checkbox"
            onChange={(event) => setUseManualEntry(event.target.checked)}
          />
          Use manual UUID entry
        </label>
      </section>

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
            Customer
            {useManualEntry ? (
              <input
                aria-label="Customer ID"
                required
                style={inputStyle}
                value={draftForm.customer_id}
                onChange={(event) => updateDraftField('customer_id', event.target.value)}
              />
            ) : (
              <select
                aria-label="Customer"
                required
                style={inputStyle}
                value={draftForm.customer_id}
                onChange={(event) => updateDraftField('customer_id', event.target.value)}
              >
                <option value="">Select customer</option>
                {masterState.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.label}</option>
                ))}
              </select>
            )}
            <span style={helperStyle}>Selected customer id: {draftForm.customer_id || 'None'}</span>
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
          disabled={!canSaveDraft}
          style={{
            background: canSaveDraft ? '#0f766e' : '#94a3b8',
            border: 0,
            borderRadius: 8,
            color: '#ffffff',
            cursor: canSaveDraft ? 'pointer' : 'not-allowed',
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
            Product
            {useManualEntry ? (
              <input
                aria-label="Product ID"
                required
                style={inputStyle}
                value={lineForm.product_id}
                onChange={(event) => updateLineField('product_id', event.target.value)}
              />
            ) : (
              <select
                aria-label="Product"
                required
                style={inputStyle}
                value={lineForm.product_id}
                onChange={(event) => updateLineField('product_id', event.target.value)}
              >
                <option value="">Select product</option>
                {masterState.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.label}</option>
                ))}
              </select>
            )}
            <span style={helperStyle}>Selected product id: {lineForm.product_id || 'None'}</span>
          </label>
          <label style={fieldStyle}>
            Lot
            {useManualEntry ? (
              <input
                aria-label="Lot ID"
                required
                style={inputStyle}
                value={lineForm.lot_id}
                onChange={(event) => updateLineField('lot_id', event.target.value)}
              />
            ) : (
              <select
                aria-label="Lot"
                required
                style={inputStyle}
                value={lineForm.lot_id}
                onChange={(event) => updateLineField('lot_id', event.target.value)}
              >
                <option value="">Select lot</option>
                {visibleLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>{lot.label}</option>
                ))}
              </select>
            )}
            <span style={helperStyle}>Selected lot id: {lineForm.lot_id || 'None'}</span>
          </label>
          <label style={fieldStyle}>
            Location
            {useManualEntry ? (
              <input
                aria-label="Location ID"
                required
                style={inputStyle}
                value={lineForm.location_id}
                onChange={(event) => updateLineField('location_id', event.target.value)}
              />
            ) : (
              <select
                aria-label="Location"
                required
                style={inputStyle}
                value={lineForm.location_id}
                onChange={(event) => updateLineField('location_id', event.target.value)}
              >
                <option value="">Select location</option>
                {masterState.locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.label}</option>
                ))}
              </select>
            )}
            <span style={helperStyle}>Selected location id: {lineForm.location_id || 'None'}</span>
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
          disabled={!canAddLine}
          style={{
            background: canAddLine ? '#1d4ed8' : '#94a3b8',
            border: 0,
            borderRadius: 8,
            color: '#ffffff',
            cursor: canAddLine ? 'pointer' : 'not-allowed',
            marginTop: 16,
            minHeight: 42,
            padding: '10px 16px',
          }}
        >
          {isAddingLine ? 'Adding line...' : 'Add Line'}
        </button>
        {lastLineId ? <p>Last receiving line id: {lastLineId}</p> : null}
      </form>

      <section style={{ ...cardStyle, borderColor: '#fed7aa', color: '#9a3412' }}>
        <strong>Controlled Confirm/Post</strong>
        <p style={{ marginBottom: 0 }}>
          Confirm/Post is available only after a draft exists. The action uses the receiving post RPC only and
          does not perform direct table writes from this page.
        </p>
        {draft ? (
          <button
            type="button"
            disabled={!draft?.id || isPosting || postSucceeded}
            onClick={handleConfirmPost}
            style={{
              background: postSucceeded ? '#94a3b8' : '#b45309',
              border: 0,
              borderRadius: 8,
              color: '#ffffff',
              cursor: !draft?.id || isPosting || postSucceeded ? 'not-allowed' : 'pointer',
              marginTop: 16,
              minHeight: 42,
              padding: '10px 16px',
            }}
          >
            {isPosting ? 'Posting receiving...' : 'Confirm/Post Receiving'}
          </button>
        ) : null}
      </section>

      <Link className="action-link" to="/operations/receiving">
        Back to receiving
      </Link>
    </section>
  );
}
