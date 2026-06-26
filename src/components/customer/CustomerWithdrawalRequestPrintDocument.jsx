import { DocumentHeader } from '../documents/DocumentHeader.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';

function fmt(v) { return v != null && v !== '' ? v : '-'; }
function fmtNum(v, decimals = 3) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '-';
}
function fmtDT(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

const NCOLS = 10;
const TH = { border: '1px solid #ccc', padding: '4px 6px', background: '#f0f0f0', fontSize: 10, fontWeight: 700, textAlign: 'center' };
const TD = { border: '1px solid #ccc', padding: '4px 6px', fontSize: 10 };
const META_KEY = { fontWeight: 600, fontSize: 11, paddingBottom: 2 };
const META_VAL = { borderBottom: '1px solid #000', fontSize: 11, paddingBottom: 2 };

export function CustomerWithdrawalRequestPrintDocument({
  header,
  lines = [],
  language = 'th',
  branding,
  hideCustomerName = false,
}) {
  if (!header) return null;

  const t = (key) => getTranslation(key, language);

  const totalWeightKg = lines.reduce((s, l) => s + (Number(l.requested_weight) || 0), 0);
  const totalBoxes    = lines.reduce((s, l) => s + (Number(l.requested_boxes) || 0), 0);

  const docDate = header.requested_dispatch_date
    ? header.requested_dispatch_date
    : header.created_at ? header.created_at.split('T')[0] : '-';

  return (
    <article
      className="operational-report-print-document customer-request-print-document"
      data-testid="customer-withdrawal-print-document"
      style={{ padding: 0 }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 10 }}>
        <colgroup>
          <col style={{ width: '4%' }} />   {/* # */}
          <col style={{ width: '12%' }} />  {/* LOT/LOCATION */}
          <col style={{ width: '24%' }} />  {/* CUSTOMER PRODUCT */}
          <col style={{ width: '12%' }} />  {/* ITEM CODE */}
          <col style={{ width: '9%' }} />   {/* T.WEIGHT */}
          <col style={{ width: '7%' }} />   {/* Palet */}
          <col style={{ width: '7%' }} />   {/* Box */}
          <col style={{ width: '7%' }} />   {/* Pack */}
          <col style={{ width: '7%' }} />   {/* Pcs */}
          <col style={{ width: '11%' }} />  {/* REMARK */}
        </colgroup>

        <thead>
          {/* Row 1: Document header + delivery meta — repeats on every page */}
          <tr>
            <td colSpan={NCOLS} style={{ padding: '6mm 8mm', borderBottom: '2px solid #ccc' }}>
              <DocumentHeader
                branding={branding}
                documentDate={docDate}
                documentNo={header.withdrawal_no ?? header.request_no}
                documentTitle={t('customer_withdrawal_print_title')}
                language={language}
              />

              {/* Delivery meta grid */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 8 }}>
                <tbody>
                  <tr>
                    {!hideCustomerName ? (
                      <>
                        <td style={{ ...META_KEY, width: '18%' }}>CUSTOMER NAME</td>
                        <td style={META_VAL}>{fmt(header.customer_name)}</td>
                      </>
                    ) : (
                      <td colSpan={2} style={{ border: 'none' }}></td>
                    )}
                    <td style={{ ...META_KEY, width: '10%' }}>DATE</td>
                    <td style={{ ...META_VAL, width: '20%' }}>{fmt(docDate)}</td>
                  </tr>
                  <tr>
                    <td style={META_KEY}>ADDRESS</td>
                    <td colSpan={3} style={META_VAL}>{fmt(header.customer_address)}</td>
                  </tr>
                  <tr>
                    <td style={META_KEY}>TEL</td>
                    <td style={META_VAL}>{fmt(header.contact_phone)}</td>
                    <td style={META_KEY}>FAX</td>
                    <td style={META_VAL}>{fmt(header.contact_fax)}</td>
                  </tr>
                  <tr>
                    <td style={META_KEY}>DELIVERY TO</td>
                    <td style={META_VAL}>{fmt(header.delivery_to ?? header.delivery_type)}</td>
                    <td style={META_KEY}>NO</td>
                    <td style={META_VAL}>{fmt(header.withdrawal_no ?? header.request_no)}</td>
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
            </td>
          </tr>

          {/* Row 2+3: Column headers */}
          <tr>
            <th rowSpan={2} style={TH}>#</th>
            <th rowSpan={2} style={TH}>LOT NO<br />LOCATION</th>
            <th rowSpan={2} style={TH}>CUSTOMER PRODUCT</th>
            <th rowSpan={2} style={TH}>ITEM CODE</th>
            <th rowSpan={2} style={{ ...TH, textAlign: 'right' }}>T.WEIGHT<br />KG.</th>
            <th colSpan={4} style={{ ...TH, background: '#e8eaf6' }}>BALANCE TOTAL</th>
            <th rowSpan={2} style={TH}>REMARK</th>
          </tr>
          <tr>
            <th style={{ ...TH, background: '#e8eaf6' }}>Palet</th>
            <th style={{ ...TH, background: '#e8eaf6' }}>Box</th>
            <th style={{ ...TH, background: '#e8eaf6' }}>Pack</th>
            <th style={{ ...TH, background: '#e8eaf6' }}>Pcs</th>
          </tr>
        </thead>

        <tbody>
          {lines.length ? lines.map((line, idx) => (
            <tr key={line.id ?? `${line.line_no}-${line.customer_product_code}`}>
              <td style={{ ...TD, textAlign: 'center' }}>{idx + 1}</td>
              <td style={TD}>
                <div style={{ fontWeight: 600 }}>{fmt(line.lot_no)}</div>
                {line.location ? <div style={{ fontSize: 9, color: '#555' }}>{line.location}</div> : null}
              </td>
              <td style={TD}>
                <div>{fmt(line.product_name)}</div>
                {line.batch_no ? <div style={{ fontSize: 9, color: '#666' }}>Batch: {line.batch_no}</div> : null}
              </td>
              <td style={TD}>{fmt(line.customer_product_code ?? line.product_code)}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(line.requested_weight)}</td>
              <td style={{ ...TD, textAlign: 'center' }}>0</td>
              <td style={{ ...TD, textAlign: 'center' }}>{line.requested_boxes ?? '-'}</td>
              <td style={{ ...TD, textAlign: 'center' }}>0</td>
              <td style={{ ...TD, textAlign: 'center' }}>0</td>
              <td style={TD}>{fmt(line.note)}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={NCOLS} style={{ ...TD, textAlign: 'center', color: '#888' }}>ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>

        <tfoot>
          <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <td colSpan={4} style={{ ...TD, textAlign: 'right' }}>SUB TOTAL</td>
            <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(totalWeightKg)}</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={{ ...TD, textAlign: 'center' }}>{totalBoxes || '-'}</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={TD} />
          </tr>
          <tr style={{ fontWeight: 700, background: '#ebebeb' }}>
            <td colSpan={4} style={{ ...TD, textAlign: 'right' }}>TOTAL</td>
            <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(totalWeightKg)}</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={{ ...TD, textAlign: 'center' }}>{totalBoxes || '-'}</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={{ ...TD, textAlign: 'center' }}>0</td>
            <td style={TD} />
          </tr>

          {/* Signatures row */}
          <tr>
            <td colSpan={NCOLS} style={{ border: 'none', padding: '12px 8px 8px' }}>
              {(() => {
                const sigs = [
                  { label: 'ISSUED BY', name: header.created_by_email ?? '(CUSTOMER SERVICE)', dt: fmtDT(header.submitted_at ?? header.created_at) },
                  { label: 'CHECKER', name: header.last_action_by_email ?? null, dt: fmtDT(header.last_action_at) },
                  { label: 'APPROVED BY', name: header.web_approved_by_email ?? null, dt: null },
                  { label: 'RECEIVED BY', name: null, dt: null },
                ];
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 12, fontSize: 10 }}>
                    {sigs.map(({ label, name, dt }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #000', paddingTop: 4, fontWeight: 700 }}>{label}</div>
                        <div style={{ color: '#444', fontSize: 9, marginTop: 2 }}>{name ?? '____________________'}</div>
                        {dt && <div style={{ color: '#888', fontSize: 8 }}>{dt}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', borderTop: '1px solid #ccc', paddingTop: 6, fontSize: 10, flexWrap: 'wrap' }}>
                {[
                  ['TRUCK NO', 100],
                  ['SEAL NO', 80],
                  ['START', 60],
                  ['FINISH', 60],
                  ['FORKMAN BY', 80],
                ].map(([label, w]) => (
                  <div key={label} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <strong>{label}</strong>
                    <span style={{ borderBottom: '1px solid #000', minWidth: w, display: 'inline-block' }}>&nbsp;</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <span>☐ CLEAN</span>
                  <span>☐ UNCLEAN</span>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </article>
  );
}
