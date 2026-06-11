import { useState } from 'react';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CUSTOMER_PORTAL_DEMO_DEPOSIT } from '../../data/customerPortalDemoData.js';

export function CustomerAdminReceivingVerificationPage() {
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState('');
  const row = CUSTOMER_PORTAL_DEMO_DEPOSIT;

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-admin-receiving-verification-page">
      <PageHeader title="Admin Receiving Verification Demo" description="Compare expected and received values, then preview customer communication." />
      <CustomerPortalDemoBanner />
      <div className="warning-panel" data-testid="receiving-variance-panel">
        <h3>Receiving variance</h3>
        <p>{row.customer_product_code}: expected {row.expected_boxes} boxes / {row.expected_weight} kg; received {row.received_boxes} boxes / {row.received_weight} kg.</p>
        <p>References: {row.attachments.join(', ')}</p>
        <textarea className="form-control" aria-label="Recount comment" rows={3} />
        <button className="btn btn-secondary" data-testid="request-recount-button" onClick={() => setMessage('Recount request previewed')} type="button">Request recount</button>
      </div>
      {message ? <div className="alert-success-panel" role="status">{message}</div> : null}
      <button className="btn btn-primary" data-testid="notify-customer-preview-button" onClick={() => setPreview(true)} type="button">Notify customer preview</button>
      {preview ? (
        <div className="customer-notification-preview" data-testid="customer-notification-preview">
          <h3>System notification and email preview</h3>
          <p>Deposit {row.request_no} receiving verification is ready. This preview was not sent.</p>
        </div>
      ) : null}
    </section>
  );
}
