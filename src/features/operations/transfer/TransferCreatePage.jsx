import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLineEditor } from '../../../components/operations/DraftLineEditor.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { createTransferDocument } from '../../../services/transferService.js';

const initialForm = {
  transfer_no: '',
  customer_id: '',
  from_warehouse_id: '',
  to_warehouse_id: '',
  transfer_type: 'INTERNAL',
  remark: '',
};

export function TransferCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitDraft(event) {
    event.preventDefault();
    setError(null);

    const { data, error: createError } = await createTransferDocument({
      ...form,
      status: 'DRAFT',
    });

    if (createError) {
      setError(createError);
      return;
    }

    navigate(`/operations/transfer/${data.id}`);
  }

  return (
    <section className="page-shell">
      <PageHeader title="Create Transfer Draft" description="Draft header foundation. Lines remain placeholder-only in Sprint 5C." />
      {error ? <ErrorState message={error.message} /> : null}
      <form className="form-grid" onSubmit={submitDraft}>
        <label>Transfer No<input name="transfer_no" value={form.transfer_no} onChange={updateField} required /></label>
        <label>Customer ID<input name="customer_id" value={form.customer_id} onChange={updateField} required /></label>
        <label>From Warehouse ID<input name="from_warehouse_id" value={form.from_warehouse_id} onChange={updateField} required /></label>
        <label>To Warehouse ID<input name="to_warehouse_id" value={form.to_warehouse_id} onChange={updateField} required /></label>
        <label>Transfer Type<input name="transfer_type" value={form.transfer_type} onChange={updateField} required /></label>
        <label>Remark<textarea name="remark" value={form.remark} onChange={updateField} /></label>
        <DraftLineEditor />
        <button type="submit">Save draft</button>
      </form>
    </section>
  );
}
