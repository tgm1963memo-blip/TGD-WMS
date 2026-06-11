export function InvoiceDraftStatusBadge({ status }) {
  if (!status) {
    return <span className="badge badge-neutral" data-testid="invoice-draft-status-badge">-</span>;
  }

  const className = status === 'DRAFT'
    ? 'badge badge-neutral'
    : status === 'READY_TO_REVIEW'
      ? 'badge badge-warning'
      : status === 'CANCELLED'
        ? 'badge badge-danger'
        : status === 'APPROVED' || status === 'EXPORTED_TO_BPLUS' || status === 'BILLED'
          ? 'badge badge-success'
          : 'badge badge-neutral';

  return (
    <span className={className} data-testid="invoice-draft-status-badge">
      {status}
    </span>
  );
}
