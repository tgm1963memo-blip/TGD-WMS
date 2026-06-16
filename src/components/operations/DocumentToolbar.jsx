import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

export function DocumentToolbar({ title, createHref, createLabel, onRefresh, exportDisabled = true }) {
  const t = useTranslation();
  const goLive = isGoLivePresentationEnabled();

  return (
    <section className="section-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
      <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
      <div className="document-toolbar-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {createHref ? (
          <Link className="btn btn-primary-gold" to={createHref}>
            {createLabel || t('create_draft') || 'Create draft'}
          </Link>
        ) : null}
        <button type="button" className="btn" onClick={onRefresh} style={{ background: '#f0f4f8', border: '1px solid var(--tgd-border)' }}>
          {t('refresh') || 'Refresh'}
        </button>
        {!goLive ? (
          <button type="button" className="btn document-toolbar-preview-only" disabled={exportDisabled} style={{ background: '#f0f4f8', border: '1px solid var(--tgd-border)' }}>
            {t('preview_only') || 'Preview only'}
          </button>
        ) : null}
      </div>
    </section>
  );
}
