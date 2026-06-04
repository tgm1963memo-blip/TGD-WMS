import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import {
  getOutboundDocumentDetail,
  listOutboundDocuments,
} from '../../../services/outboundPickingService.js';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #d9e2ec',
  borderRadius: 8,
  marginBottom: 18,
  padding: 16,
};

const buttonStyle = {
  background: '#0f766e',
  border: 0,
  borderRadius: 8,
  color: '#ffffff',
  cursor: 'pointer',
  minHeight: 38,
  padding: '8px 14px',
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  color: '#0f172a',
};

const tableStyle = {
  borderCollapse: 'collapse',
  width: '100%',
};

const cellStyle = {
  borderBottom: '1px solid #e2e8f0',
  padding: '10px 8px',
  textAlign: 'left',
  verticalAlign: 'top',
};

const safetyNote = 'Read-only outbound list/detail. No post outbound. No stock movement OUT. No stock balance update.';

function StatusPill({ value }) {
  return (
    <span style={{
      background: '#ecfeff',
      border: '1px solid #a5f3fc',
      borderRadius: 999,
      color: '#155e75',
      display: 'inline-block',
      fontSize: 12,
      fontWeight: 700,
      padding: '3px 8px',
    }}>
      {value || '-'}
    </span>
  );
}

function EmptyRow({ colSpan, label }) {
  return (
    <tr>
      <td style={cellStyle} colSpan={colSpan}>{label}</td>
    </tr>
  );
}

export function OutboundListPage() {
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
    <section className="page-shell">
      <PageHeader title="Outbound Documents" description="Read-only outbound document list and reservation detail." />

      <section role="status" style={{ ...cardStyle, borderColor: '#fde68a', color: '#92400e' }}>
        {safetyNote}
      </section>

      {error ? (
        <section role="alert" style={{ ...cardStyle, borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </section>
      ) : null}

      <section style={cardStyle}>
        <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Outbound document list</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Link to="/operations/outbound-draft" style={{ ...secondaryButtonStyle, alignItems: 'center', display: 'inline-flex', textDecoration: 'none' }}>
              Open Draft Smoke UI
            </Link>
            <button type="button" style={secondaryButtonStyle} onClick={loadDocuments}>Refresh</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={cellStyle}>Document No</th>
                <th style={cellStyle}>Status</th>
                <th style={cellStyle}>Customer ID</th>
                <th style={cellStyle}>Requested Ship Date</th>
                <th style={cellStyle}>Created At</th>
                <th style={cellStyle}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? <EmptyRow colSpan={6} label="Loading outbound documents..." /> : null}
              {!loadingList && documents.length === 0 ? <EmptyRow colSpan={6} label="No outbound documents found or you may not have read permission." /> : null}
              {!loadingList && documents.map((document) => (
                <tr key={document.id}>
                  <td style={cellStyle}>{document.document_no}</td>
                  <td style={cellStyle}><StatusPill value={document.status} /></td>
                  <td style={cellStyle}>{document.customer_id || '-'}</td>
                  <td style={cellStyle}>{document.requested_ship_date || '-'}</td>
                  <td style={cellStyle}>{document.created_at || '-'}</td>
                  <td style={cellStyle}>
                    <button type="button" style={buttonStyle} onClick={() => setSelectedDocumentId(document.id)}>
                      View Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Outbound detail</h3>
        {loadingDetail ? <p>Loading outbound detail...</p> : null}
        {!loadingDetail && !detail ? <p>Select an outbound document to view detail.</p> : null}
        {!loadingDetail && detail ? (
          <div>
            <dl style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div><dt>Document No</dt><dd>{detail.document?.document_no || '-'}</dd></div>
              <div><dt>Status</dt><dd><StatusPill value={detail.document?.status} /></dd></div>
              <div><dt>Customer ID</dt><dd>{detail.document?.customer_id || '-'}</dd></div>
              <div><dt>Requested Ship Date</dt><dd>{detail.document?.requested_ship_date || '-'}</dd></div>
              <div><dt>Created At</dt><dd>{detail.document?.created_at || '-'}</dd></div>
            </dl>

            <h4>Lines</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={cellStyle}>Line ID</th>
                    <th style={cellStyle}>Product ID</th>
                    <th style={cellStyle}>Lot ID</th>
                    <th style={cellStyle}>Requested Qty</th>
                    <th style={cellStyle}>Requested Weight</th>
                    <th style={cellStyle}>Picked Qty</th>
                    <th style={cellStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.length === 0 ? <EmptyRow colSpan={7} label="No outbound lines found." /> : null}
                  {detail.lines.map((line) => (
                    <tr key={line.id}>
                      <td style={cellStyle}>{line.id}</td>
                      <td style={cellStyle}>{line.product_id}</td>
                      <td style={cellStyle}>{line.lot_id || '-'}</td>
                      <td style={cellStyle}>{line.requested_quantity}</td>
                      <td style={cellStyle}>{line.requested_weight}</td>
                      <td style={cellStyle}>{line.picked_quantity}</td>
                      <td style={cellStyle}><StatusPill value={line.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4>Reservations</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={cellStyle}>Reservation ID</th>
                    <th style={cellStyle}>Line ID</th>
                    <th style={cellStyle}>Location ID</th>
                    <th style={cellStyle}>Reserved Qty</th>
                    <th style={cellStyle}>Reserved Weight</th>
                    <th style={cellStyle}>Status</th>
                    <th style={cellStyle}>Released At</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.reservations.length === 0 ? <EmptyRow colSpan={7} label="No outbound reservations found." /> : null}
                  {detail.reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td style={cellStyle}>{reservation.id}</td>
                      <td style={cellStyle}>{reservation.outbound_line_id}</td>
                      <td style={cellStyle}>{reservation.location_id}</td>
                      <td style={cellStyle}>{reservation.reserved_quantity}</td>
                      <td style={cellStyle}>{reservation.reserved_weight}</td>
                      <td style={cellStyle}><StatusPill value={reservation.status} /></td>
                      <td style={cellStyle}>{reservation.released_at || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
