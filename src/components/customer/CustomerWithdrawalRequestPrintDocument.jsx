import QRCode from 'react-qr-code';
import { getDefaultDocumentBranding, normalizeDocumentBrandingConfig } from '../../config/documentBrandingConfig.js';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { CancelledDocumentWatermark } from './CancelledDocumentWatermark.jsx';

function fmt(v) { return v != null && v !== '' ? v : '-'; }
function fmtNum(v, decimals = 3) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '-';
}
function fmtDT(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
function fmtDate(v) {
  if (!v) return '-';
  const s = String(v).split('T')[0];
  const parts = s.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s;
}

const NCOLS = 14;
const TH = { border: '1px solid #ccc', padding: '4px 2px', background: '#f0f0f0', fontSize: 9, fontWeight: 700, textAlign: 'center', overflowWrap: 'break-word', wordBreak: 'break-word' };
// verticalAlign: 'top' — table cells default to middle-aligned, so a short
// single-line cell (e.g. LOT NO) in the same row as a long wrapped cell
// (e.g. CUSTOMER PRODUCT spanning 2-3 lines) got vertically centered and
// visually collided with the taller neighboring cell's text. Top-aligning
// every cell keeps each row's first line flush with the row's top border.
const TD = { border: '1px solid #ccc', padding: '4px 2px', fontSize: 9, verticalAlign: 'top' };
// Reference numbers must stay fully readable, so wrap onto a second line
// instead of clipping — hidden overflow would silently drop characters.
const TD_SAFE = { ...TD, overflowWrap: 'break-word', wordBreak: 'break-all' };
const META_KEY = { fontWeight: 600, fontSize: 10, paddingBottom: 2, whiteSpace: 'nowrap' };
const META_VAL = { borderBottom: '1px solid #000', fontSize: 10, paddingBottom: 2, overflowWrap: 'break-word', wordBreak: 'break-word' };

export function CustomerWithdrawalRequestPrintDocument(props) {
  if (!props.header) return null;
  if (!props.isStaff) {
    return <CustomerWithdrawalRequestPrintDocumentPage {...props} />;
  }
  return (
    <>
      <CustomerWithdrawalRequestPrintDocumentPage {...props} copyType="customer" />
      <div style={{ pageBreakBefore: 'always', height: 0 }} />
      <CustomerWithdrawalRequestPrintDocumentPage {...props} copyType="staff" />
    </>
  );
}

function CustomerWithdrawalRequestPrintDocumentPage({
  header,
  lines = [],
  language = 'th',
  branding,
  hideCustomerName = false,
  isStaff = false,
  copyType,
}) {
  if (!header) return null;

  const t = (key) => getTranslation(key, language);

  const customerName = header.customer_name ?? header.customer?.customer_name ?? header.customer?.name ?? '-';
  const customerAddress = header.customer_address ?? header.customer?.address ?? '-';
  const contactPhone = header.contact_phone ?? header.customer?.phone ?? '-';
  const contactFax = header.contact_fax ?? header.customer?.fax ?? '-';

  const totalWeightKg = lines.reduce((s, l) => s + (Number(l.requested_weight) || 0), 0);
  const totalBoxes    = lines.reduce((s, l) => s + (Number(l.requested_boxes) || 0), 0);

  // lot_remaining_boxes/weight (from tgd_get_customer_stock_balance) only
  // reflects withdrawals whose request status is already 'COMPLETED' — so
  // for any withdrawal still in progress, this document's own line hasn't
  // been subtracted from that figure yet. Printed for staff who need to
  // know what will be left in the batch *after* fulfilling this document,
  // so net out this line's own claim (picked, if already picked, else the
  // requested amount) unless the RPC has already accounted for it.
  const isBalanceAlreadyNetted = header.status === 'COMPLETED';
  function remainingAfterThisWithdrawal(line) {
    if (isBalanceAlreadyNetted) {
      return { boxes: line.lot_remaining_boxes, weight: line.lot_remaining_weight };
    }
    if (line.lot_remaining_boxes == null && line.lot_remaining_weight == null) {
      return { boxes: null, weight: null };
    }
    const claimedBoxes = Number(line.picked_boxes ?? line.requested_boxes ?? 0);
    const claimedWeight = Number(line.picked_weight ?? line.requested_weight ?? 0);
    return {
      boxes: line.lot_remaining_boxes != null ? Math.max(0, line.lot_remaining_boxes - claimedBoxes) : null,
      weight: line.lot_remaining_weight != null ? Math.max(0, line.lot_remaining_weight - claimedWeight) : null,
    };
  }

  const docDate = header.requested_dispatch_date
    ? header.requested_dispatch_date
    : header.created_at ? header.created_at.split('T')[0] : '-';

  const sigs = [
    { label: 'ISSUED BY', name: header.created_by_email ?? '(CUSTOMER SERVICE)', dt: fmtDT(header.submitted_at ?? header.created_at) },
    { label: 'CHECKER', name: header.last_action_by_email ?? null, dt: fmtDT(header.last_action_at) },
    { label: 'APPROVED BY', name: header.web_approved_by_email ?? null, dt: null },
    { label: 'RECEIVED BY', name: null, dt: null },
  ];

  return (
    <article
      className="operational-report-print-document customer-request-print-document"
      data-testid="customer-withdrawal-print-document"
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>
                  {t('customer_withdrawal_print_title')}
                  {isStaff && copyType && (
                    <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
                      {copyType === 'customer' ? '(สำหรับลูกค้า)' : '(สำหรับพนักงาน)'}
                    </span>
                  )}
                  {header.status === 'CANCELLED' && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginLeft: 8 }}>
                      [ยกเลิกแล้ว]
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#333' }}>
                  {getTranslation('document_no', language) || 'เลขที่'}: <strong>{header.withdrawal_no ?? header.request_no}</strong>
                  {docDate && docDate !== '-' && (
                    <span style={{ marginLeft: 10 }}>
                      {getTranslation('document_date', language) || 'วันที่'}: {docDate}
                    </span>
                  )}
                </div>
              </div>
              {(header.withdrawal_no ?? header.request_no) && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <QRCode value={String(header.withdrawal_no ?? header.request_no)} size={54} style={{ width: 54, height: 54 }} />
                  <div style={{ fontSize: 8, color: '#666', marginTop: 1 }}>สแกนเปิดใบงาน</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Delivery meta ── */}
      <div style={{ borderBottom: '2px solid #ccc', marginBottom: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 6, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '34%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '36%' }} />
          </colgroup>
          <tbody>
            <tr>
              {!hideCustomerName ? (
                <>
                  <td style={META_KEY}>CUSTOMER NAME</td>
                  <td style={META_VAL}>{fmt(customerName)}</td>
                </>
              ) : (
                <td colSpan={2} style={{ border: 'none' }}></td>
              )}
              <td style={META_KEY}>DATE</td>
              <td style={META_VAL}>{fmt(docDate)}</td>
            </tr>
            <tr>
              <td style={META_KEY}>ADDRESS</td>
              <td colSpan={3} style={{ ...META_VAL, whiteSpace: 'normal' }}>{fmt(customerAddress)}</td>
            </tr>
            <tr>
              <td style={META_KEY}>TEL</td>
              <td style={META_VAL}>{fmt(contactPhone)}</td>
              <td style={META_KEY}>FAX</td>
              <td style={META_VAL}>{fmt(contactFax)}</td>
            </tr>
            <tr>
              <td style={META_KEY}>DELIVERY TO</td>
              <td style={META_VAL}>{fmt(header.delivery_to ?? header.delivery_type)}</td>
              <td style={META_KEY}>NO</td>
              <td style={META_VAL}>{fmt(header.withdrawal_no ?? header.request_no)}</td>
            </tr>
            <tr>
              <td style={META_KEY}>VEHICLE REG.</td>
              <td style={META_VAL}>{fmt(header.vehicle_registration)}</td>
              <td style={META_KEY}>PICKUP CONTACT</td>
              <td style={META_VAL}>{fmt(header.pickup_contact)}</td>
            </tr>
            <tr>
              <td style={META_KEY}>TRUCK TEMP</td>
              <td style={META_VAL}>{fmt(header.truck_temp)}</td>
              <td style={META_KEY}>ROOM TEMP</td>
              <td style={META_VAL}>{fmt(header.room_temp)}</td>
            </tr>
            {header.note ? (
              <tr>
                <td style={META_KEY}>REMARK</td>
                <td colSpan={3} style={META_VAL}>{header.note}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* ── Lines table ── */}
      <table className="operational-report-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 10 }}>
        <colgroup>
          <col style={{ width: '3%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '7%' }} />
        </colgroup>

        <thead>
          {/* Slim identifier row — repeats on every printed page (thead
              behavior), so a continuation page shows which document this is
              without re-printing the full customer/address/temp block above. */}
          <tr>
            <td colSpan={NCOLS} className="operational-report-running-header">
              เลขที่เอกสาร {header.withdrawal_no ?? header.request_no}
              {!hideCustomerName && <>&nbsp;•&nbsp; ลูกค้า {fmt(customerName)}</>}
            </td>
          </tr>
          <tr>
            <th rowSpan={2} style={TH}>#</th>
            <th rowSpan={2} style={TH}>TRACKING NO</th>
            <th rowSpan={2} style={TH}>LOT NO</th>
            <th rowSpan={2} style={TH}>ITEM CODE</th>
            <th rowSpan={2} style={TH}>CUSTOMER PRODUCT</th>
            <th rowSpan={2} style={TH}>LOCATION</th>
            <th rowSpan={2} style={TH}>MFG DATE</th>
            <th rowSpan={2} style={TH}>EXP DATE</th>
            <th rowSpan={2} style={{ ...TH, textAlign: 'right' }}>T.WEIGHT<br />KG.</th>
            <th colSpan={3} style={{ ...TH, background: '#e8eaf6' }}>BALANCE TOTAL</th>
            <th rowSpan={2} style={TH}>คงเหลือ<br />ในล็อต</th>
            <th rowSpan={2} style={TH}>REMARK</th>
          </tr>
          <tr>
            <th style={{ ...TH, background: '#e8eaf6' }}>Box</th>
            <th style={{ ...TH, background: '#e8eaf6' }}>Pack</th>
            <th style={{ ...TH, background: '#e8eaf6' }}>Pcs</th>
          </tr>
        </thead>

        <tbody>
          {lines.length ? lines.map((line, idx) => {
            const remaining = remainingAfterThisWithdrawal(line);
            return (
            <tr key={line.id ?? `${line.line_no}-${line.customer_product_code}`}>
              <td style={{ ...TD, textAlign: 'center' }}>{idx + 1}</td>
              <td style={TD_SAFE}>{fmt(line.tracking_code)}</td>
              <td style={{ ...TD_SAFE, fontWeight: 600 }}>{fmt(line.lot_no)}</td>
              <td style={TD_SAFE}>{fmt(line.customer_product_code ?? line.product_code)}</td>
              <td style={TD_SAFE}>
                <div>{fmt(line.product_name)}</div>
                {line.batch_no ? <div style={{ fontSize: 9, color: '#666' }}>Batch: {line.batch_no}</div> : null}
              </td>
              <td style={TD_SAFE}>{fmt(line.location)}</td>
              <td style={{ ...TD, textAlign: 'center' }}>{fmtDate(line.mfg_date)}</td>
              <td style={{ ...TD, textAlign: 'center' }}>{fmtDate(line.exp_date)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(line.requested_weight)}</td>
              <td style={{ ...TD, textAlign: 'center' }}>{line.requested_boxes ?? '-'}</td>
              <td style={{ ...TD, textAlign: 'center' }}>0</td>
              <td style={{ ...TD, textAlign: 'center' }}>0</td>
              <td style={{ ...TD, textAlign: 'center' }}>
                <div style={{ fontWeight: 600 }}>{remaining.boxes != null ? remaining.boxes : '-'}</div>
                {remaining.weight != null ? (
                  <div style={{ fontSize: 9, color: '#555' }}>{fmtNum(remaining.weight)} kg.</div>
                ) : null}
              </td>
              <td style={{ ...TD, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {(line.note || line.admin_note) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {line.note ? <span>{line.note}</span> : null}
                    {line.admin_note ? <span style={{ color: '#555', fontSize: 9 }}>({line.admin_note})</span> : null}
                  </div>
                ) : '-'}
              </td>
            </tr>
            );
          }) : (
            <tr>
              <td colSpan={NCOLS} style={{ ...TD, textAlign: 'center', color: '#888' }}>ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>

        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <td colSpan={8} style={{ ...TD, textAlign: 'right' }}>SUB TOTAL</td>
            <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(totalWeightKg)}</td>
            <td style={{ ...TD, textAlign: 'center' }}>{totalBoxes || '-'}</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={TD} />
            <td style={TD} />
          </tr>
          <tr style={{ fontWeight: 700, background: '#ebebeb' }}>
            <td colSpan={8} style={{ ...TD, textAlign: 'right' }}>TOTAL</td>
            <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(totalWeightKg)}</td>
            <td style={{ ...TD, textAlign: 'center' }}>{totalBoxes || '-'}</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={TD} />
            <td style={TD} />
          </tr>
        </tfoot>
      </table>

      {/* ── Page footer: signatures + truck info ──
          No flex spacer: CSS page-break/fragmentation properties are
          unreliable inside flex containers across browsers, which would
          undermine the pageBreakInside:'avoid' below for longer documents. */}
      <div style={{ borderTop: '2px solid #ccc', paddingTop: 10, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 12, fontSize: 10 }}>
          {sigs.map(({ label, name, dt }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ minHeight: 20 }} />
              <div style={{ borderTop: '1px solid #000', paddingTop: 3, fontWeight: 700, fontSize: 10 }}>{label}</div>
              <div style={{ color: '#444', fontSize: 9, marginTop: 2, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {name ?? <span style={{ color: '#bbb' }}>____________________</span>}
                {dt && <span style={{ color: '#888', marginLeft: 4 }}>{dt}</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', borderTop: '1px solid #ccc', paddingTop: 6, fontSize: 10, flexWrap: 'nowrap' }}>
          {[
            ['TRUCK NO', 100],
            ['SEAL NO', 80],
            ['START', 60],
            ['FINISH', 60],
          ].map(([label, w]) => (
            <div key={label} style={{ display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
              <strong>{label}</strong>
              <span style={{ borderBottom: '1px solid #000', minWidth: w, display: 'inline-block' }}>&nbsp;</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', paddingTop: 6, fontSize: 10 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
            <strong>FORKMAN BY</strong>
            <span style={{ borderBottom: '1px solid #000', minWidth: 80, display: 'inline-block' }}>&nbsp;</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span>☐ CLEAN</span>
            <span>☐ UNCLEAN</span>
          </div>
        </div>
      </div>
    </article>
  );
}
