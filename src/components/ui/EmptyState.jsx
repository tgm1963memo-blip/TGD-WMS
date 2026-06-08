export function EmptyState({ message = 'No records found.' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        —
      </div>
      <p>{message}</p>
    </div>
  );
}
