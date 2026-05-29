import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLineEditor } from '../../../components/operations/DraftLineEditor.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { createReceivingDocument } from '../../../services/receivingService.js';

const initialForm = {
  receiving_no: '',
  customer_id: '',
  warehouse_id: '',
  receiving_type: 'NORMAL',
  source_no: '',
  remark: '',
};

export function ReceivingCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitDraft(event) {
    event.preventDefault();
    setError(null);

    const { data, error: createError } = await createReceivingDocument({
      ...form,
      status: 'DRAFT',
    });

    if (createError) {
      setError(createError);
      return;
    }

    navigate(`/operations/receiving/${data.id}`);
  }

  return (
    <section className="page-shell">
      <PageHeader title="Create Receiving Draft" description="Draft header foundation. Lines remain placeholder-only in Sprint 5B." />
      {error ? <ErrorState message={error.message} /> : null}
      <form className="form-grid" onSubmit={submitDraft}>
        <label>Receiving No<input name="receiving_no" value={form.receiving_no} onChange={updateField} required /></label>
        <label>Customer ID<input name="customer_id" value={form.customer_id} onChange={updateField} required /></label>
        <label>Warehouse ID<input name="warehouse_id" value={form.warehouse_id} onChange={updateField} required /></label>
        <label>Receiving Type<input name="receiving_type" value={form.receiving_type} onChange={updateField} required /></label>
        <label>Reference No<input name="source_no" value={form.source_no} onChange={updateField} /></label>
        <label>Remark<textarea name="remark" value={form.remark} onChange={updateField} /></label>
        <DraftLineEditor />
        <button type="submit">Save draft</button>
      </form>
    </section>
  );
}
