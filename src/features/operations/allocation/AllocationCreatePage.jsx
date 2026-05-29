import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLineEditor } from '../../../components/operations/DraftLineEditor.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { createWithdrawalAllocation } from '../../../services/withdrawalAllocationService.js';

const initialForm = {
  allocation_no: '',
  withdrawal_request_id: '',
  customer_id: '',
  warehouse_id: '',
  allocation_method: 'MANUAL',
  remark: '',
};

export function AllocationCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitDraft(event) {
    event.preventDefault();
    setError(null);

    const { data, error: createError } = await createWithdrawalAllocation({
      ...form,
      status: 'DRAFT',
    });

    if (createError) {
      setError(createError);
      return;
    }

    navigate(`/operations/allocations/${data.id}`);
  }

  return (
    <section className="page-shell">
      <PageHeader title="Create Allocation Draft" description="Draft header foundation. Lines remain placeholder-only in Sprint 5D." />
      {error ? <ErrorState message={error.message} /> : null}
      <form className="form-grid" onSubmit={submitDraft}>
        <label>Allocation No<input name="allocation_no" value={form.allocation_no} onChange={updateField} required /></label>
        <label>Withdrawal Request ID<input name="withdrawal_request_id" value={form.withdrawal_request_id} onChange={updateField} required /></label>
        <label>Customer ID<input name="customer_id" value={form.customer_id} onChange={updateField} required /></label>
        <label>Warehouse ID<input name="warehouse_id" value={form.warehouse_id} onChange={updateField} required /></label>
        <label>Allocation Method<input name="allocation_method" value={form.allocation_method} onChange={updateField} required /></label>
        <label>Remark<textarea name="remark" value={form.remark} onChange={updateField} /></label>
        <DraftLineEditor />
        <button type="submit">Save draft</button>
      </form>
    </section>
  );
}
