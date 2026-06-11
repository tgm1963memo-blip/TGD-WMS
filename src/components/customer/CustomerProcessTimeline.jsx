export function CustomerProcessTimeline({ statuses, currentIndex = 1, testId }) {
  return (
    <ol className="customer-process-timeline" data-testid={testId}>
      {statuses.map((status, index) => (
        <li
          className={index <= currentIndex ? 'customer-process-step is-complete' : 'customer-process-step'}
          key={status}
        >
          <span className="customer-process-step-marker">{index + 1}</span>
          <span>{status}</span>
        </li>
      ))}
    </ol>
  );
}
