import { useState } from 'react';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CUSTOMER_PORTAL_DEMO_DEPOSIT } from '../../data/customerPortalDemoData.js';

export function CustomerAdminDepositReviewPage() {
  const [action, setAction] = useState('');
  const row = CUSTOMER_PORTAL_DEMO_DEPOSIT;

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-admin-deposit-review-page">
      <PageHeader title="Admin Deposit Review Demo" description="Review a customer deposit request without writing to the database." />
      <CustomerPortalDemoBanner />
      {action ? <div className="alert-success-panel" role="status">{action} (demo only)</div> : null}
      <div className="table-card">
        <div className="responsive-table">
          <table className="data-table" data-testid="admin-deposit-review-table">
            <thead><tr><th>Request</th><th>Customer product</th><th>Internal product</th><th>Expected</th><th>Attachments</th><th>Status</th></tr></thead>
            <tbody><tr><td>{row.request_no}</td><td>{row.customer_product_code}</td><td>{row.internal_product_code}</td><td>{row.expected_boxes} boxes / {row.expected_weight} kg</td><td>{row.attachments.length}</td><td>{row.status}</td></tr></tbody>
          </table>
        </div>
      </div>
      <label className="form-field"><span>Admin comment</span><textarea className="form-control" rows={3} /></label>
      <div className="action-row">
        <button className="btn btn-primary" data-testid="admin-accept-deposit-button" onClick={() => setAction('Deposit request accepted')} type="button">Accept request</button>
        <button className="btn btn-secondary" onClick={() => setAction('More information requested')} type="button">Request more information</button>
        <button className="btn btn-primary" data-testid="admin-send-to-warehouse-button" onClick={() => setAction('Sent to warehouse receiving')} type="button">Send to warehouse receiving</button>
      </div>
    </section>
  );
}
