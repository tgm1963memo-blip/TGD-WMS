import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { LoadingState } from './LoadingState.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function DataTable({ columns, data = [], loading = false, error = null, emptyMessage = 'No records found.' }) {
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
    <div className="table-responsive responsive-table">
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
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
