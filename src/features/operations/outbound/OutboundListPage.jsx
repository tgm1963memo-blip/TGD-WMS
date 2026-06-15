import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { DeliverySlipTemplate } from '../../../components/reports/DeliverySlipTemplate.jsx';
import { ReportPrintActions } from '../../../components/reports/ReportPrintActions.jsx';
import { getTranslation } from '../../../i18n/translationCatalog.js';
import { useLanguage } from '../../../i18n/languageProvider.jsx';
import { formatDocumentDate } from '../../../utils/documentDisplayUtils.js';
import {
  getOutboundDocumentDetail,
  listOutboundDocuments,
} from '../../../services/outboundPickingService.js';
import { mapOutboundDetailToDeliverySlipData } from '../../../services/operationalReportMapper.js';

const safetyNote = 'Read-only outbound list/detail. No post outbound. No stock movement OUT. No stock balance update.';

function EmptyRow({ colSpan, label }) {
  return (
    <tr>
      <td className="table-cell" colSpan={colSpan} style={{ textAlign: 'center', padding: '24px', color: 'var(--tgd-muted-text)' }}>{label}</td>
    </tr>
  );
}

export function OutboundListPage() {
  const { language } = useLanguage();
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  const loadDocuments = async () => {
    setError('');
    setLoadingList(true);

    try {
      const rows = await listOutboundDocuments();
      setDocuments(rows ?? []);
      if (!selectedDocumentId && rows?.[0]?.id) {
        setSelectedDocumentId(rows[0].id);
      }
    } catch (listError) {
      setError(listError.message || String(listError));
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (documentId) => {
    if (!documentId) {
      setDetail(null);
      return;
    }

    setError('');
    setLoadingDetail(true);

    try {
      const nextDetail = await getOutboundDocumentDetail(documentId);
      setDetail(nextDetail);
    } catch (detailError) {
      setError(detailError.message || String(detailError));
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    loadDetail(selectedDocumentId);
  }, [selectedDocumentId]);

  return (
    <section className="page-shell outbound-page">
      <PageHeader 
        title="Outbound Operations" 
        description="Withdrawal, reservation, picking, and post outbound flow." 
      />
      <div className="dashboard-header-actions operations-page-actions" style={{ gap: 12 }}>
         <span className="production-hold-badge">Production HOLD</span>
         <Link className="btn-primary-gold" to="/operations/outbound-draft" style={{ padding: '8px 12px', background: 'var(--tgd-primary-gold)', color: '#000', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>Open Draft Smoke UI</Link>
      </div>

      {error ? (
        <section className="alert-panel alert-danger" role="alert">
          {error}
        </section>
      ) : null}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card info">
          <h3 className="kpi-label">Draft</h3>
          <div className="kpi-value">14</div>
          <div className="kpi-helper">New requests</div>
        </div>
        <div className="kpi-card warning">
          <h3 className="kpi-label">Reserved</h3>
          <div className="kpi-value">6</div>
          <div className="kpi-helper">Awaiting picking</div>
        </div>
        <div className="kpi-card success">
          <h3 className="kpi-label">Picked</h3>
          <div className="kpi-value">8</div>
          <div className="kpi-helper">Ready to dispatch</div>
        </div>
        <div className="kpi-card danger">
          <h3 className="kpi-label">Posted</h3>
          <div className="kpi-value">3</div>
          <div className="kpi-helper">Dispatched today</div>
        </div>
      </div>

      {/* Workflow Stepper */}
      <div className="workflow-panel" style={{ marginBottom: 24 }}>
        <div className="workflow-step">
          <div className="workflow-step-name">Draft</div>
          <div className="workflow-step-status info">Request received</div>
        </div>
        <div className="workflow-connector">→</div>
        <div className="workflow-step">
          <div className="workflow-step-name">Reserve</div>
          <div className="workflow-step-status warning">Stock allocated</div>
        </div>
        <div className="workflow-connector">→</div>
        <div className="workflow-step">
          <div className="workflow-step-name">Pick</div>
          <div className="workflow-step-status success">Items gathered</div>
        </div>
        <div className="workflow-connector">→</div>
        <div className="workflow-step">
          <div className="workflow-step-name">Post Outbound</div>
          <div className="workflow-step-status danger">Final dispatch</div>
        </div>
      </div>

      <div className="dashboard-grid-2col" style={{ alignItems: 'flex-start' }}>
        {/* Outbound List */}
        <section className="section-card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: 'var(--tgd-main-text)' }}>Outbound Documents</h3>
            <button type="button" className="btn-primary-gold" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={loadDocuments}>Refresh</button>
          </div>
          
          <div className="filter-area" style={{ background: 'var(--tgd-main-bg)', padding: '12px', borderRadius: 8, marginBottom: 16, display: 'flex', gap: 12 }}>
             <input type="text" placeholder="Search document no..." style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--tgd-border)', flex: 1 }} />
             <select style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--tgd-border)' }}>
               <option>All Status</option>
               <option>Draft</option>
               <option>Reserved</option>
             </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--tgd-border)' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--tgd-muted-text)' }}>Document No</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--tgd-muted-text)' }}>Status</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--tgd-muted-text)' }}>Customer</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--tgd-muted-text)' }}>Date</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--tgd-muted-text)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? <EmptyRow colSpan={5} label="Loading outbound documents..." /> : null}
                {!loadingList && documents.length === 0 ? <EmptyRow colSpan={5} label="No outbound documents found." /> : null}
                {!loadingList && documents.map((document) => (
                  <tr key={document.id} style={{ borderBottom: '1px solid var(--tgd-border)', background: selectedDocumentId === document.id ? 'var(--tgd-main-bg)' : 'transparent' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>{document.document_no}</td>
                    <td style={{ padding: '12px 8px' }}><StatusBadge value={document.status} /></td>
                    <td style={{ padding: '12px 8px' }}><span className="table-meta-text">{document.customer_id || '-'}</span></td>
                    <td style={{ padding: '12px 8px' }}><span className="table-meta-text">{formatDocumentDate(document.requested_ship_date, { dateOnly: true })}</span></td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <button 
                        type="button" 
                        style={{ background: 'transparent', border: '1px solid var(--tgd-border)', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontWeight: 600, color: 'var(--tgd-main-text)' }} 
                        onClick={() => setSelectedDocumentId(document.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detail Panel */}
        <section className="section-card" style={{ marginBottom: 0, position: 'sticky', top: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: 'var(--tgd-main-text)' }}>Document Detail</h3>
            <ReportPrintActions
              title={getTranslation('delivery_slip_report', language) || 'Delivery Slip'}
              disabled={!detail}
              renderReport={(reportLanguage) => (
                <DeliverySlipTemplate
                  data={mapOutboundDetailToDeliverySlipData(detail)}
                  language={reportLanguage}
                />
              )}
            />
          </div>
          {loadingDetail ? <p style={{ color: 'var(--tgd-muted-text)' }}>Loading detail...</p> : null}
          {!loadingDetail && !detail ? <p style={{ color: 'var(--tgd-muted-text)' }}>Select a document to view detail.</p> : null}
          
          {!loadingDetail && detail ? (
            <div>
              <div style={{ background: 'var(--tgd-main-bg)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--tgd-muted-text)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Document No</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tgd-main-text)' }}>{detail.document?.document_no || '-'}</div>
                  </div>
                  <StatusBadge value={detail.document?.status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>Customer</div>
                    <div style={{ fontWeight: 500 }}>{detail.document?.customer_id || '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>Ship Date</div>
                    <div style={{ fontWeight: 500 }}><span className="table-meta-text">{formatDocumentDate(detail.document?.requested_ship_date, { dateOnly: true })}</span></div>
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '0 0 12px 0', color: 'var(--tgd-main-text)' }}>Lines</h4>
              <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--tgd-border)' }}>
                      <th style={{ padding: '8px 4px', textAlign: 'left', color: 'var(--tgd-muted-text)' }}>Product</th>
                      <th style={{ padding: '8px 4px', textAlign: 'left', color: 'var(--tgd-muted-text)' }}>Lot</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--tgd-muted-text)' }}>Req Qty</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--tgd-muted-text)' }}>Pick Qty</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--tgd-muted-text)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.length === 0 ? <EmptyRow colSpan={5} label="No lines found." /> : null}
                    {detail.lines.map((line) => (
                      <tr key={line.id} style={{ borderBottom: '1px solid var(--tgd-border)' }}>
                        <td style={{ padding: '8px 4px' }}>{line.product_id}</td>
                        <td style={{ padding: '8px 4px' }}>{line.lot_id || '-'}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>{line.requested_quantity}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--tgd-info)' }}>{line.picked_quantity}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}><StatusBadge value={line.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 style={{ margin: '0 0 12px 0', color: 'var(--tgd-main-text)' }}>Reservations</h4>
              <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--tgd-border)' }}>
                      <th style={{ padding: '8px 4px', textAlign: 'left', color: 'var(--tgd-muted-text)' }}>Rsv ID</th>
                      <th style={{ padding: '8px 4px', textAlign: 'left', color: 'var(--tgd-muted-text)' }}>Location</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--tgd-muted-text)' }}>Rsv Qty</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--tgd-muted-text)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.reservations.length === 0 ? <EmptyRow colSpan={4} label="No reservations found." /> : null}
                    {detail.reservations.map((reservation) => (
                      <tr key={reservation.id} style={{ borderBottom: '1px solid var(--tgd-border)' }}>
                        <td style={{ padding: '8px 4px' }}>{reservation.id}</td>
                        <td style={{ padding: '8px 4px' }}>{reservation.location_id}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--tgd-warning)' }}>{reservation.reserved_quantity}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}><StatusBadge value={reservation.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                 <button className="btn-primary-gold" style={{ flex: 1 }}>Confirm Reserve</button>
                 <button className="btn-primary-gold" style={{ flex: 1, background: 'var(--tgd-success)', color: '#fff' }}>Confirm Pick</button>
              </div>

            </div>
          ) : null}
        </section>
      </div>

      {/* Production Safety Panel */}
      <section className="safety-panel" style={{ marginTop: 24 }}>
        <h3 style={{ color: 'var(--tgd-danger)', marginTop: 0 }}>Production remains HOLD</h3>
        <p>Post Outbound feature gate remains OFF by default.</p>
        <p>{safetyNote}</p>
        <div className="safety-actions">
          <div className="safety-action-box">
            <strong>FINAL GO: Apply Outbound migrations 025-030 to Production</strong>
          </div>
          <div className="safety-action-box">
            <strong>APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1</strong>
          </div>
        </div>
      </section>

    </section>
  );
}
