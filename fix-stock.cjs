const fs = require('fs');
let content = fs.readFileSync('src/features/customer/CustomerStockBalancePage.jsx', 'utf8');

content = content.replace('const { sortedData, requestSort, getSortIndicator } = useTableSort(sortedData);', '');

const innerTableComponent = `
function StockBalanceTable({ lines }) {
  const { sortedData, requestSort, getSortIndicator } = useTableSort(lines);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#f1f5f9' }}>
          <th onClick={() => requestSort('request_no')} style={{ cursor: 'pointer', padding: '8px 16px 8px 32px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>เลขที่ใบฝาก {getSortIndicator('request_no')}</th>
          <th onClick={() => requestSort('arrival_date')} style={{ cursor: 'pointer', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>วันที่รับเข้า {getSortIndicator('arrival_date')}</th>
          <th onClick={() => requestSort('lot_no')} style={{ cursor: 'pointer', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>LOT {getSortIndicator('lot_no')}</th>
          <th onClick={() => requestSort('mfg_date')} style={{ cursor: 'pointer', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>วันผลิต {getSortIndicator('mfg_date')}</th>
          <th onClick={() => requestSort('exp_date')} style={{ cursor: 'pointer', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>วันหมดอายุ {getSortIndicator('exp_date')}</th>
          <th onClick={() => requestSort('boxes')} style={{ cursor: 'pointer', padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>กล่อง {getSortIndicator('boxes')}</th>
          <th onClick={() => requestSort('weight')} style={{ cursor: 'pointer', padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--tgd-muted-text)', fontSize: 11 }}>น้ำหนัก (กก.) {getSortIndicator('weight')}</th>
        </tr>
      </thead>
      <tbody>
        {sortedData.map((l) => {
          // ensure sorting fields exist for the hook to use
          l.request_no = l.request?.request_no;
          l.arrival_date = l.request?.last_action_at ?? l.request?.expected_arrival_date;
          l.boxes = l.actual_boxes ?? l.expected_boxes;
          l.weight = l.actual_weight ?? l.expected_weight;
          
          return (
            <tr key={l.id} style={{ borderTop: '1px solid #e2e8f0' }}>
              <td style={{ padding: '10px 16px 10px 32px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--tgd-primary, #2563eb)' }}>
                {l.request?.request_no ?? '-'}
              </td>
              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                {formatDate(l.request?.last_action_at ?? l.request?.expected_arrival_date)}
              </td>
              <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--tgd-muted-text)' }}>
                {l.lot_no || '-'}
              </td>
              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatDate(l.mfg_date)}</td>
              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatDate(l.exp_date)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                {l.actual_boxes?.toLocaleString() ?? (
                  <span style={{ color: 'var(--tgd-muted-text)', fontWeight: 400 }}>{l.expected_boxes ?? '-'}</span>
                )}
              </td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                {l.actual_weight?.toLocaleString() ?? (
                  <span style={{ color: 'var(--tgd-muted-text)', fontWeight: 400 }}>{l.expected_weight ?? '-'}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function CustomerStockBalancePage() {
`

content = content.replace('export function CustomerStockBalancePage() {', innerTableComponent);

const tableRegex = /<table[\s\S]*?<\/table>/;
content = content.replace(tableRegex, '<StockBalanceTable lines={pg.lines} />');

fs.writeFileSync('src/features/customer/CustomerStockBalancePage.jsx', content, 'utf8');
