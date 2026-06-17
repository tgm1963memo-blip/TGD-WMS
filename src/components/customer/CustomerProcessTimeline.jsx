export function CustomerProcessTimeline({ statuses, currentIndex = 0, activeStatus, testId }) {
  const resolvedIndex = activeStatus
    ? Math.max(0, statuses.indexOf(activeStatus))
    : currentIndex;

  return (
    <ol className="customer-process-timeline" data-testid={testId}>
      {statuses.map((status, index) => (
        <li
          className={index <= resolvedIndex ? 'customer-process-step is-complete' : 'customer-process-step'}
          key={status}
        >
          <span className="customer-process-step-marker">{index + 1}</span>
          <span>{status}</span>
        </li>
      ))}
    </ol>
  );
}
