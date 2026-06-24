import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';

function fmt(v) { return v != null && v !== '' ? v : '-'; }
function fmtNum(v, decimals = 3) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '-';
}

export function CustomerWithdrawalRequestPrintDocument({
  header,
  lines = [],
  language = 'th',
  branding,
}) {
  if (!header) return null;

  const t = (key) => getTranslation(key, language);

  const totalWeightKg = lines.reduce((s, l) => s + (Number(l.requested_weight) || 0), 0);
  const totalBoxes = lines.reduce((s, l) => s + (Number(l.requested_boxes) || 0), 0);

  const docDate = header.requested_dispatch_date
    ? header.requested_dispatch_date
    : header.created_at ? header.created_at.split('T')[0] : '-';

  return (
    <article className="operational-report-print-document customer-request-print-document" data-testid="customer-withdrawal-print-document">
      <DocumentHeader
        branding={branding}
        documentDate={docDate}
        documentNo={header.withdrawal_no ?? header.request_no}
        documentTitle={t('customer_withdrawal_print_title')}
        language={language}
      />

      {/* Customer / delivery metadata — DELIVERY SLIP format */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ width: '18%', fontWeight: 600 }}>CUSTOMER NAME</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.customer_name)}</td>
            <td style={{ width: '10%', fontWeight: 600 }}>DATE</td>
            <td style={{ width: '20%', borderBottom: '1px solid #000' }}>{fmt(docDate)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>ADDRESS</td>
            <td colSpan={3} style={{ borderBottom: '1px solid #000' }}>{fmt(header.customer_address)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>TEL</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.contact_phone)}</td>
            <td style={{ fontWeight: 600 }}>FAX</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.contact_fax)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>DELIVERY TO</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.delivery_to ?? header.delivery_type)}</td>
            <td style={{ fontWeight: 600 }}>NO</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.withdrawal_no ?? header.request_no)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>TRUCK TEMPERATURE</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.truck_temp)}</td>
            <td style={{ fontWeight: 600 }}>ROOM TEMPERATURE</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.room_temp)}</td>
          </tr>
          {header.note && (
            <tr>
              <td style={{ fontWeight: 600 }}>REMARK</td>
              <td colSpan={3} style={{ borderBottom: '1px solid #000' }}>{header.note}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Lines table — DELIVERY SLIP format */}
      <table className="data-table operational-report-table" style={{ fontSize: 11, width: '100%' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ textAlign: 'center' }}>#</th>
            <th rowSpan={2}>LOT NO<br />LOCATION</th>
            <th rowSpan={2}>CUSTOMER PRODUCT</th>
            <th rowSpan={2}>ITEM CODE</th>
            <th rowSpan={2} style={{ textAlign: 'right' }}>T.WEIGHT<br />KG.</th>
            <th colSpan={4} style={{ textAlign: 'center', background: '#f0f0f0' }}>BALANCE TOTAL</th>
            <th rowSpan={2}>REMARK</th>
          </tr>
          <tr>
            <th style={{ textAlign: 'center', background: '#f0f0f0' }}>Palet</th>
            <th style={{ textAlign: 'center', background: '#f0f0f0' }}>Box</th>
            <th style={{ textAlign: 'center', background: '#f0f0f0' }}>Pack</th>
            <th style={{ textAlign: 'center', background: '#f0f0f0' }}>Pcs</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? lines.map((line, idx) => (
            <tr key={line.id ?? `${line.line_no}-${line.customer_product_code}`}>
              <td style={{ textAlign: 'center' }}>{idx + 1}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{fmt(line.lot_no)}</div>
                {line.location && <div style={{ fontSize: 10, color: '#555' }}>{line.location}</div>}
              </td>
              <td>
                <div>{fmt(line.product_name)}</div>
                {line.batch_no && <div style={{ fontSize: 10, color: '#666' }}>Batch: {line.batch_no}</div>}
              </td>
              <td>{fmt(line.customer_product_code ?? line.product_code)}</td>
              <td style={{ textAlign: 'right' }}>{fmtNum(line.requested_weight)}</td>
              <td style={{ textAlign: 'center' }}>0</td>
              <td style={{ textAlign: 'center' }}>{line.requested_boxes ?? '-'}</td>
              <td style={{ textAlign: 'center' }}>0</td>
              <td style={{ textAlign: 'center' }}>0</td>
              <td>{fmt(line.note)}</td>
            </tr>
          )) : (
            <tr><td colSpan={10} style={{ textAlign: 'center', color: '#666' }}>ไม่มีรายการ</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <td colSpan={4} style={{ textAlign: 'right' }}>SUB TOTAL</td>
            <td style={{ textAlign: 'right' }}>{fmtNum(totalWeightKg)}</td>
            <td style={{ textAlign: 'center' }}>0</td>
            <td style={{ textAlign: 'center' }}>{totalBoxes || '-'}</td>
            <td style={{ textAlign: 'center' }}>0</td>
            <td style={{ textAlign: 'center' }}>0</td>
            <td />
          </tr>
          <tr style={{ fontWeight: 700, background: '#ebebeb' }}>
            <td colSpan={4} style={{ textAlign: 'right' }}>TOTAL</td>
            <td style={{ textAlign: 'right' }}>{fmtNum(totalWeightKg)}</td>
            <td style={{ textAlign: 'center' }}>0</td>
            <td style={{ textAlign: 'center' }}>{totalBoxes || '-'}</td>
            <td style={{ textAlign: 'center' }}>0</td>
            <td style={{ textAlign: 'center' }}>0</td>
            <td />
          </tr>
        </tfoot>
      </table>

      {/* Signature / operations section */}
      <div style={{ marginTop: 24, fontSize: 11 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>ISSUED BY</div>
            <div style={{ textAlign: 'center', color: '#666' }}>(CUSTOMER SERVICE)</div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>CHECKER</div>
            <div style={{ marginTop: 16, fontSize: 10 }}>DATE ___/___/___</div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>APPROVED BY</div>
            <div style={{ textAlign: 'center', color: '#666' }}>(SUPV / ASST.MGR / MGR)</div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>RECEIVED BY</div>
            <div style={{ marginTop: 16, fontSize: 10 }}>DATE ___/___/___</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center', borderTop: '1px solid #ccc', paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>TRUCK NO</strong>
            <span style={{ borderBottom: '1px solid #000', minWidth: 100, display: 'inline-block' }}>&nbsp;</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>☐ CLEAN</span>
            <span>☐ UNCLEAN</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>SEAL NO</strong>
            <span style={{ borderBottom: '1px solid #000', minWidth: 80, display: 'inline-block' }}>&nbsp;</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>START</strong>
            <span style={{ borderBottom: '1px solid #000', minWidth: 60, display: 'inline-block' }}>&nbsp;</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>FINISH</strong>
            <span style={{ borderBottom: '1px solid #000', minWidth: 60, display: 'inline-block' }}>&nbsp;</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong>FORKMAN BY</strong>
            <span style={{ borderBottom: '1px solid #000', minWidth: 80, display: 'inline-block' }}>&nbsp;</span>
          </div>
        </div>
      </div>
    </article>
  );
}
