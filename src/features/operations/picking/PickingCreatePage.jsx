import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLineEditor } from '../../../components/operations/DraftLineEditor.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { createPickingDocument } from '../../../services/pickingService.js';

const initialForm = {
  picking_no: '',
  withdrawal_request_id: '',
  allocation_id: '',
  customer_id: '',
  warehouse_id: '',
  picking_method: 'MANUAL',
  remark: '',
};

export function PickingCreatePage() {
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

    if (!payload.allocation_id) {
      delete payload.allocation_id;
    }

    const { data, error: createError } = await createPickingDocument(payload);

    if (createError) {
      setError(createError);
      return;
    }

    navigate(`/operations/picking/${data.id}`);
  }

  return (
    <section className="page-shell">
      <PageHeader title="Create Picking Draft" description="Draft header foundation. Lines remain placeholder-only in Sprint 5D." />
      {error ? <ErrorState message={error.message} /> : null}
      <form className="form-grid" onSubmit={submitDraft}>
        <label>Picking No<input name="picking_no" value={form.picking_no} onChange={updateField} required /></label>
        <label>Withdrawal Request ID<input name="withdrawal_request_id" value={form.withdrawal_request_id} onChange={updateField} required /></label>
        <label>Allocation ID<input name="allocation_id" value={form.allocation_id} onChange={updateField} /></label>
        <label>Customer ID<input name="customer_id" value={form.customer_id} onChange={updateField} required /></label>
        <label>Warehouse ID<input name="warehouse_id" value={form.warehouse_id} onChange={updateField} required /></label>
        <label>Picking Method<input name="picking_method" value={form.picking_method} onChange={updateField} required /></label>
        <label>Remark<textarea name="remark" value={form.remark} onChange={updateField} /></label>
        <DraftLineEditor />
        <button type="submit">Save draft</button>
      </form>
    </section>
  );
}
