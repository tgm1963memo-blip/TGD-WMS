function resolveStatusModifier(value) {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');

  if (['open', 'active', 'in_progress', 'submitted', 'submitted_by_customer', 'admin_reviewing', 'reserved'].includes(normalized)) {
    return 'open';
  }
  if (['confirmed', 'completed', 'posted', 'approved', 'exported_to_bplus', 'billed', 'picked', 'loaded', 'received', 'available'].includes(normalized)) {
    return 'confirmed';
  }
  if (['blocked', 'cancelled', 'rejected', 'failed'].includes(normalized)) {
    return 'blocked';
  }
  if (['hold', 'on_hold', 'production_hold'].includes(normalized)) {
    return 'hold';
  }
  if (['pass', 'passed', 'success'].includes(normalized)) {
    return 'pass';
  }
  if (['fail', 'failed', 'error'].includes(normalized)) {
    return 'fail';
  }

  return 'draft';
}

function formatStatusLabel(value) {
  if (typeof value === 'boolean') {
    return value ? 'Active' : 'Inactive';
  }

  if (!value) {
    return 'Unknown';
  }

  return String(value).replace(/_/g, ' ');
}

export function StatusBadge({ value, testId = 'document-status-badge' }) {
  const label = formatStatusLabel(value);
  const modifier = resolveStatusModifier(value);

  return (
    <span className={`status-badge status-badge--${modifier}`} data-testid={testId}>
      {label}
    </span>
  );
}
