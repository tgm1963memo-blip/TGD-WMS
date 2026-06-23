import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { LoadingState } from './LoadingState.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { formatDocumentDate, isDateColumnKey, isMetaColumnKey, shouldUseDateOnlyFormat } from '../../utils/documentDisplayUtils.js';

function renderDefaultCell(column, row) {
  const value = row[column.key];

  if (value === null || value === undefined || value === '') {
    return <span className="table-meta-text">-</span>;
  }

  if (isDateColumnKey(column.key)) {
    return (
      <span className="table-meta-text">
        {formatDocumentDate(value, { dateOnly: shouldUseDateOnlyFormat(column.key) })}
      </span>
    );
  }

  if (isMetaColumnKey(column.key)) {
    return <span className="table-meta-text">{String(value)}</span>;
  }

  if (column.key === 'status') {
    return <span className="table-meta-text">{String(value)}</span>;
  }

  return value;
}

export function DataTable({ columns, data = [], loading = false, error = null, emptyMessage = 'No records found.', testId }) {
  const t = useTranslation();

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error.message ?? String(error)} />;
  }

  if (!data.length) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="table-responsive responsive-table" data-testid={testId}>
      <table className="tgd-table">
        <thead>
          <tr>
            {columns.map((column) => {
              const fallbackKey = column.header.toLowerCase().replace(/ /g, '_');
              const headerLabel = t(column.key) || t(fallbackKey) || column.header;
              return <th key={column.key}>{headerLabel}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key} className={column.truncate ? 'cell-nowrap' : undefined}>
                  {column.render ? column.render(row) : renderDefaultCell(column, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
