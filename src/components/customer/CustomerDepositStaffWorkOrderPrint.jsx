import QRCode from 'react-qr-code';
import { getDefaultDocumentBranding, normalizeDocumentBrandingConfig } from '../../config/documentBrandingConfig.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { getTemperatureTypeShortLabel } from '../../utils/temperatureTypeLabels.js';
import { insertSoftBreaks } from '../../utils/textWrapUtils.js';
import { CancelledDocumentWatermark } from './CancelledDocumentWatermark.jsx';

function fmt(v) { return v != null && v !== '' ? v : '-'; }
function fmtWrap(v, chunkSize = 6) {
  const s = fmt(v);
  return s === '-' ? s : insertSoftBreaks(s, chunkSize);
}
function fmtNum(v) { return v != null && v !== '' ? Number(v).toLocaleString() : '-'; }
function fmtDate(v) {
  if (!v) return '-';
  const s = String(v).split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return v;
}
function fmtDT(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

const META_KEY = { fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', paddingBottom: 2 };
// whiteSpace:normal + overflow-wrap/word-break so a long, unbroken value
// (company name, address) wraps within its fixed-width cell instead of
// overflowing into the next column — the exact same bug class already
// fixed on the lines table below, just missed here originally since this
// meta table's fields are usually short (dates, phone numbers).
const META_VAL = { borderBottom: '1px solid #000', fontSize: 11, paddingBottom: 2, whiteSpace: 'normal', overflowWrap: 'break-word', wordBreak: 'break-word' };

export function CustomerDepositStaffWorkOrderPrint(props) {
  if (!props.header) return null;
  return (
    <>
      <CustomerDepositStaffWorkOrderPrintPage {...props} copyType="customer" />
      <div style={{ pageBreakBefore: 'always', height: 0 }} />
      <CustomerDepositStaffWorkOrderPrintPage {...props} copyType="staff" />
    </>
  );
}

function CustomerDepositStaffWorkOrderPrintPage({
  header,
  lines = [],
  language = 'th',
  branding,
  copyType,
}) {
  if (!header) return null;

  const t = (key) => getTranslation(key, language);

  const totalDeclaredBoxes = lines.reduce((s, l) => s + (Number(l.expected_boxes) || 0), 0);
  const totalDeclaredWeight = lines.reduce((s, l) => s + (Number(l.expected_weight) || 0), 0);
  const totalActualBoxes = lines.reduce((s, l) => s + (Number(l.actual_boxes) || 0), 0);
  const totalActualWeight = lines.reduce((s, l) => s + (Number(l.actual_weight) || 0), 0);

  const hasActual = lines.some((l) => l.actual_boxes != null || l.actual_weight != null);
  const hasLocation = lines.some((l) => l.location?.location_code);

  return (
    <article
      className="operational-report-print-document customer-staff-work-order-print"
      data-testid="customer-deposit-staff-work-order-print"
      style={{ padding: 0, minHeight: '178mm', position: 'relative' }}
    >
      <CancelledDocumentWatermark status={header.status} />
      {/* ── Compact page header ── */}
      {(() => {
        const norm = normalizeDocumentBrandingConfig(branding ?? getDefaultDocumentBranding());
        const companyName = norm[`company_name_${language}`] || norm.company_name_th || norm.company_name_en || '';
        return (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '3mm 0 3mm', borderBottom: '2px solid #000', marginBottom: 8, gap: 12,
          }}>
            {/* Left: logo + company name + tax id */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              {norm.logo_url && (
                <img src={norm.logo_url} alt="logo" style={{ height: 36, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontWeight: 800, fontSize: 12 }}>{companyName}</div>
                {norm.tax_id && (
                  <div style={{ fontSize: 10, color: '#555' }}>เลขประจำตัวผู้เสียภาษี: {norm.tax_id}</div>
                )}
              </div>
            </div>
            {/* Right: document title + no + date + scan QR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>
                  {t('customer_deposit_staff_work_order_title')}
                  <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
                    {copyType === 'customer' ? '(สำหรับลูกค้า)' : '(สำหรับพนักงาน)'}
                  </span>
                  {header.status === 'CANCELLED' && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginLeft: 8 }}>
                      [ยกเลิกแล้ว]
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#333' }}>
                  {getTranslation('document_no', language) || 'เลขที่'}: <strong>{header.request_no}</strong>
                  {header.expected_arrival_date && (
                    <span style={{ marginLeft: 10 }}>
                      {getTranslation('document_date', language) || 'วันที่'}: {fmtDate(header.expected_arrival_date)}
                    </span>
                  )}
                </div>
              </div>
              {header.request_no && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <QRCode value={header.request_no} size={54} style={{ width: 54, height: 54 }} />
                  <div style={{ fontSize: 8, color: '#666', marginTop: 1 }}>สแกนเปิดใบงาน</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Meta table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 10, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '28%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={META_KEY}>CUSTOMER NAME</td>
            <td style={META_VAL}>{fmtWrap(header.customer_name, 10)}</td>
            <td style={META_KEY}>ATTN</td>
            <td style={META_VAL}>{fmtWrap(header.contact_name, 10)}</td>
          </tr>
          <tr>
            <td style={META_KEY}>ADDRESS</td>
            <td colSpan={3} style={META_VAL}>{fmtWrap(header.customer_address, 12)}</td>
          </tr>
          <tr>
            <td style={META_KEY}>TEL</td>
            <td style={META_VAL}>{fmt(header.contact_phone)}</td>
            <td style={META_KEY}>FAX</td>
            <td style={META_VAL}>{fmt(header.contact_fax)}</td>
          </tr>
          <tr>
            <td style={META_KEY}>RECEIVE DATE</td>
            <td style={META_VAL}>{fmtDate(header.expected_arrival_date)}</td>
            <td style={{ ...META_KEY, fontSize: 10 }}>ARR TIME / START / FINISH</td>
            <td style={META_VAL}>{fmt(header.arrival_time)}</td>
          </tr>
          <tr>
            <td style={META_KEY}>GOODS TEMP</td>
            <td style={META_VAL}>{fmt(header.goods_temp)}</td>
            <td style={META_KEY}>TRUCK / CON. TEMP</td>
            <td style={META_VAL}>{fmt(header.truck_temp)}</td>
          </tr>
          <tr>
            <td style={META_KEY}>TRUCK & CONTAINER NO</td>
            <td style={META_VAL}>{fmt(header.vehicle_registration)}</td>
            <td style={META_KEY}>SEAL NO</td>
            <td style={META_VAL}>{fmt(header.seal_no)}</td>
          </tr>
          <tr>
            <td style={META_KEY}>RECEIVE FROM</td>
            <td style={META_VAL}>{fmt(header.receive_from)}</td>
            <td style={META_KEY}>REMARK</td>
            <td style={{ ...META_VAL, whiteSpace: 'normal', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{fmt(header.note)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Lines table ── */}
      <table className="operational-report-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 10 }}>
        <colgroup>
          <col style={{ width: '3%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: hasActual ? '15%' : '14%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '7%' }} />
          {hasLocation && <col style={{ width: '7%' }} />}
          <col style={{ width: '6%' }} />
          <col style={{ width: '7%' }} />
          {hasActual && <col style={{ width: '6%' }} />}
          {hasActual && <col style={{ width: '7%' }} />}
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: hasActual ? '0%' : '14%' }} />
        </colgroup>
        <thead>
          {/* Slim identifier row — repeats on every printed page (thead
              behavior), so a continuation page shows which document this is
              without re-printing the full customer/address/temp block above. */}
          <tr>
            <td colSpan={(hasActual ? 13 : 12) + (hasLocation ? 1 : 0)} className="operational-report-running-header">
              เลขที่เอกสาร {header.request_no} &nbsp;•&nbsp; ลูกค้า {fmt(header.customer_name)}
            </td>
          </tr>
          <tr>
            <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>#</th>
            <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 }}>รหัสติดตาม</th>
            <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 }}>LOT NO</th>
            <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 }}>CUSTOMER PRODUCT</th>
            <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 }}>CODE</th>
            <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 }}>การจัดเก็บ</th>
            {hasLocation && <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 }}>LOCATION</th>}
            <th colSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>จำนวนที่ลูกค้าแจ้ง</th>
            {hasActual && <th colSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#e8f5e9', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>จำนวนที่รับจริง</th>}
            <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 }}>วันผลิต</th>
            <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 }}>วันหมดอายุ</th>
            <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>ARGENT</th>
            {!hasActual && <th rowSpan={2} style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700 }}>REMARK</th>}
          </tr>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>BOX</th>
            <th style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>KG</th>
            {hasActual && <th style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#e8f5e9', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>BOX</th>}
            {hasActual && <th style={{ border: '1px solid #ccc', padding: '4px 6px', background: '#e8f5e9', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>KG</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const isModified = hasActual && (
              (line.actual_boxes != null && line.actual_boxes !== line.expected_boxes) ||
              (line.actual_weight != null && String(line.actual_weight) !== String(line.expected_weight))
            );
            const TD = { border: '1px solid #ccc', padding: '4px 6px', fontSize: 10 };
            // Reference numbers (LOT, tracking code, product code) and product
            // names must stay fully readable — wrap onto a second line rather
            // than clip with an ellipsis. Thai text commonly has no spaces
            // between words, so without overflow-wrap/word-break a long
            // product name has no break point at all: it doesn't wrap, it
            // just overflows the fixed-width cell horizontally and paints
            // over whatever is in the next column, reading as garbled
            // overlapping text on the printed page.
            const TD_WRAP = { ...TD, overflowWrap: 'break-word', wordBreak: 'break-word' };
            return (
              <tr key={line.id ?? line.line_no} style={isModified ? { background: '#fff9e6' } : {}}>
                <td style={{ ...TD_WRAP, textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ ...TD_WRAP, fontWeight: 700 }} title={fmt(line.tracking_code)}>{fmtWrap(line.tracking_code)}</td>
                <td style={TD_WRAP} title={fmt(line.lot_no)}>{fmtWrap(line.lot_no)}</td>
                <td style={TD_WRAP}>{fmtWrap(line.product_name, 10)}</td>
                <td style={TD_WRAP} title={fmt(line.customer_product_code ?? line.internal_product_code)}>{fmtWrap(line.customer_product_code ?? line.internal_product_code)}</td>
                <td style={TD_WRAP}>{getTemperatureTypeShortLabel(line.temperature_type)}</td>
                {hasLocation && <td style={{ ...TD_WRAP, fontFamily: 'monospace' }}>{fmt(line.location?.location_code)}</td>}
                <td style={{ ...TD_WRAP, textAlign: 'right' }}>{fmtNum(line.expected_boxes)}</td>
                <td style={{ ...TD_WRAP, textAlign: 'right' }}>{fmtNum(line.expected_weight)}</td>
                {hasActual && (
                  <td style={{ ...TD_WRAP, textAlign: 'right', fontWeight: isModified ? 700 : 400, color: isModified ? '#b45309' : 'inherit' }}>
                    {line.actual_boxes != null ? fmtNum(line.actual_boxes) : '-'}
                  </td>
                )}
                {hasActual && (
                  <td style={{ ...TD_WRAP, textAlign: 'right', fontWeight: isModified ? 700 : 400, color: isModified ? '#b45309' : 'inherit' }}>
                    {line.actual_weight != null ? fmtNum(line.actual_weight) : '-'}
                  </td>
                )}
                <td style={TD_WRAP}>{fmtDate(line.mfg_date)}</td>
                <td style={TD_WRAP}>{fmtDate(line.exp_date)}</td>
                <td style={{ ...TD_WRAP, textAlign: 'center' }}>{fmt(line.argent_type)}</td>
                {!hasActual && <td style={{ ...TD, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{fmt(line.actual_note ?? line.note)}</td>}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <td colSpan={hasLocation ? 7 : 6} style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 10, textAlign: 'right' }}>TOTAL</td>
            <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtNum(totalDeclaredBoxes || null)}</td>
            <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtNum(totalDeclaredWeight || null)}</td>
            {hasActual && <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtNum(totalActualBoxes || null)}</td>}
            {hasActual && <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtNum(totalActualWeight || null)}</td>}
            <td colSpan={hasActual ? 3 : 4} />
          </tr>
        </tfoot>
      </table>

      {/* Modified items note — single line */}
      {hasActual && lines.some((l) => (l.actual_boxes != null && l.actual_boxes !== l.expected_boxes) || (l.actual_weight != null && String(l.actual_weight) !== String(l.expected_weight))) && (
        <div style={{ marginTop: 8, padding: '5px 10px', background: '#fff9e6', border: '1px solid #f59e0b', borderRadius: 4, fontSize: 11, display: 'flex', gap: 6, overflow: 'hidden' }}>
          <strong style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>รายการที่แก้ไข (จำนวนจริงไม่ตรงกับที่แจ้ง):</strong>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lines.filter((l) =>
              (l.actual_boxes != null && l.actual_boxes !== l.expected_boxes) ||
              (l.actual_weight != null && String(l.actual_weight) !== String(l.expected_weight))
            ).map((l) => `${l.product_name ?? l.customer_product_code} (LOT ${l.lot_no ?? '-'})`).join(', ')}
          </span>
        </div>
      )}

      <p className="form-helper" style={{ marginTop: 8, fontSize: 11 }}>
        {t('customer_deposit_argent_sticker_hint')}
      </p>
      <p className="form-helper" style={{ marginTop: 2, fontSize: 11 }}>
        เขียน &quot;รหัสติดตาม&quot; ของแต่ละ LOT ลงบนสติกเกอร์ที่ติดหน้าสินค้า เพื่อใช้อ้างอิงและตรวจสอบ
      </p>

      {/* ── Signature section ──
          No flex spacer here: CSS page-break/fragmentation properties are
          unreliable inside flex containers across browsers, which would
          undermine the pageBreakInside:'avoid' below for longer documents
          that span multiple pages. Natural document flow keeps pagination
          reliable; the signature just follows the content instead of being
          pinned to the exact bottom of a short page. */}
      {(() => {
        // 1. Issue/checked by = TGC staff who opened the work order (ACCEPT action)
        const issuedBy = header.reviewed_by_email ?? null;
        const issuedAt = header.reviewed_at ? fmtDT(header.reviewed_at) : null;

        // 2. Received by = handheld staff who received goods
        const receivedBy = header.handheld_received_by_email ?? null;
        const receivedAt = (receivedBy && header.last_action_at && !header.web_approved_by_email)
          ? fmtDT(header.last_action_at)
          : null;

        // 3. Approved by = staff who confirmed to customer (CONFIRM_RECEIPT)
        const approvedBy = header.web_approved_by_email ?? null;
        const approvedAt = (approvedBy && header.last_action_at) ? fmtDT(header.last_action_at) : null;

        const SigBox = ({ label, sublabel, name, dt }) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 28 }} />
            <div style={{ borderTop: '1px solid #000', paddingTop: 4, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 11 }}>{label}</div>
              {sublabel && <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>{sublabel}</div>}
            </div>
            <div style={{ textAlign: 'center', color: '#333', fontSize: 11, marginTop: 4, minHeight: 16 }}>
              {name ?? <span style={{ color: '#bbb' }}>____________________</span>}
            </div>
            <div style={{ textAlign: 'center', color: '#888', fontSize: 10, minHeight: 14 }}>{dt ?? ''}</div>
          </div>
        );
        return (
          <div style={{ borderTop: '2px solid #ccc', paddingTop: 10, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, marginBottom: 4 }}>
              <SigBox
                label="Issue / Checked by"
                sublabel="พนักงาน TGC ผู้เปิดใบงาน"
                name={issuedBy}
                dt={issuedAt}
              />
              <SigBox
                label="Received by"
                sublabel="พนักงานที่รับสินค้า (Handheld)"
                name={receivedBy}
                dt={receivedAt}
              />
              <SigBox
                label="Approved by"
                sublabel="พนักงานที่ยืนยันส่งลูกค้า"
                name={approvedBy}
                dt={approvedAt}
              />
            </div>
          </div>
        );
      })()}
    </article>
  );
}
