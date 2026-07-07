import { getTranslation } from '../../i18n/translationCatalog.js';
import { ReportSignatureSection } from './ReportSignatureSection.jsx';
import { normalizeDocumentBrandingConfig } from '../../config/documentBrandingConfig.js';

function fmtDate(v) {
  if (!v || v === '-') return '-';
  const s = String(v).split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return v;
}

function fmtNum(v, decimals = 3) {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0
    ? n.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : '-';
}

function fmtQty(v) {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n.toLocaleString('en') : '-';
}

function fmtBalance(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const s = Math.abs(n).toLocaleString('en');
  return n > 0 ? `+${s}` : `-${s}`;
}

function fmtBalanceWt(v, decimals = 3) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0.000';
  const s = Math.abs(n).toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return n > 0 ? `+${s}` : `-${s}`;
}

const CELL = { border: '1px solid #bbb', padding: '3px 4px', verticalAlign: 'middle' };
const TH = { ...CELL, background: '#f0f0f0', fontWeight: 700, fontSize: 8 };

const COL_WIDTHS = [
  '3%',   // NO
  '7%',   // RECEIVED DATE
  '7%',   // DELIVERY DATE
  '3%',   // DESC/CODE
  '8%',   // CUSTOMER PRODUCT
  '7%',   // LOT
  '6%',   // TRACKING NO
  '5%',   // WEIGHT KG
  '5%',   // BF VOLUME
  '6%',   // BF WEIGHT
  '5%',   // RCV VOLUME
  '6%',   // RCV WEIGHT
  '5%',   // DLV VOLUME
  '6%',   // DLV WEIGHT
  '5%',   // BAL VOLUME
  '6%',   // BAL WEIGHT
  '4%',   // UNIT
  '6%',   // REMARK
];

const NCOLS = COL_WIDTHS.length;

// Row-per-printed-page budgets for the 8pt A4-landscape table, measured
// empirically (Playwright print-to-PDF against representative row content)
// and given a safety margin for longer real-world text than the sample
// data used to measure. Four different budgets because each page shape
// reserves different fixed overhead: the first page carries the
// customer/period header block, the last page carries the TOTAL row +
// signature block, and a report that fits on one page needs both at once.
const SINGLE_PAGE_CAPACITY = 14;
const FIRST_PAGE_CAPACITY = 24;
const MIDDLE_PAGE_CAPACITY = 30;
const LAST_PAGE_CAPACITY = 18;

// Splits lines into per-printed-page chunks so a running SUB TOTAL can be
// rendered as the last row of every page, not just the final one. Forces
// a real page break between chunks (via CSS break-after) instead of
// relying on the browser's own table pagination, which cannot repeat a
// *running* subtotal (only a fixed one, via <tfoot>).
function paginateLines(lines) {
  if (lines.length <= SINGLE_PAGE_CAPACITY) {
    return [{ lines, isFirst: true, isLast: true }];
  }

  const pages = [];
  let remaining = lines;
  let isFirst = true;

  while (remaining.length > 0) {
    const isFinalChunk = !isFirst && remaining.length <= LAST_PAGE_CAPACITY;
    const cap = isFinalChunk ? remaining.length : (isFirst ? FIRST_PAGE_CAPACITY : MIDDLE_PAGE_CAPACITY);
    const take = Math.min(cap, remaining.length);
    pages.push({ lines: remaining.slice(0, take), isFirst, isLast: false });
    remaining = remaining.slice(take);
    isFirst = false;
  }

  if (pages.length === 1) {
    // Every row fit in one non-tfoot-bearing page, but the whole report
    // still exceeded SINGLE_PAGE_CAPACITY — the TOTAL + signature block
    // needs a page of its own rather than being silently dropped.
    pages.push({ lines: [], isFirst: false, isLast: true });
  } else {
    pages[pages.length - 1].isLast = true;
  }

  return pages;
}

function sumField(lines, field) {
  return lines.reduce((s, l) => s + (Number(l[field]) || 0), 0);
}

// balanceForwardVolume/Weight is a running per-lot balance carried on every
// row for that lot, not a per-row amount — a plain sum would count the same
// lot's opening balance once per movement it had in the period. Since rows
// stay chronological within a lot regardless of sort mode, that lot's first
// appearance carries its true brought-forward balance; later rows for the
// same lot reflect an already-partially-moved balance, so they're skipped.
function sumOpeningBalanceByLot(lines, field) {
  const seenLots = new Set();
  let sum = 0;
  for (const line of lines) {
    const lotKey = line.lotNo ?? '-';
    if (seenLots.has(lotKey)) continue;
    seenLots.add(lotKey);
    sum += Number(line[field]) || 0;
  }
  return sum;
}

export function InventoryMovementReportTemplate({
  data,
  language = 'th',
  branding,
  customerDetails,
  printedBy,
}) {
  const t = (key, fallback) => getTranslation(key, language) || fallback;
  const normalizedBranding = normalizeDocumentBrandingConfig(branding || {});
  const lines = data?.lines ?? [];

  const subTotalReceivedVol = sumField(lines, 'receivedVolume');
  const subTotalReceivedWt  = sumField(lines, 'receivedWeight');
  const subTotalDeliveryVol = sumField(lines, 'deliveryVolume');
  const subTotalDeliveryWt  = sumField(lines, 'deliveryWeight');

  const headerTd = {
    ...CELL,
    border: 'none',
    borderBottom: '2px solid #ccc',
    padding: '6px 8px',
  };

  const pages = paginateLines(lines);
  let rowsSoFar = 0;

  return (
    <article
      className="operational-report operational-report-a4-landscape"
      data-testid="inventory-movement-report-template"
      style={{ padding: 0 }}
    >
      {pages.map((page, pageIdx) => {
        const rowStartIndex = rowsSoFar;
        rowsSoFar += page.lines.length;
        const cumulativeCount = rowsSoFar;
        const cumulativeLines = lines.slice(0, cumulativeCount);
        const cumReceivedVol = sumField(cumulativeLines, 'receivedVolume');
        const cumReceivedWt  = sumField(cumulativeLines, 'receivedWeight');
        const cumDeliveryVol = sumField(cumulativeLines, 'deliveryVolume');
        const cumDeliveryWt  = sumField(cumulativeLines, 'deliveryWeight');
        const cumBalanceForwardVol = sumOpeningBalanceByLot(cumulativeLines, 'balanceForwardVolume');
        const cumBalanceForwardWt  = sumOpeningBalanceByLot(cumulativeLines, 'balanceForwardWeight');

        return (
          <div
            key={pageIdx}
            style={pageIdx < pages.length - 1 ? { pageBreakAfter: 'always', breakAfter: 'page' } : undefined}
          >
            {/* One-time header + full customer/period block — appears only on
                page 1, does NOT repeat on continuation pages (only the slim
                identifier row inside each page's own thead does). */}
            {page.isFirst && (
              <div style={headerTd}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    {normalizedBranding.logo_url && (
                      <img src={normalizedBranding.logo_url} alt="Logo" style={{ height: 44, marginBottom: 4 }} />
                    )}
                    <div style={{ fontWeight: 'bold', fontSize: 10 }}>CUSTOMER: {data?.customer}</div>
                    <div style={{ fontSize: 9 }}>ADDRESS : {data?.address || '-'}</div>
                    <div style={{ fontSize: 9 }}>
                      TEL : {customerDetails?.phone || '-'} &nbsp;&nbsp; FAX : {customerDetails?.fax || '-'}
                    </div>
                    <div style={{ fontSize: 9 }}>ATTN : {customerDetails?.contact_name || '-'}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 10 }}>
                    <div>FOR MONTH : {fmtDate(data?.dateFrom)} - {fmtDate(data?.dateTo)}</div>
                    <div>ISSUED DATE : {fmtDate(data?.issuedDate)}</div>
                  </div>
                </div>
                <div style={{
                  textAlign: 'center', fontSize: 13, fontWeight: 'bold',
                  marginTop: 6, borderTop: '1px solid #ccc', paddingTop: 5,
                }}>
                  Entry-Delivery Inventory Report
                </div>
              </div>
            )}

            <table
              className="report-print-table"
              style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                fontSize: 9,
              }}
            >
              <colgroup>
                {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>

              <thead>
                {/* Slim identifier row — repeats on every printed page */}
                <tr>
                  <td colSpan={NCOLS} className="operational-report-running-header">
                    ลูกค้า {data?.customer} &nbsp;•&nbsp; ช่วงเวลา {fmtDate(data?.dateFrom)} - {fmtDate(data?.dateTo)}
                  </td>
                </tr>

                <tr>
                  <th rowSpan={2} style={{ ...TH, textAlign: 'center' }}>NO.</th>
                  <th rowSpan={2} style={{ ...TH, textAlign: 'center' }}>วันที่<br />รับเข้า</th>
                  <th rowSpan={2} style={{ ...TH, textAlign: 'center' }}>วันที่<br />จ่ายออก</th>
                  <th rowSpan={2} style={{ ...TH }}>รายละเอียด/<br />รหัส</th>
                  <th rowSpan={2} style={{ ...TH }}>สินค้าลูกค้า</th>
                  <th rowSpan={2} style={{ ...TH }}>ล๊อต</th>
                  <th rowSpan={2} style={{ ...TH }}>TRACKING<br />NO</th>
                  <th rowSpan={2} style={{ ...TH, textAlign: 'right' }}>น้ำหนัก<br />(กก.)</th>
                  <th colSpan={2} style={{ ...TH, textAlign: 'center', background: '#e8eaf6' }}>ยอดยกมา</th>
                  <th colSpan={2} style={{ ...TH, textAlign: 'center', background: '#e8f5e9' }}>รับเข้า</th>
                  <th colSpan={2} style={{ ...TH, textAlign: 'center', background: '#fce4ec' }}>จ่ายออก</th>
                  <th colSpan={2} style={{ ...TH, textAlign: 'center', background: '#fff9e6' }}>คงเหลือ</th>
                  <th rowSpan={2} style={{ ...TH, textAlign: 'center' }}>UNIT</th>
                  <th rowSpan={2} style={{ ...TH }}>หมายเหตุ</th>
                </tr>

                <tr>
                  <th style={{ ...TH, textAlign: 'center', background: '#e8eaf6' }}>VOL</th>
                  <th style={{ ...TH, textAlign: 'right', background: '#e8eaf6' }}>WT (KG)</th>
                  <th style={{ ...TH, textAlign: 'center', background: '#e8f5e9' }}>VOL</th>
                  <th style={{ ...TH, textAlign: 'right', background: '#e8f5e9' }}>WT (KG)</th>
                  <th style={{ ...TH, textAlign: 'center', background: '#fce4ec' }}>VOL</th>
                  <th style={{ ...TH, textAlign: 'right', background: '#fce4ec' }}>WT (KG)</th>
                  <th style={{ ...TH, textAlign: 'center', background: '#fff9e6' }}>VOL</th>
                  <th style={{ ...TH, textAlign: 'right', background: '#fff9e6' }}>WT (KG)</th>
                </tr>
              </thead>

              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={NCOLS} style={{ ...CELL, textAlign: 'center', color: '#888', padding: '16px' }}>
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                ) : page.lines.map((line, i) => {
                  const index = rowStartIndex + i;
                  return (
                    <tr key={line.id ?? index} style={{ background: index % 2 === 1 ? '#fafafa' : '#fff' }}>
                      <td style={{ ...CELL, textAlign: 'center', fontSize: 8 }}>{index + 1}</td>
                      <td style={{ ...CELL, textAlign: 'center', fontSize: 8 }}>{fmtDate(line.receivedDate)}</td>
                      <td style={{ ...CELL, textAlign: 'center', fontSize: 8 }}>{fmtDate(line.deliveryDate)}</td>
                      <td style={{ ...CELL, fontSize: 8 }}>{line.descCode}</td>
                      <td style={{ ...CELL, fontSize: 8 }}>{line.customerProduct}</td>
                      <td style={{ ...CELL, fontSize: 8 }}>{line.lotNo}</td>
                      <td style={{ ...CELL, fontSize: 8 }}>{line.trackingCode}</td>
                      <td style={{ ...CELL, textAlign: 'right', fontSize: 8 }}>{fmtNum(line.weightKg)}</td>
                      <td style={{ ...CELL, textAlign: 'center', background: '#f3f4fd', fontSize: 8 }}>{fmtQty(line.balanceForwardVolume)}</td>
                      <td style={{ ...CELL, textAlign: 'right',  background: '#f3f4fd', fontSize: 8 }}>{fmtNum(line.balanceForwardWeight)}</td>
                      <td style={{ ...CELL, textAlign: 'center', background: '#f1f8f2', fontSize: 8 }}>{fmtQty(line.receivedVolume)}</td>
                      <td style={{ ...CELL, textAlign: 'right',  background: '#f1f8f2', fontSize: 8 }}>{fmtNum(line.receivedWeight)}</td>
                      <td style={{ ...CELL, textAlign: 'center', background: '#fdf2f5', fontSize: 8 }}>{fmtQty(line.deliveryVolume)}</td>
                      <td style={{ ...CELL, textAlign: 'right',  background: '#fdf2f5', fontSize: 8 }}>{fmtNum(line.deliveryWeight)}</td>
                      <td style={{ ...CELL, textAlign: 'center', background: '#fffbf0', fontSize: 8, color: Number(line.balanceVolume) < 0 ? '#dc2626' : Number(line.balanceVolume) === 0 ? '#888' : undefined }}>{fmtBalance(line.balanceVolume)}</td>
                      <td style={{ ...CELL, textAlign: 'right',  background: '#fffbf0', fontSize: 8, color: Number(line.balanceWeight) < 0 ? '#dc2626' : Number(line.balanceWeight) === 0 ? '#888' : undefined }}>{fmtBalanceWt(line.balanceWeight)}</td>
                      <td style={{ ...CELL, textAlign: 'center', fontSize: 8 }}>{line.volumeUnit}</td>
                      <td style={{ ...CELL, fontSize: 8 }}>
                        <div>{line.remark !== '-' ? line.remark : ''}</div>
                        {line.isClosed && (
                          <div style={{ marginTop: 2, display: 'inline-block', background: '#dc2626', color: '#fff', fontSize: 7, fontWeight: 800, padding: '1px 4px', borderRadius: 3, letterSpacing: '0.05em' }}>
                            CLOSED
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* ── TFOOT: running SUB TOTAL on every page; grand TOTAL +
                  signatures only on the true last page ── */}
              <tfoot>
                <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
                  <td colSpan={8} style={{ ...CELL, textAlign: 'right', fontSize: 8 }}>
                    SUB TOTAL ({cumulativeCount})
                  </td>
                  <td style={{ ...CELL, textAlign: 'center', background: '#e8eaf6', fontSize: 8 }}>{fmtQty(cumBalanceForwardVol)}</td>
                  <td style={{ ...CELL, textAlign: 'right',  background: '#e8eaf6', fontSize: 8 }}>{fmtNum(cumBalanceForwardWt)}</td>
                  <td style={{ ...CELL, textAlign: 'center', background: '#e8f5e9', fontSize: 8 }}>{fmtQty(cumReceivedVol)}</td>
                  <td style={{ ...CELL, textAlign: 'right',  background: '#e8f5e9', fontSize: 8 }}>{fmtNum(cumReceivedWt)}</td>
                  <td style={{ ...CELL, textAlign: 'center', background: '#fce4ec', fontSize: 8 }}>{fmtQty(cumDeliveryVol)}</td>
                  <td style={{ ...CELL, textAlign: 'right',  background: '#fce4ec', fontSize: 8 }}>{fmtNum(cumDeliveryWt)}</td>
                  <td style={{ ...CELL, background: '#fff9e6' }} colSpan={2} />
                  <td colSpan={2} style={CELL} />
                </tr>
                {page.isLast && (
                  <>
                    <tr style={{ fontWeight: 700, background: '#ebebeb' }}>
                      <td colSpan={8} style={{ ...CELL, textAlign: 'right', fontSize: 8 }}>TOTAL</td>
                      <td style={{ ...CELL, textAlign: 'center', background: '#e8eaf6', fontSize: 8 }}>{fmtQty(data?.totalBalanceForwardVolume)}</td>
                      <td style={{ ...CELL, textAlign: 'right',  background: '#e8eaf6', fontSize: 8 }}>{fmtNum(data?.totalBalanceForwardWeight)}</td>
                      <td style={{ ...CELL, textAlign: 'center', background: '#e8f5e9', fontSize: 8 }}>{fmtQty(data?.totalReceived ?? subTotalReceivedVol)}</td>
                      <td style={{ ...CELL, textAlign: 'right',  background: '#e8f5e9', fontSize: 8 }}>{fmtNum(data?.totalReceivedWeight ?? subTotalReceivedWt)}</td>
                      <td style={{ ...CELL, textAlign: 'center', background: '#fce4ec', fontSize: 8 }}>{fmtQty(data?.totalDelivery ?? subTotalDeliveryVol)}</td>
                      <td style={{ ...CELL, textAlign: 'right',  background: '#fce4ec', fontSize: 8 }}>{fmtNum(data?.totalDeliveryWeight ?? subTotalDeliveryWt)}</td>
                      <td style={{ ...CELL, textAlign: 'center', background: '#fff9e6', fontSize: 8 }}>{fmtQty(data?.totalBalanceVolume)}</td>
                      <td style={{ ...CELL, textAlign: 'right',  background: '#fff9e6', fontSize: 8 }}>{fmtNum(data?.totalBalanceWeight)}</td>
                      <td colSpan={2} style={CELL} />
                    </tr>
                    <tr>
                      <td colSpan={NCOLS} style={{ ...CELL, border: 'none', paddingTop: 16 }}>
                        <ReportSignatureSection branding={branding} language={language} preparedBy={printedBy} />
                      </td>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>
          </div>
        );
      })}
    </article>
  );
}
