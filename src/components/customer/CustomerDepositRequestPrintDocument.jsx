import { getDefaultDocumentBranding, normalizeDocumentBrandingConfig } from '../../config/documentBrandingConfig.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { getTemperatureTypeShortLabel } from '../../utils/temperatureTypeLabels.js';
import { CancelledDocumentWatermark } from './CancelledDocumentWatermark.jsx';
import { insertSoftBreaks } from '../../utils/textWrapUtils.js';

function fmt(v) { return v != null && v !== '' ? v : '-'; }
// overflow-wrap/word-break alone don't guarantee a break point in long,
// unbroken Thai text (no spaces between words) — inserting a real
// zero-width-space every few graphemes gives the browser a break
// opportunity regardless of the print rendering pipeline's word-break support.
function fmtWrap(v, chunkSize = 8) {
  const s = fmt(v);
  return s === '-' ? s : insertSoftBreaks(s, chunkSize);
}
function fmtDate(v) {
  if (!v) return '-';
  const s = String(v).split('T')[0];
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v;
}
function fmtDT(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

const TH = { border: '1px solid #bbb', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' };
const TD = { border: '1px solid #bbb', padding: '4px 6px', fontSize: 10 };
// Reference numbers must stay fully readable, so wrap onto a second line
// instead of clipping — an ellipsis would hide digits needed for reference.
const TD_SAFE = { ...TD, overflowWrap: 'break-word', wordBreak: 'break-word' };
const MK = { fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', paddingRight: 4, paddingBottom: 2 };
const MV = { borderBottom: '1px solid #000', fontSize: 11, paddingBottom: 2, overflowWrap: 'break-word', wordBreak: 'break-word' };

export function CustomerDepositRequestPrintDocument({
  header,
  lines = [],
  language = 'th',
  branding,
}) {
  if (!header) return null;

  const t = (key) => getTranslation(key, language);

  const norm = normalizeDocumentBrandingConfig(branding ?? getDefaultDocumentBranding());
  const companyName = norm[`company_name_${language}`] || norm.company_name_th || norm.company_name_en || '';

  const customer = header.customer ?? {};
  const customerName = header.customer_name ?? customer.customer_name ?? customer.name ?? '-';
  const customerAddress = header.customer_address ?? customer.address ?? '-';
  const customerPhone = header.contact_phone ?? customer.phone ?? '-';
  const customerFax = header.contact_fax ?? customer.fax ?? '-';

  const hasActual = lines.some((l) => l.actual_boxes != null || l.actual_weight != null);
  const hasLot    = lines.some((l) => l.lot_no || l.mfg_date || l.exp_date);
  const hasLocation = lines.some((l) => l.location?.location_code);

  const colCount = 6 + (hasLot ? 3 : 0) + (hasActual ? 2 : 0) + (hasLocation ? 1 : 0) + 1;

  const totalDeclaredBoxes  = lines.reduce((s, l) => s + (Number(l.expected_boxes) || 0), 0);
  const totalDeclaredWeight = lines.reduce((s, l) => s + (Number(l.expected_weight) || 0), 0);
  const totalActualBoxes   = lines.reduce((s, l) => s + (Number(l.actual_boxes) || 0), 0);
  const totalActualWeight  = lines.reduce((s, l) => s + (Number(l.actual_weight) || 0), 0);

  // Signature data
  const issuedBy = header.reviewed_by_email ?? null;
  const issuedAt = fmtDT(header.reviewed_at);
  const receivedBy = header.handheld_received_by_email ?? null;
  const receivedAt = (receivedBy && header.last_action_at && !header.web_approved_by_email)
    ? fmtDT(header.last_action_at) : null;
  const approvedBy = header.web_approved_by_email ?? null;
  const approvedAt = approvedBy ? fmtDT(header.last_action_at) : null;

  const SigBox = ({ label, sublabel, name, dt }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ minHeight: 28 }} />
      <div style={{ borderTop: '1px solid #000', paddingTop: 3, fontWeight: 700, fontSize: 10 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 9, color: '#666', marginTop: 1 }}>{sublabel}</div>}
      <div style={{ color: '#333', fontSize: 10, marginTop: 3, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
        {name ?? <span style={{ color: '#bbb' }}>____________________</span>}
      </div>
      <div style={{ color: '#888', fontSize: 9 }}>{dt ?? ''}</div>
    </div>
  );

  return (
    <article
      className="operational-report-print-document customer-request-print-document"
      data-testid="customer-deposit-print-document"
      style={{ padding: 0, minHeight: '178mm', position: 'relative' }}
    >
      <CancelledDocumentWatermark status={header.status} />
      {/* ── Compact page header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3mm 0 3mm', borderBottom: '2px solid #000', marginBottom: 8, gap: 12,
      }}>
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
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            {t('customer_deposit_print_title')}
            {header.status === 'CANCELLED' && (
              <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginLeft: 8 }}>
                [ยกเลิกแล้ว]
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#333' }}>
            {getTranslation('document_no', language) || 'เลขที่'}: <strong>{header.request_no}</strong>
            {header.created_at && (
              <span style={{ marginLeft: 10 }}>
                {getTranslation('document_date', language) || 'วันที่'}: {fmtDate(header.created_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── RECEIVING INFORMATION meta table ── */}
      <div style={{ borderBottom: '2px solid #ccc', marginBottom: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 6, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '36%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td style={MK}>CUSTOMER NAME</td>
              <td style={MV}>{fmtWrap(customerName, 12)}</td>
              <td style={MK}>ATTN</td>
              <td style={MV}>{fmtWrap(header.contact_name, 12)}</td>
            </tr>
            <tr>
              <td style={MK}>ADDRESS</td>
              <td colSpan={3} style={{ ...MV, whiteSpace: 'normal' }}>{fmtWrap(customerAddress, 14)}</td>
            </tr>
            <tr>
              <td style={MK}>TEL</td>
              <td style={MV}>{fmt(customerPhone)}</td>
              <td style={MK}>FAX</td>
              <td style={MV}>{fmt(customerFax)}</td>
            </tr>
            <tr>
              <td style={MK}>RECEIVE DATE</td>
              <td style={MV}>{fmtDate(header.expected_arrival_date)}</td>
              <td style={{ ...MK, fontSize: 10 }}>OPERATION DATE</td>
              <td style={MV}>{fmtDate(header.created_at)}</td>
            </tr>
            <tr>
              <td style={MK}>ARR / START / FINISH</td>
              <td style={MV}>{fmt(header.arrival_time)}{header.start_time ? ` / ${header.start_time}` : ''}{header.finish_time ? ` / ${header.finish_time}` : ''}</td>
              <td style={MK}>SEAL NO</td>
              <td style={MV}>{fmt(header.seal_no)}</td>
            </tr>
            <tr>
              <td style={MK}>GOODS TEMP</td>
              <td style={MV}>{fmt(header.goods_temp)}</td>
              <td style={MK}>TRUCK / CON. TEMP</td>
              <td style={MV}>{fmt(header.truck_temp)}</td>
            </tr>
            <tr>
              <td style={{ ...MK, whiteSpace: 'normal' }}>TRUCK &amp; CONT. NO</td>
              <td style={MV}>{fmt(header.vehicle_registration)}</td>
              <td style={MK}>RECEIVE FROM</td>
              <td style={MV}>{fmtWrap(header.receive_from, 12)}</td>
            </tr>
            <tr>
              <td style={MK}>สถานะ</td>
              <td style={MV}>{getDepositStatusLabel(header.status, t) || fmt(header.status)}</td>
              <td style={MK}>REMARK</td>
              <td style={MV}>{fmtWrap(header.note, 12)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Lines table ── */}
      <table className="operational-report-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 10 }}>
        <thead>
          {/* Slim identifier row — repeats on every printed page (thead
              behavior), so a continuation page shows which document this is
              without re-printing the full customer/address/temp block above. */}
          <tr>
            <td colSpan={colCount} className="operational-report-running-header">
              เลขที่เอกสาร {header.request_no} &nbsp;•&nbsp; ลูกค้า {fmt(customerName)}
            </td>
          </tr>
          <tr>
            <th style={{ ...TH, width: '3%', textAlign: 'center' }}>#</th>
            <th style={{ ...TH, width: '9%' }}>{t('catalog_col_customer_code')}</th>
            <th style={{ ...TH, width: hasLot ? '13%' : '19%' }}>{t('catalog_col_product_name')}</th>
            <th style={{ ...TH, width: '7%', textAlign: 'right' }}>กก./หน่วย</th>
            <th style={{ ...TH, width: '7%', textAlign: 'right' }}>กก.ฝาก</th>
            <th style={{ ...TH, width: '6%', textAlign: 'center' }}>กล่อง</th>
            <th style={{ ...TH, width: '8%' }}>การจัดเก็บ</th>
            {hasLocation && <th style={{ ...TH, width: '8%' }}>LOCATION</th>}
            {hasLot && <th style={{ ...TH, width: '7%' }}>LOT</th>}
            {hasLot && <th style={{ ...TH, width: '10%', textAlign: 'center' }}>วันผลิต</th>}
            {hasLot && <th style={{ ...TH, width: '10%', textAlign: 'center' }}>วันหมดอายุ</th>}
            {hasActual && <th style={{ ...TH, width: '6%', textAlign: 'center' }}>รับจริง<br />(กล่อง)</th>}
            {hasActual && <th style={{ ...TH, width: '6%', textAlign: 'right' }}>รับจริง<br />(กก.)</th>}
            <th style={{ ...TH, width: hasActual ? '10%' : '14%' }}>{t('customer_col_line_note')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? lines.map((line) => (
            <tr key={line.id ?? `${line.line_no}-${line.customer_product_code}`}>
              <td style={{ ...TD_SAFE, textAlign: 'center' }}>{line.line_no}</td>
              <td style={TD_SAFE}>{fmtWrap(line.customer_product_code)}</td>
              <td style={TD_SAFE}>{fmtWrap(line.product_name, 10)}</td>
              <td style={{ ...TD_SAFE, textAlign: 'right' }}>{line.weight_per_box ?? '-'}</td>
              <td style={{ ...TD_SAFE, textAlign: 'right' }}>{line.expected_weight ?? '-'}</td>
              <td style={{ ...TD_SAFE, textAlign: 'center' }}>{line.expected_boxes ?? '-'}</td>
              <td style={TD_SAFE}>{getTemperatureTypeShortLabel(line.temperature_type)}</td>
              {hasLocation && <td style={{ ...TD_SAFE, fontFamily: 'monospace' }}>{fmtWrap(line.location?.location_code)}</td>}
              {hasLot && <td style={{ ...TD_SAFE, fontFamily: 'monospace' }}>{fmtWrap(line.lot_no)}</td>}
              {hasLot && <td style={{ ...TD_SAFE, textAlign: 'center' }}>{fmtDate(line.mfg_date)}</td>}
              {hasLot && <td style={{ ...TD_SAFE, textAlign: 'center' }}>{fmtDate(line.exp_date)}</td>}
              {hasActual && (
                <td style={{ ...TD_SAFE, textAlign: 'center', fontWeight: 700, color: line.actual_boxes != null ? '#16a34a' : undefined }}>
                  {line.actual_boxes ?? '-'}
                </td>
              )}
              {hasActual && (
                <td style={{ ...TD_SAFE, textAlign: 'right', fontWeight: 700, color: line.actual_weight != null ? '#16a34a' : undefined }}>
                  {line.actual_weight ?? '-'}
                </td>
              )}
              <td style={{ ...TD, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{fmtWrap(line.note ?? line.actual_note)}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={colCount} style={{ ...TD, textAlign: 'center', color: '#888' }}>
                {t('customer_request_detail_lines_empty')}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <td colSpan={4} style={{ ...TD, textAlign: 'right' }}>TOTAL</td>
            <td style={{ ...TD, textAlign: 'right' }}>{totalDeclaredWeight ? totalDeclaredWeight.toLocaleString() : '-'}</td>
            <td style={{ ...TD, textAlign: 'center' }}>{totalDeclaredBoxes ? totalDeclaredBoxes.toLocaleString() : '-'}</td>
            <td style={TD} />
            {hasLocation && <td style={TD} />}
            {hasLot && <td colSpan={3} style={TD} />}
            {hasActual && (
              <td style={{ ...TD, textAlign: 'center' }}>{totalActualBoxes ? totalActualBoxes.toLocaleString() : '-'}</td>
            )}
            {hasActual && (
              <td style={{ ...TD, textAlign: 'right' }}>{totalActualWeight ? totalActualWeight.toLocaleString() : '-'}</td>
            )}
            <td style={TD} />
          </tr>
        </tfoot>
      </table>

      {/* ── Signature section ──
          No flex spacer: CSS page-break/fragmentation properties are
          unreliable inside flex containers across browsers, which would
          undermine the pageBreakInside:'avoid' below for longer documents. */}
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
    </article>
  );
}
