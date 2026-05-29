export function StatusBadge({ value }) {
  const label = typeof value === 'boolean' ? (value ? 'Active' : 'Inactive') : value;

  return <span className="sprint-status">{label ?? 'Unknown'}</span>;
}
