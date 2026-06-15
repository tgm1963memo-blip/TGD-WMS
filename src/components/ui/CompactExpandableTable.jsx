import { Fragment, useState } from 'react';
import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { LoadingState } from './LoadingState.jsx';

export function CompactExpandableTable({
  rows = [],
  rowKey,
  summaryColumns = [],
  renderDetail,
  loading = false,
  error = null,
  emptyMessage = 'No records found.',
  tableTestId,
  detailLabel = 'Detail',
  hideDetailLabel = 'Hide',
}) {
  const [expandedKey, setExpandedKey] = useState(null);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error.message ?? String(error)} />;
  }

  if (!rows.length) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="table-responsive responsive-table compact-expandable-table" data-testid={tableTestId}>
      <table className="tgd-table compact-table">
        <thead>
          <tr>
            {summaryColumns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
            <th className="compact-table-actions-header"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const expanded = expandedKey === key;

            return (
              <Fragment key={key}>
                <tr className={expanded ? 'compact-table-row is-expanded' : 'compact-table-row'}>
                  {summaryColumns.map((column) => (
                    <td key={column.key} className="compact-table-cell" title={column.title?.(row)}>
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                  <td className="compact-table-cell compact-table-actions">
                    <button
                      type="button"
                      className="compact-table-detail-btn"
                      onClick={() => setExpandedKey(expanded ? null : key)}
                      aria-expanded={expanded}
                    >
                      {expanded ? hideDetailLabel : detailLabel}
                    </button>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="compact-table-detail-row">
                    <td colSpan={summaryColumns.length + 1}>
                      <div className="compact-table-detail-panel">{renderDetail(row)}</div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
