import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLineEditor } from '../../../components/operations/DraftLineEditor.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { createPutawayDocument } from '../../../services/putawayService.js';

const initialForm = {
  putaway_no: '',
  customer_id: '',
  source_id: '',
  warehouse_id: '',
  remark: '',
};

export function PutawayCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitDraft(event) {
    event.preventDefault();
    setError(null);

    const { data, error: createError } = await createPutawayDocument({
      ...form,
      status: 'DRAFT',
      source_type: 'RECEIVING',
    });

    if (createError) {
      setError(createError);
      return;
    }

    navigate(`/operations/putaway/${data.id}`);
  }

  return (
    <section className="page-shell">
      <PageHeader title="Create Putaway Draft" description="Draft header foundation. Lines remain placeholder-only in Sprint 5B." />
      {error ? <ErrorState message={error.message} /> : null}
      <form className="form-grid" onSubmit={submitDraft}>
        <label>Putaway No<input name="putaway_no" value={form.putaway_no} onChange={updateField} required /></label>
        <label>Customer ID<input name="customer_id" value={form.customer_id} onChange={updateField} required /></label>
        <label>Receiving Document ID<input name="source_id" value={form.source_id} onChange={updateField} /></label>
        <label>Warehouse ID<input name="warehouse_id" value={form.warehouse_id} onChange={updateField} required /></label>
        <label>Remark<textarea name="remark" value={form.remark} onChange={updateField} /></label>
        <DraftLineEditor />
        <button type="submit">Save draft</button>
      </form>
    </section>
  );
}
