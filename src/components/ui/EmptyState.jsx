export function EmptyState({ message = 'No records found.', description = 'There are currently no items to display in this view.' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </div>
      <h3>{message}</h3>
      <p>{description}</p>
    </div>
  );
}
