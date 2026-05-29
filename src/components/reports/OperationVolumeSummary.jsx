export function OperationVolumeSummary({ data = [], loading, error, label }) {
  if (loading) return <p className="sprint-status">Loading {label} operation volume...</p>;
  if (error) return <p className="sprint-status">Unable to load {label} operation volume.</p>;
  if (!data.length) return <p className="sprint-status">No {label} operation volume rows found.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>{label}</th>
          <th>Operations</th>
          <th>Pending</th>
          <th>Completed</th>
          <th>Charge Activities</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.group_id}</td>
            <td>{row.operation_count}</td>
            <td>{row.pending_count}</td>
            <td>{row.completed_count}</td>
            <td>{row.charge_activity_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
