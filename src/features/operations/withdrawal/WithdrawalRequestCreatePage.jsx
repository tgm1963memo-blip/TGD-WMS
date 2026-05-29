import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftLineEditor } from '../../../components/operations/DraftLineEditor.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { createWithdrawalRequest } from '../../../services/withdrawalRequestService.js';

const initialForm = {
  withdrawal_no: '',
  customer_id: '',
  warehouse_id: '',
  withdrawal_type: 'NORMAL',
  requested_dispatch_date: '',
  remark: '',
};

export function WithdrawalRequestCreatePage() {
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

    if (!payload.requested_dispatch_date) {
      delete payload.requested_dispatch_date;
    }

    const { data, error: createError } = await createWithdrawalRequest(payload);

    if (createError) {
      setError(createError);
      return;
    }

    navigate(`/operations/withdrawal-requests/${data.id}`);
  }

  return (
    <section className="page-shell">
      <PageHeader title="Create Withdrawal Draft" description="Draft header foundation. Lines remain placeholder-only in Sprint 5D." />
      {error ? <ErrorState message={error.message} /> : null}
      <form className="form-grid" onSubmit={submitDraft}>
        <label>Withdrawal No<input name="withdrawal_no" value={form.withdrawal_no} onChange={updateField} required /></label>
        <label>Customer ID<input name="customer_id" value={form.customer_id} onChange={updateField} required /></label>
        <label>Warehouse ID<input name="warehouse_id" value={form.warehouse_id} onChange={updateField} required /></label>
        <label>Withdrawal Type<input name="withdrawal_type" value={form.withdrawal_type} onChange={updateField} required /></label>
        <label>Requested Dispatch Date<input name="requested_dispatch_date" type="date" value={form.requested_dispatch_date} onChange={updateField} /></label>
        <label>Remark<textarea name="remark" value={form.remark} onChange={updateField} /></label>
        <DraftLineEditor />
        <button type="submit">Save draft</button>
      </form>
    </section>
  );
}
