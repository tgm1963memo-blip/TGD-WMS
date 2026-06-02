import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { getCurrentUserRole } from '../../../security/currentUserRole.js';
import { hasRoleAccess } from '../../../security/permissionGuard.js';
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

export function normalizeReceivingError(error) {
  if (!error) return 'An unknown error occurred.';
  const msg = error.message || String(error);
  
  if (msg.includes('duplicate key value') || msg.includes('unique constraint')) {
    return `Duplicate document number. (${msg})`;
  }
  if (msg.includes('invalid input syntax for type uuid')) {
    return `Invalid UUID format. (${msg})`;
  }
  if (msg.includes('status is CONFIRMED') || msg.includes('already confirmed')) {
    return `Document is already CONFIRMED and cannot be modified. (${msg})`;
  }
  if (msg.includes('JWT') || msg.includes('authentication')) {
    return `Authentication required. (${msg})`;
  }
  if (msg.includes('null value in column') || msg.includes('violates not-null')) {
    return `Missing required field. (${msg})`;
  }
  
  return msg;
}

function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
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

  const userRole = getCurrentUserRole();
  const canWrite = hasRoleAccess(userRole, 'warehouse_staff');

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

  const canSaveDraft = Boolean(draftForm.customer_id && draftForm.document_no.trim()) && !isSavingDraft && !draft;
  const canAddLine = Boolean(
    draft?.id
      && lineForm.product_id
      && lineForm.lot_id
      && lineForm.location_id
      && lineForm.quantity !== '',
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
    
    const docNo = draftForm.document_no.trim();
    if (!draftForm.customer_id) {
      setError('Customer is required.');
      return;
    }
    if (useManualEntry && !isValidUUID(draftForm.customer_id)) {
      setError('Invalid customer UUID format.');
      return;
    }
    if (!docNo) {
      setError('Document No is required and cannot be only whitespace.');
      return;
    }

    setIsSavingDraft(true);

    const result = await createReceivingDocument({
      customer_id: draftForm.customer_id,
      document_no: docNo,
    });

    setIsSavingDraft(false);

    if (result?.error) {
      setError(normalizeReceivingError(result.error));
      return;
    }

    const documentId = getCreatedDocumentId(result);
    setDraft({
      id: documentId,
      document_no: docNo,
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
      setError('Draft document id is required.');
      return;
    }

    if (!lineForm.product_id || !lineForm.lot_id || !lineForm.location_id) {
      setError('Product, lot, and location are required.');
      return;
    }

    if (useManualEntry) {
      if (!isValidUUID(lineForm.product_id)) {
        setError('Invalid product UUID format.');
        return;
      }
      if (!isValidUUID(lineForm.lot_id)) {
        setError('Invalid lot UUID format.');
        return;
      }
      if (!isValidUUID(lineForm.location_id)) {
        setError('Invalid location UUID format.');
        return;
      }
    } else {
      const selectedLot = masterState.lots.find((l) => l.id === lineForm.lot_id);
      if (selectedLot && selectedLot.product_id && selectedLot.product_id !== lineForm.product_id) {
        setError('Selected lot does not match the selected product.');
        return;
      }
    }

    const qty = Number(lineForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a number greater than 0.');
      return;
    }

    let weightVal = null;
    if (lineForm.weight !== '') {
      weightVal = Number(lineForm.weight);
      if (isNaN(weightVal) || weightVal < 0) {
        setError('Weight must be a number greater than or equal to 0.');
        return;
      }
    }

    setIsAddingLine(true);
    const result = await addReceivingLine({
      document_id: draft.id,
      product_id: lineForm.product_id,
      lot_id: lineForm.lot_id,
      location_id: lineForm.location_id,
      quantity: qty,
      weight: weightVal,
    });
    setIsAddingLine(false);

    if (result?.error) {
      setError(normalizeReceivingError(result.error));
      return;
    }

    setLastLineId(getCreatedLineId(result));
    setMessage('Receiving line added.');
  };

  const handleConfirmPost = async () => {
    setError('');
    setMessage('');

    if (!draft?.id) {
      setError('Draft document id is required.');
      return;
    }
    
    if (!lastLineId) {
      setError('Must have at least one line before Confirm/Post.');
      return;
    }

    if (postSucceeded) {
      return;
    }

    setIsPosting(true);
    const result = await postReceivingDocument(draft.id);
    setIsPosting(false);

    if (result?.error) {
      setError(normalizeReceivingError(result.error));
      return;
    }

    setDraft((current) => ({
      ...current,
      status: 'CONFIRMED',
    }));
    setPostSucceeded(true);
    setMessage('Receiving document Confirm/Post completed.');
  };

  if (!canWrite) {
    return (
      <div className="page-shell">
        <PageHeader title="Create Receiving Draft" description="Controlled receiving draft creation." />
        <section role="alert" style={{ ...cardStyle, borderColor: '#fecaca', color: '#991b1b' }}>
          Authentication required. Permission denied.
        </section>
        <Link className="action-link" to="/operations/receiving">Back to receiving list</Link>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title="Create Receiving Draft" description="Controlled receiving draft creation." />

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
            Master lookup error: {normalizeReceivingError(masterState.error)}
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
                style={inputStyle}
                value={draftForm.customer_id}
                onChange={(event) => updateDraftField('customer_id', event.target.value)}
              />
            ) : (
              <select
                aria-label="Customer"
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
                style={inputStyle}
                value={lineForm.product_id}
                onChange={(event) => updateLineField('product_id', event.target.value)}
              />
            ) : (
              <select
                aria-label="Product"
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
                style={inputStyle}
                value={lineForm.lot_id}
                onChange={(event) => updateLineField('lot_id', event.target.value)}
              />
            ) : (
              <select
                aria-label="Lot"
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
                style={inputStyle}
                value={lineForm.location_id}
                onChange={(event) => updateLineField('location_id', event.target.value)}
              />
            ) : (
              <select
                aria-label="Location"
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
    </div>
  );
}
