import { useState } from 'react';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import {
  addOutboundLine,
  createOutboundDraft,
  releaseOutboundReservation,
  reserveOutboundStock,
} from '../../../services/outboundPickingService.js';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #d9e2ec',
  borderRadius: 8,
  marginBottom: 18,
  padding: 16,
};

const gridStyle = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

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

const buttonStyle = {
  background: '#0f766e',
  border: 0,
  borderRadius: 8,
  color: '#ffffff',
  cursor: 'pointer',
  marginTop: 16,
  minHeight: 42,
  padding: '10px 16px',
};

const safetyNote = 'Draft/reserve/release only. No stock posting. No stock movement OUT. No stock balance update.';

function stringifyResult(result) {
  return JSON.stringify(result, null, 2);
}

export function OutboundDraftPage() {
  const [draftForm, setDraftForm] = useState({
    document_no: '',
    customer_id: '',
    source_document_no: '',
    requested_ship_date: '',
  });
  const [lineForm, setLineForm] = useState({
    document_id: '',
    product_id: '',
    lot_id: '',
    requested_quantity: '',
    requested_weight: '',
  });
  const [reserveForm, setReserveForm] = useState({
    outbound_document_id: '',
    outbound_line_id: '',
    location_id: '',
    reserved_quantity: '',
    reserved_weight: '',
  });
  const [releaseForm, setReleaseForm] = useState({
    reservation_id: '',
  });
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const updateDraftField = (field, value) => {
    setDraftForm((current) => ({ ...current, [field]: value }));
  };

  const updateLineField = (field, value) => {
    setLineForm((current) => ({ ...current, [field]: value }));
  };

  const updateReserveField = (field, value) => {
    setReserveForm((current) => ({ ...current, [field]: value }));
  };

  const updateReleaseField = (field, value) => {
    setReleaseForm((current) => ({ ...current, [field]: value }));
  };

  const runAction = async (action) => {
    setError('');
    setResult('');

    try {
      const data = await action();
      setResult(stringifyResult(data));
    } catch (actionError) {
      setError(actionError.message || String(actionError));
    }
  };

  const handleCreateDraft = (event) => {
    event.preventDefault();
    runAction(() => createOutboundDraft({
      document_no: draftForm.document_no,
      customer_id: draftForm.customer_id || null,
      source_document_no: draftForm.source_document_no || null,
      requested_ship_date: draftForm.requested_ship_date || null,
    }));
  };

  const handleAddLine = (event) => {
    event.preventDefault();
    runAction(() => addOutboundLine({
      document_id: lineForm.document_id,
      product_id: lineForm.product_id,
      lot_id: lineForm.lot_id || null,
      requested_quantity: Number(lineForm.requested_quantity),
      requested_weight: lineForm.requested_weight === '' ? 0 : Number(lineForm.requested_weight),
    }));
  };

  const handleReserve = (event) => {
    event.preventDefault();
    runAction(() => reserveOutboundStock({
      outbound_document_id: reserveForm.outbound_document_id,
      outbound_line_id: reserveForm.outbound_line_id,
      location_id: reserveForm.location_id,
      reserved_quantity: Number(reserveForm.reserved_quantity),
      reserved_weight: reserveForm.reserved_weight === '' ? 0 : Number(reserveForm.reserved_weight),
    }));
  };

  const handleRelease = (event) => {
    event.preventDefault();
    runAction(() => releaseOutboundReservation({
      reservation_id: releaseForm.reservation_id,
    }));
  };

  return (
    <section className="page-shell">
      <PageHeader title="Outbound Draft Smoke UI" description="Draft, reservation, and release service integration only." />

      <section role="status" style={{ ...cardStyle, borderColor: '#fde68a', color: '#92400e' }}>
        {safetyNote}
      </section>

      {error ? (
        <section role="alert" style={{ ...cardStyle, borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </section>
      ) : null}

      {result ? (
        <section style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Last result</h3>
          <pre style={{ marginBottom: 0, overflowX: 'auto' }}>{result}</pre>
        </section>
      ) : null}

      <form onSubmit={handleCreateDraft} style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Create outbound draft</h3>
        <div style={gridStyle}>
          <label style={fieldStyle}>
            Document No
            <input aria-label="Outbound document no" required style={inputStyle} value={draftForm.document_no} onChange={(event) => updateDraftField('document_no', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Customer ID
            <input aria-label="Outbound customer id" style={inputStyle} value={draftForm.customer_id} onChange={(event) => updateDraftField('customer_id', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Source Document No
            <input aria-label="Outbound source document no" style={inputStyle} value={draftForm.source_document_no} onChange={(event) => updateDraftField('source_document_no', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Requested Ship Date
            <input aria-label="Outbound requested ship date" style={inputStyle} type="date" value={draftForm.requested_ship_date} onChange={(event) => updateDraftField('requested_ship_date', event.target.value)} />
          </label>
        </div>
        <button type="submit" style={buttonStyle}>Create Draft</button>
      </form>

      <form onSubmit={handleAddLine} style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Add outbound line</h3>
        <div style={gridStyle}>
          <label style={fieldStyle}>
            Document ID
            <input aria-label="Outbound line document id" required style={inputStyle} value={lineForm.document_id} onChange={(event) => updateLineField('document_id', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Product ID
            <input aria-label="Outbound line product id" required style={inputStyle} value={lineForm.product_id} onChange={(event) => updateLineField('product_id', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Lot ID
            <input aria-label="Outbound line lot id" style={inputStyle} value={lineForm.lot_id} onChange={(event) => updateLineField('lot_id', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Requested Quantity
            <input aria-label="Outbound line requested quantity" min="0" required step="any" style={inputStyle} type="number" value={lineForm.requested_quantity} onChange={(event) => updateLineField('requested_quantity', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Requested Weight
            <input aria-label="Outbound line requested weight" min="0" step="any" style={inputStyle} type="number" value={lineForm.requested_weight} onChange={(event) => updateLineField('requested_weight', event.target.value)} />
          </label>
        </div>
        <button type="submit" style={buttonStyle}>Add Line</button>
      </form>

      <form onSubmit={handleReserve} style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Reserve outbound stock</h3>
        <div style={gridStyle}>
          <label style={fieldStyle}>
            Outbound Document ID
            <input aria-label="Reserve outbound document id" required style={inputStyle} value={reserveForm.outbound_document_id} onChange={(event) => updateReserveField('outbound_document_id', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Outbound Line ID
            <input aria-label="Reserve outbound line id" required style={inputStyle} value={reserveForm.outbound_line_id} onChange={(event) => updateReserveField('outbound_line_id', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Location ID
            <input aria-label="Reserve location id" required style={inputStyle} value={reserveForm.location_id} onChange={(event) => updateReserveField('location_id', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Reserved Quantity
            <input aria-label="Reserve quantity" min="0" required step="any" style={inputStyle} type="number" value={reserveForm.reserved_quantity} onChange={(event) => updateReserveField('reserved_quantity', event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Reserved Weight
            <input aria-label="Reserve weight" min="0" step="any" style={inputStyle} type="number" value={reserveForm.reserved_weight} onChange={(event) => updateReserveField('reserved_weight', event.target.value)} />
          </label>
        </div>
        <button type="submit" style={buttonStyle}>Reserve Stock</button>
      </form>

      <form onSubmit={handleRelease} style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Release reservation</h3>
        <label style={fieldStyle}>
          Reservation ID
          <input aria-label="Release reservation id" required style={inputStyle} value={releaseForm.reservation_id} onChange={(event) => updateReleaseField('reservation_id', event.target.value)} />
        </label>
        <button type="submit" style={buttonStyle}>Release Reservation</button>
      </form>
    </section>
  );
}
