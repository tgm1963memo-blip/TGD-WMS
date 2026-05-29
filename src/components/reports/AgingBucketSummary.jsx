export function AgingBucketSummary({ data = [], loading, error, label }) {
  if (loading) return <p className="sprint-status">Loading {label} aging summary...</p>;
  if (error) return <p className="sprint-status">Unable to load {label} aging summary.</p>;
  if (!data.length) return <p className="sprint-status">No {label} aging summary rows found.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>{label}</th>
          <th>Rows</th>
          <th>Stock Qty</th>
          <th>Average Aging Days</th>
          <th>Chargeable Days</th>
          <th>Near Expiry Lots</th>
          <th>Expired Lots</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.group_id}</td>
            <td>{row.row_count}</td>
            <td>{row.qty_on_hand}</td>
            <td>{row.average_aging_days}</td>
            <td>{row.chargeable_days_total}</td>
            <td>{row.near_expiry_lots}</td>
            <td>{row.expired_lots}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
