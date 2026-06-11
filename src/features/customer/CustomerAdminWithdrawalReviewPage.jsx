import { useState } from 'react';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CUSTOMER_PORTAL_DEMO_WITHDRAWAL } from '../../data/customerPortalDemoData.js';

export function CustomerAdminWithdrawalReviewPage() {
  const [action, setAction] = useState('');
  const row = CUSTOMER_PORTAL_DEMO_WITHDRAWAL;

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-admin-withdrawal-review-page">
      <PageHeader title="Admin Withdrawal Review Demo" description="Review customer withdrawal instructions without allocation." />
      <CustomerPortalDemoBanner />
      {action ? <div className="alert-success-panel" role="status">{action} (demo only)</div> : null}
      <div className="responsive-table">
        <table className="data-table" data-testid="admin-withdrawal-review-table">
          <thead><tr><th>Request</th><th>Source deposit</th><th>Lot</th><th>Customer product</th><th>Requested</th><th>Rule</th></tr></thead>
          <tbody><tr><td>{row.request_no}</td><td>{row.deposit_request_no}</td><td>{row.lot_no}</td><td>{row.customer_product_code}</td><td>{row.requested_boxes} boxes / {row.requested_weight} kg</td><td>{row.picking_rule}</td></tr></tbody>
        </table>
      </div>
      <label className="form-field"><span>Admin comment</span><textarea className="form-control" rows={3} /></label>
      <div className="action-row">
        <button className="btn btn-primary" data-testid="admin-accept-withdrawal-button" onClick={() => setAction('Withdrawal accepted')} type="button">Accept withdrawal</button>
        <button className="btn btn-secondary" onClick={() => setAction('Clarification requested')} type="button">Request clarification</button>
        <button className="btn btn-primary" data-testid="admin-send-to-picking-button" onClick={() => setAction('Sent to warehouse picking')} type="button">Send to warehouse picking</button>
      </div>
    </section>
  );
}
