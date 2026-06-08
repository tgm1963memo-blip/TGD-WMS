export function EmptyState({ message = 'No records found.', description = 'There are currently no items to display in this view.' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-inbox">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
        </svg>
      </div>
      <h3>{message}</h3>
      <p>{description}</p>
    </div>
  );
}
