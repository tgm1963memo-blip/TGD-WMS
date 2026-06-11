import { useState } from 'react';
import { CustomerPortalDemoBanner } from '../../components/customer/CustomerPortalDemoBanner.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import {
  CUSTOMER_PORTAL_DEMO_DEPOSIT,
  CUSTOMER_PORTAL_DEMO_PACKING_LIST,
  CUSTOMER_PORTAL_DEMO_PALLETS,
} from '../../data/customerPortalDemoData.js';

export function CustomerWarehouseReceivingDemoPage() {
  const [pallets, setPallets] = useState([CUSTOMER_PORTAL_DEMO_PALLETS[0]]);
  const [varianceComment, setVarianceComment] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-warehouse-receiving-page">
      <PageHeader title="Warehouse Receiving From Customer Deposit" description="Pallet, box, and sticker preview only." />
      <CustomerPortalDemoBanner />
      {confirmed ? <div className="alert-success-panel" role="status">Receiving confirmation preview completed. No inventory movement was posted.</div> : null}
      <div className="form-grid">
        <label className="form-field"><span>Deposit document</span><select className="form-control" data-testid="receiving-document-select"><option>{CUSTOMER_PORTAL_DEMO_DEPOSIT.request_no}</option></select></label>
        <label className="form-field"><span>Product line</span><select className="form-control" data-testid="receiving-line-select"><option>{CUSTOMER_PORTAL_DEMO_DEPOSIT.customer_product_code} - {CUSTOMER_PORTAL_DEMO_DEPOSIT.product_name}</option></select></label>
      </div>
      <div className="customer-pallet-grid">
        {pallets.map((pallet, index) => (
          <div className="card customer-pallet-card" data-testid="pallet-card" key={`${pallet.pallet_code}-${index}`}>
            {Object.entries(pallet).map(([field, value]) => <label className="form-field" key={field}><span>{field}</span><input className="form-control" defaultValue={value} /></label>)}
          </div>
        ))}
      </div>
      <button className="btn btn-secondary" data-testid="add-pallet-button" disabled={pallets.length >= CUSTOMER_PORTAL_DEMO_PALLETS.length} onClick={() => setPallets(CUSTOMER_PORTAL_DEMO_PALLETS.slice(0, pallets.length + 1))} type="button">Add pallet demo</button>
      <div className="responsive-table">
        <table className="data-table" data-testid="packing-list-table">
          <thead><tr><th>Box no</th><th>Weight</th><th>Pallet</th><th>Note</th></tr></thead>
          <tbody>{CUSTOMER_PORTAL_DEMO_PACKING_LIST.map((box) => <tr key={box.box_no}><td>{box.box_no}</td><td>{box.box_weight} kg</td><td>{box.pallet_code}</td><td>{box.note}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="customer-sticker-grid">
        <div className="customer-sticker-preview" data-testid="pallet-sticker-preview"><strong>PALLET BARCODE</strong><span>|||| PLT-DEMO-001 ||||</span><span>{CUSTOMER_PORTAL_DEMO_DEPOSIT.lot_no}</span></div>
        <div className="customer-sticker-preview" data-testid="box-sticker-preview"><strong>BOX BARCODE</strong><span>|||| BOX-DEMO-001 ||||</span><span>20 kg</span></div>
      </div>
      <label className="form-field"><span>Variance comment</span><textarea className="form-control" data-testid="receiving-variance-comment" onChange={(event) => setVarianceComment(event.target.value)} rows={3} value={varianceComment} /></label>
      <button className="btn btn-primary" data-testid="receiving-confirm-demo-button" onClick={() => setConfirmed(true)} type="button">Confirm receiving demo</button>
    </section>
  );
}
