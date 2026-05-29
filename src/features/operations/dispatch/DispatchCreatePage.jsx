import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLineEditor } from '../../../components/operations/DraftLineEditor.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { createDispatchDocument } from '../../../services/dispatchService.js';

const initialForm = {
  dispatch_no: '',
  withdrawal_request_id: '',
  picking_document_id: '',
  customer_id: '',
  warehouse_id: '',
  dispatch_type: 'NORMAL',
  dispatch_date: '',
  transport_type: '',
  vehicle_no: '',
  driver_name: '',
  remark: '',
};

export function DispatchCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitDraft(event) {
    event.preventDefault();
    setError(null);

    const payload = { ...form, status: 'DRAFT' };

    ['picking_document_id', 'dispatch_date', 'transport_type'].forEach((field) => {
      if (!payload[field]) {
        delete payload[field];
      }
    });

    const { data, error: createError } = await createDispatchDocument(payload);

    if (createError) {
      setError(createError);
      return;
    }

    navigate(`/operations/dispatch/${data.id}`);
  }

  return (
    <section className="page-shell">
      <PageHeader title="Create Dispatch Draft" description="Draft header foundation. Lines remain placeholder-only in Sprint 5D." />
      {error ? <ErrorState message={error.message} /> : null}
      <form className="form-grid" onSubmit={submitDraft}>
        <label>Dispatch No<input name="dispatch_no" value={form.dispatch_no} onChange={updateField} required /></label>
        <label>Withdrawal Request ID<input name="withdrawal_request_id" value={form.withdrawal_request_id} onChange={updateField} required /></label>
        <label>Picking Document ID<input name="picking_document_id" value={form.picking_document_id} onChange={updateField} /></label>
        <label>Customer ID<input name="customer_id" value={form.customer_id} onChange={updateField} required /></label>
        <label>Warehouse ID<input name="warehouse_id" value={form.warehouse_id} onChange={updateField} required /></label>
        <label>Dispatch Type<input name="dispatch_type" value={form.dispatch_type} onChange={updateField} required /></label>
        <label>Dispatch Date<input name="dispatch_date" type="date" value={form.dispatch_date} onChange={updateField} /></label>
        <label>Transport Type<input name="transport_type" value={form.transport_type} onChange={updateField} /></label>
        <label>Vehicle No<input name="vehicle_no" value={form.vehicle_no} onChange={updateField} /></label>
        <label>Driver Name<input name="driver_name" value={form.driver_name} onChange={updateField} /></label>
        <label>Remark<textarea name="remark" value={form.remark} onChange={updateField} /></label>
        <DraftLineEditor />
        <button type="submit">Save draft</button>
      </form>
    </section>
  );
}
