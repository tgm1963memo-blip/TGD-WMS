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
  // Optional per-row className (row) => string|undefined, appended after the
  // expanded/collapsed class — lets a caller mark e.g. a group-boundary row
  // without this generic table needing to know what a "group" means.
  getRowClassName,
  // Opt-in: makes every column's declared `width` authoritative instead of a
  // mere hint. Under the default table-layout:auto, a column with a long
  // wrapping value (e.g. a product name) only gets whatever width is left
  // over AFTER every other nowrap column claims its own natural content
  // width first — regardless of that wrapping column's own declared %, it
  // can still get squeezed down to a couple characters per line. Scoped to
  // an opt-in prop (not applied to every CompactExpandableTable) because a
  // caller that never set per-column `width`s (e.g. BillingMovementWeightTable)
  // would otherwise have every column forced to an equal share instead of
  // sizing to its own content.
  fixedLayout = false,
  // Pairs with fixedLayout + fixed-px column widths: forces the table to
  // never shrink below the sum of its columns' comfortable widths, so a
  // narrow container (sidebar-heavy customer portal pages) scrolls
  // horizontally (via the .table-responsive wrapper, already overflow-x:
  // auto) instead of squeezing every column to fit — which is what
  // silently broke a wide column's declared width in the first place.
  minTableWidth,
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
      <table
        className={['tgd-table', 'compact-table', fixedLayout && 'compact-table--fixed'].filter(Boolean).join(' ')}
        style={minTableWidth ? { minWidth: minTableWidth } : undefined}
      >
        {summaryColumns.some((column) => column.width) ? (
          <colgroup>
            {summaryColumns.map((column) => (
              <col key={column.key} style={column.width ? { width: column.width } : undefined} />
            ))}
            <col style={{ width: '72px' }} />
          </colgroup>
        ) : null}
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
            const extraClassName = getRowClassName?.(row);

            return (
              <Fragment key={key}>
                <tr className={[expanded ? 'compact-table-row is-expanded' : 'compact-table-row', extraClassName].filter(Boolean).join(' ')}>
                  {summaryColumns.map((column) => (
                    <td
                      key={column.key}
                      className={['compact-table-cell', column.cellClassName].filter(Boolean).join(' ')}
                      title={column.title?.(row)}
                    >
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
