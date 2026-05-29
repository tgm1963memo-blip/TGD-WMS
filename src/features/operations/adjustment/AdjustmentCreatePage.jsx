import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLineEditor } from '../../../components/operations/DraftLineEditor.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { createAdjustmentDocument } from '../../../services/adjustmentService.js';

const initialForm = {
  adjustment_no: '',
  customer_id: '',
  warehouse_id: '',
  adjustment_type: 'SYSTEM_CORRECTION',
  remark: '',
};

export function AdjustmentCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitDraft(event) {
    event.preventDefault();
    setError(null);

    const { data, error: createError } = await createAdjustmentDocument({
      ...form,
      status: 'DRAFT',
    });

    if (createError) {
      setError(createError);
      return;
    }

    navigate(`/operations/adjustment/${data.id}`);
  }

  return (
    <section className="page-shell">
      <PageHeader title="Create Adjustment Draft" description="Draft header foundation. Lines remain placeholder-only in Sprint 5C." />
      {error ? <ErrorState message={error.message} /> : null}
      <form className="form-grid" onSubmit={submitDraft}>
        <label>Adjustment No<input name="adjustment_no" value={form.adjustment_no} onChange={updateField} required /></label>
        <label>Customer ID<input name="customer_id" value={form.customer_id} onChange={updateField} required /></label>
        <label>Warehouse ID<input name="warehouse_id" value={form.warehouse_id} onChange={updateField} required /></label>
        <label>Adjustment Type<input name="adjustment_type" value={form.adjustment_type} onChange={updateField} required /></label>
        <label>Reason / Remark<textarea name="remark" value={form.remark} onChange={updateField} /></label>
        <DraftLineEditor />
        <button type="submit">Save draft</button>
      </form>
    </section>
  );
}
