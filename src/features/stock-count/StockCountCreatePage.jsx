import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLineEditor } from '../../components/operations/DraftLineEditor.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { createStockCountDocument } from '../../services/stockCountService.js';

const initialForm = {
  stock_count_no: '',
  warehouse_id: '',
  count_type: 'CYCLE_COUNT',
  count_date: '',
  remark: '',
};

export function StockCountCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitDraft(event) {
    event.preventDefault();
    setError(null);

    const payload = {
      ...form,
      status: 'DRAFT',
    };

    if (!payload.count_date) {
      delete payload.count_date;
    }

    const { data, error: createError } = await createStockCountDocument(payload);

    if (createError) {
      setError(createError);
      return;
    }

    navigate(`/stock-count/${data.id}`);
  }

  return (
    <section className="page-shell">
      <PageHeader title="Create Stock Count Draft" description="Draft header foundation. Count lines remain placeholder-only in Sprint 5C." />
      {error ? <ErrorState message={error.message} /> : null}
      <form className="form-grid" onSubmit={submitDraft}>
        <label>Stock Count No<input name="stock_count_no" value={form.stock_count_no} onChange={updateField} required /></label>
        <label>Warehouse ID<input name="warehouse_id" value={form.warehouse_id} onChange={updateField} required /></label>
        <label>Count Type<input name="count_type" value={form.count_type} onChange={updateField} required /></label>
        <label>Count Date<input name="count_date" type="date" value={form.count_date} onChange={updateField} /></label>
        <label>Remark<textarea name="remark" value={form.remark} onChange={updateField} /></label>
        <DraftLineEditor />
        <button type="submit">Save draft</button>
      </form>
    </section>
  );
}
