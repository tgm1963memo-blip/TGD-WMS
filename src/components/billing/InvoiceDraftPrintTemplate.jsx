function fmt(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
}

function fmtDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function InvoiceDraftPrintTemplate({ draft, lines = [] }) {
  if (!draft) return null;

  return (
    <div className="operational-report operational-report-a4-landscape" style={{ fontFamily: 'Sarabun, sans-serif', fontSize: 14, color: '#1e293b' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #2d9348' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#2d9348', letterSpacing: '-0.5px' }}>TGD Cold Storage</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>บริษัท ทีจีดี โคลด์ สตอเรจ จำกัด</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>ใบแจ้งหนี้ (ร่าง)</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Invoice Draft</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2d9348', marginTop: 4 }}>{draft.draft_no}</div>
        </div>
      </div>

      {/* Customer + Period */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>ลูกค้า / Customer</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{draft.customer_name ?? '-'}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>รอบการเรียกเก็บ / Billing Period</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{fmtDate(draft.billing_period_start)} — {fmtDate(draft.billing_period_end)}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            วันที่สร้าง: {fmtDate(draft.created_at)}
          </div>
        </div>
      </div>

      {/* Lines Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 12, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '11%' }} /> {/* เอกสารอ้างอิง */}
          <col style={{ width: '20%' }} /> {/* สินค้า */}
          <col style={{ width: '9%' }} /> {/* ประเภท */}
          <col style={{ width: '9%' }} /> {/* วันที่ */}
          <col style={{ width: '9%' }} /> {/* จำนวน */}
          <col style={{ width: '11%' }} /> {/* น้ำหนักชาร์จ */}
          <col style={{ width: '8%' }} /> {/* งวด/วัน */}
          <col style={{ width: '9%' }} /> {/* อัตรา */}
          <col style={{ width: '14%' }} /> {/* จำนวนเงิน */}
        </colgroup>
        <thead>
          <tr style={{ background: '#f1fdf4' }}>
            <th style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>เอกสารอ้างอิง</th>
            <th style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#1e293b' }}>สินค้า</th>
            <th style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>ประเภท</th>
            <th style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>วันที่</th>
            <th style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>จำนวน</th>
            <th style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>น้ำหนักชาร์จ (kg)</th>
            <th style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>งวด/วัน</th>
            <th style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>อัตรา</th>
            <th style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? lines.map((line, i) => (
            <tr key={line.id ?? i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafb' }}>
              <td style={{ border: '1px solid #e5e7eb', padding: '7px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line.source_document_no ?? '-'}</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '7px 10px', overflowWrap: 'break-word', wordBreak: 'break-word' }} title={line.product_name ?? line.product_code ?? '-'}>
                {line.product_name ?? line.product_code ?? '-'}
                {line.line_note ? <div style={{ fontSize: 10, color: '#94a3b8' }}>{line.line_note}</div> : null}
              </td>
              <td style={{ border: '1px solid #e5e7eb', padding: '7px 10px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: 11 }}>{line.movement_type ?? '-'}</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '7px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDate(line.movement_date)}</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{line.qty != null ? Number(line.qty).toLocaleString('th-TH') : '-'} {line.uom ?? ''}</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{line.chargeable_weight != null ? fmt(line.chargeable_weight) : '-'}</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '7px 10px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: 11 }}>{line.storage_days != null ? `${line.storage_days} วัน` : '-'}</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{line.rate != null ? Number(line.rate).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
              <td style={{ border: '1px solid #e5e7eb', padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{line.amount != null ? fmt(line.amount) : '-'}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={9} style={{ border: '1px solid #e5e7eb', padding: 16, textAlign: 'center', color: '#94a3b8' }}>ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f1fdf4', fontWeight: 700 }}>
            <td colSpan={4} style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'right', color: '#374151' }}>รวม Total</td>
            <td style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'right', color: '#1e293b' }}>{draft.total_qty != null ? Number(draft.total_qty).toLocaleString('th-TH') : '-'}</td>
            <td style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'right', color: '#1e293b' }}>{fmt(draft.total_chargeable_weight)}</td>
            <td colSpan={2} style={{ border: '1px solid #d1fae5', padding: '8px 10px' }} />
            <td style={{ border: '1px solid #d1fae5', padding: '8px 10px', textAlign: 'right', color: '#1e293b' }}>{draft.total_amount != null ? fmt(draft.total_amount) : '-'}</td>
          </tr>
        </tfoot>
      </table>

      {/* Amount summary */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
        <div style={{ minWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>มูลค่ารวม</span>
            <span style={{ fontWeight: 600 }}>{draft.total_amount != null ? fmt(draft.total_amount) : '-'} {draft.currency ?? 'THB'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 16, fontWeight: 800 }}>
            <span>ยอดรวมทั้งสิ้น</span>
            <span style={{ color: '#2d9348' }}>{draft.total_amount != null ? fmt(draft.total_amount) : '-'} {draft.currency ?? 'THB'}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 40, paddingTop: 20, borderTop: '1px solid #e5e7eb', fontSize: 12 }}>
        <div>
          <div style={{ color: '#94a3b8', marginBottom: 6 }}>ลายมือชื่อผู้รับ / Received by</div>
          <div style={{ borderBottom: '1px solid #cbd5e1', height: 32 }} />
          <div style={{ color: '#94a3b8', marginTop: 4 }}>วันที่ ________________________</div>
        </div>
        <div>
          <div style={{ color: '#94a3b8', marginBottom: 6 }}>ลายมือชื่อผู้จัดทำ / Prepared by</div>
          <div style={{ borderBottom: '1px solid #cbd5e1', height: 32 }} />
          <div style={{ color: '#94a3b8', marginTop: 4 }}>วันที่ ________________________</div>
        </div>
      </div>

      <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
        เอกสารนี้เป็นร่างเท่านั้น — This is a draft document only
        {draft.note ? <div style={{ marginTop: 4 }}>หมายเหตุ: {draft.note}</div> : null}
      </div>
    </div>
  );
}
