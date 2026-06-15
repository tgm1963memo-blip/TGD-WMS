import { Link } from 'react-router-dom';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import { formatDocumentDate } from '../../utils/documentDisplayUtils.js';

export function documentLink(to, label) {
  return (
    <Link className="document-link" to={to}>
      {label}
    </Link>
  );
}

export function renderStatusBadge(row) {
  return <StatusBadge value={row.status} />;
}

export function renderTableMeta(value, { dateOnly = false } = {}) {
  return <span className="table-meta-text">{formatDocumentDate(value, { dateOnly })}</span>;
}
