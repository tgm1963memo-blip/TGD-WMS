function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString() : '-';
}

export function InvoiceDraftLinesTable({ lines = [] }) {
  if (!lines.length) {
    return (
      <div className="section-card" style={{ padding: 24, textAlign: 'center' }}>
        No invoice draft lines.
      </div>
    );
  }

  return (
    <div className="table-responsive responsive-table" data-testid="invoice-draft-lines-table">
      <table className="tgd-table">
        <thead>
          <tr>
            <th>Source Movement</th>
            <th>Source Document</th>
            <th>Product</th>
            <th>Movement Type</th>
            <th>Movement Date</th>
            <th>Qty</th>
            <th>Chargeable Weight</th>
            <th>Billing Status</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id ?? `${line.source_movement_id}-${line.product_code}`}>
              <td>{line.source_movement_id ?? '-'}</td>
              <td>{line.source_document_no ?? '-'}</td>
              <td>{line.product_code ?? '-'} {line.product_name ? `- ${line.product_name}` : ''}</td>
              <td>{line.movement_type ?? '-'}</td>
              <td>{formatDate(line.movement_date)}</td>
              <td>{formatNumber(line.qty)} {line.uom ?? ''}</td>
              <td>{formatNumber(line.chargeable_weight)}</td>
              <td>{line.billing_status ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
