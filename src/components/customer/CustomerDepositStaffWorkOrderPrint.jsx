import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';

function fmt(v) { return v != null && v !== '' ? v : '-'; }
function fmtNum(v) { return v != null && v !== '' ? Number(v).toLocaleString() : '-'; }

export function CustomerDepositStaffWorkOrderPrint({
  header,
  lines = [],
  language = 'th',
  branding,
}) {
  if (!header) return null;

  const t = (key) => getTranslation(key, language);

  const totalDeclaredBoxes = lines.reduce((s, l) => s + (Number(l.expected_boxes) || 0), 0);
  const totalDeclaredWeight = lines.reduce((s, l) => s + (Number(l.expected_weight) || 0), 0);
  const totalActualBoxes = lines.reduce((s, l) => s + (Number(l.actual_boxes) || 0), 0);
  const totalActualWeight = lines.reduce((s, l) => s + (Number(l.actual_weight) || 0), 0);

  const hasActual = lines.some((l) => l.actual_boxes != null || l.actual_weight != null);

  return (
    <article className="operational-report-print-document customer-staff-work-order-print" data-testid="customer-deposit-staff-work-order-print">
      <DocumentHeader
        branding={branding}
        documentDate={header.expected_arrival_date ?? '-'}
        documentNo={header.request_no}
        documentTitle={t('customer_deposit_staff_work_order_title')}
        language={language}
      />

      {/* Operational header grid matching RECEIVING INFORMATION format */}
      <table className="receiving-info-meta-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
        <tbody>
          <tr>
            <td style={{ width: '15%', fontWeight: 600 }}>CUSTOMER NAME</td>
            <td style={{ width: '35%', borderBottom: '1px solid #000' }}>{fmt(header.customer_name)}</td>
            <td style={{ width: '15%', fontWeight: 600 }}>ATTN</td>
            <td style={{ width: '35%', borderBottom: '1px solid #000' }}>{fmt(header.contact_name)}</td>
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
            <td style={{ fontWeight: 600 }}>RECEIVE DATE</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.expected_arrival_date)}</td>
            <td style={{ fontWeight: 600 }}>ARRIVAL TIME / START / FINISH</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.arrival_time)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>GOODS TEMP</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.goods_temp)}</td>
            <td style={{ fontWeight: 600 }}>TRUCK/CON.TEMP</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.truck_temp)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>TRUCK & CONTAINER NO</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.vehicle_registration)}</td>
            <td style={{ fontWeight: 600 }}>SEAL NO</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.seal_no)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>RECEIVE FROM</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.receive_from)}</td>
            <td style={{ fontWeight: 600 }}>REMARK</td>
            <td style={{ borderBottom: '1px solid #000' }}>{fmt(header.note)}</td>
          </tr>
        </tbody>
      </table>

      {/* Lines table */}
      <table className="data-table operational-report-table" style={{ fontSize: 11, width: '100%' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ textAlign: 'center' }}>#</th>
            <th rowSpan={2}>LOT NO</th>
            <th rowSpan={2}>CUSTOMER PRODUCT</th>
            <th rowSpan={2}>CODE</th>
            <th colSpan={2} style={{ textAlign: 'center', background: '#f0f0f0' }}>จำนวนที่ลูกค้าแจ้ง</th>
            {hasActual && <th colSpan={2} style={{ textAlign: 'center', background: '#e8f5e9' }}>จำนวนที่รับจริง</th>}
            <th rowSpan={2}>วันผลิต</th>
            <th rowSpan={2}>วันหมดอายุ</th>
            <th rowSpan={2}>ARGENT</th>
            <th rowSpan={2}>REMARK</th>
          </tr>
          <tr>
            <th style={{ textAlign: 'center', background: '#f0f0f0' }}>BOX</th>
            <th style={{ textAlign: 'center', background: '#f0f0f0' }}>KG</th>
            {hasActual && <th style={{ textAlign: 'center', background: '#e8f5e9' }}>BOX</th>}
            {hasActual && <th style={{ textAlign: 'center', background: '#e8f5e9' }}>KG</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const isModified = hasActual && (
              (line.actual_boxes != null && line.actual_boxes !== line.expected_boxes) ||
              (line.actual_weight != null && String(line.actual_weight) !== String(line.expected_weight))
            );
            return (
              <tr key={line.id ?? line.line_no} style={isModified ? { background: '#fff9e6' } : {}}>
                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                <td>{fmt(line.lot_no)}</td>
                <td>{fmt(line.product_name)}</td>
                <td>{fmt(line.customer_product_code ?? line.internal_product_code)}</td>
                <td style={{ textAlign: 'right' }}>{fmtNum(line.expected_boxes)}</td>
                <td style={{ textAlign: 'right' }}>{fmtNum(line.expected_weight)}</td>
                {hasActual && (
                  <td style={{ textAlign: 'right', fontWeight: isModified ? 700 : 400, color: isModified ? '#b45309' : 'inherit' }}>
                    {line.actual_boxes != null ? fmtNum(line.actual_boxes) : '-'}
                  </td>
                )}
                {hasActual && (
                  <td style={{ textAlign: 'right', fontWeight: isModified ? 700 : 400, color: isModified ? '#b45309' : 'inherit' }}>
                    {line.actual_weight != null ? fmtNum(line.actual_weight) : '-'}
                  </td>
                )}
                <td>{fmt(line.mfg_date)}</td>
                <td>{fmt(line.exp_date)}</td>
                <td>{fmt(line.argent_type)}</td>
                <td>{fmt(line.actual_note ?? line.note)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <td colSpan={4} style={{ textAlign: 'right' }}>TOTAL</td>
            <td style={{ textAlign: 'right' }}>{fmtNum(totalDeclaredBoxes || null)}</td>
            <td style={{ textAlign: 'right' }}>{fmtNum(totalDeclaredWeight || null)}</td>
            {hasActual && <td style={{ textAlign: 'right' }}>{fmtNum(totalActualBoxes || null)}</td>}
            {hasActual && <td style={{ textAlign: 'right' }}>{fmtNum(totalActualWeight || null)}</td>}
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>

      {/* Modified items note */}
      {hasActual && lines.some((l) => (l.actual_boxes != null && l.actual_boxes !== l.expected_boxes) || (l.actual_weight != null && String(l.actual_weight) !== String(l.expected_weight))) && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: '#fff9e6', border: '1px solid #f59e0b', borderRadius: 4, fontSize: 11 }}>
          <strong>รายการที่แก้ไข (จำนวนจริงไม่ตรงกับที่แจ้ง):</strong>{' '}
          {lines.filter((l) =>
            (l.actual_boxes != null && l.actual_boxes !== l.expected_boxes) ||
            (l.actual_weight != null && String(l.actual_weight) !== String(l.expected_weight))
          ).map((l) => `${l.product_name ?? l.customer_product_code} (LOT ${l.lot_no ?? '-'})`).join(', ')}
        </div>
      )}

      <p className="form-helper" style={{ marginTop: 8, fontSize: 11 }}>
        {t('customer_deposit_argent_sticker_hint')}
      </p>

      {/* Signature section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 32, fontSize: 12 }}>
        <div>
          <div style={{ borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>ISSUED / CHECKED BY</div>
          <div style={{ textAlign: 'center', color: '#666', fontSize: 11 }}>
            {header.issued_by ?? '(CUSTOMER SERVICE)'}
          </div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>APPROVED BY</div>
          <div style={{ textAlign: 'center', color: '#666', fontSize: 11 }}>(SUPV / ASST.MGR / MGR)</div>
        </div>
      </div>
    </article>
  );
}
