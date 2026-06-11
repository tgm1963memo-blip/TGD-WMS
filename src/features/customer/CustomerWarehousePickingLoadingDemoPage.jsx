import { useState } from 'react';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import {
  CUSTOMER_PORTAL_DEMO_PACKING_LIST,
  CUSTOMER_PORTAL_DEMO_WITHDRAWAL,
} from '../../data/customerPortalDemoData.js';

export function CustomerWarehousePickingLoadingDemoPage() {
  const [palletBarcode, setPalletBarcode] = useState('');
  const [boxBarcode, setBoxBarcode] = useState('');
  const [status, setStatus] = useState('');

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-warehouse-picking-loading-page">
      <PageHeader title="Warehouse Picking and Loading Demo" description="Barcode, packing list, picked, and loaded preview only." />
      <CustomerPortalDemoBanner />
      {status ? <div className="alert-success-panel" role="status">{status}. No stock or dispatch record was changed.</div> : null}
      <label className="form-field"><span>Withdrawal document</span><select className="form-control" data-testid="withdrawal-document-select"><option>{CUSTOMER_PORTAL_DEMO_WITHDRAWAL.request_no}</option></select></label>
      <div className="info-panel" data-testid="picking-instruction-panel">
        <strong>{CUSTOMER_PORTAL_DEMO_WITHDRAWAL.picking_rule}</strong>
        <p>Pick from {CUSTOMER_PORTAL_DEMO_WITHDRAWAL.deposit_request_no}, lot {CUSTOMER_PORTAL_DEMO_WITHDRAWAL.lot_no}.</p>
      </div>
      <div className="form-grid">
        <label className="form-field"><span>Pallet barcode</span><input className="form-control" data-testid="pallet-barcode-input" onChange={(event) => setPalletBarcode(event.target.value)} value={palletBarcode} /></label>
        <label className="form-field"><span>Box barcode</span><input className="form-control" data-testid="box-barcode-input" onChange={(event) => setBoxBarcode(event.target.value)} value={boxBarcode} /></label>
      </div>
      <div className="responsive-table">
        <table className="data-table" data-testid="picking-packing-list-table">
          <thead><tr><th>Box no</th><th>Weight</th><th>Pallet</th></tr></thead>
          <tbody>{CUSTOMER_PORTAL_DEMO_PACKING_LIST.map((box) => <tr key={box.box_no}><td>{box.box_no}</td><td>{box.box_weight} kg</td><td>{box.pallet_code}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="customer-sticker-preview"><strong>Packing / sticker preview</strong><span>{palletBarcode || 'PLT-DEMO-001'} / {boxBarcode || 'BOX-DEMO-001'}</span></div>
      <div className="action-row">
        <button className="btn btn-secondary" data-testid="confirm-picked-demo-button" onClick={() => setStatus('Picked confirmation preview completed')} type="button">Confirm picked demo</button>
        <button className="btn btn-primary" data-testid="confirm-loaded-demo-button" onClick={() => setStatus('Loaded confirmation preview completed')} type="button">Confirm loaded demo</button>
      </div>
    </section>
  );
}
