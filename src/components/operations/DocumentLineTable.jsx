import { DataTable } from '../ui/DataTable.jsx';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function DocumentLineTable({ lines = [], columns, loading = false, error = null }) {
  const t = useTranslation();

  return (
    <section
      className="document-lines"
      style={{ background: '#ffffff', border: '1px solid #d9e2ec', borderRadius: 8, overflowX: 'auto', padding: 16 }}
    >
      <h3 style={{ marginTop: 0 }}>{t('document_lines') || 'Lines'}</h3>
      <DataTable
        columns={columns}
        data={lines}
        loading={loading}
        error={error}
        emptyMessage={t('no_operation_data') || 'No lines found.'}
      />
    </section>
  );
}
