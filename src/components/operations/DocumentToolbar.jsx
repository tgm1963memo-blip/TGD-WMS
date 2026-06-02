import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function DocumentToolbar({ title, createHref, createLabel, onRefresh, exportDisabled = true }) {
  const t = useTranslation();

  return (
    <section
      className="document-toolbar"
      style={{
        alignItems: 'center',
        background: '#ffffff',
        border: '1px solid #d9e2ec',
        borderRadius: 8,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
        padding: 16,
      }}
    >
      <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
      <div className="document-toolbar-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {createHref ? (
          <Link
            className="action-link"
            style={{
              background: '#0f766e',
              borderRadius: 7,
              color: '#ffffff',
              display: 'inline-flex',
              fontWeight: 700,
              minHeight: 40,
              padding: '9px 12px',
            }}
            to={createHref}
          >
            {createLabel || t('create_draft') || 'Create draft'}
          </Link>
        ) : null}
        <button type="button" onClick={onRefresh} style={secondaryButtonStyle}>
          {t('refresh') || 'Refresh'}
        </button>
        <button type="button" disabled={exportDisabled} style={secondaryButtonStyle}>
          {t('preview_only') || 'Preview only'}
        </button>
      </div>
    </section>
  );
}

const secondaryButtonStyle = {
  background: '#f0f4f8',
  border: '1px solid #d9e2ec',
  borderRadius: 7,
  color: '#334e68',
  cursor: 'pointer',
  fontWeight: 700,
  minHeight: 40,
  padding: '8px 12px',
};
