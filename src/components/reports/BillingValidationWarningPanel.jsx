export function BillingValidationWarningPanel({ rows = [], loading, error }) {
  if (loading) return <p className="sprint-status">Loading billing preview validation warnings...</p>;
  if (error) return <p className="sprint-status">Unable to load billing preview validation warnings.</p>;

  const warningRows = rows.filter((row) => row.validation_status && row.validation_status !== 'READY_FOR_REVIEW');

  if (!warningRows.length) {
    return <p className="sprint-status">No missing data warnings found for this preview.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Warehouse</th>
          <th>Validation Status</th>
          <th>Accounting Note</th>
        </tr>
      </thead>
      <tbody>
        {warningRows.map((row) => (
          <tr key={row.id}>
            <td>{row.customer_id ?? '-'}</td>
            <td>{row.warehouse_id ?? '-'}</td>
            <td>{row.validation_status}</td>
            <td>{row.accounting_note ?? 'Review required before accounting handoff'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
