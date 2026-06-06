import React from 'react';

/**
 * SectionCard – uses --tgd-* design tokens from 17B Black & Gold theme.
 * Visual container for discrete operational content.
 */
export function SectionCard({ title, description, actions, children, tone = 'default' }) {
  const isWarning = tone === 'warning';
  const borderColor = isWarning ? 'var(--tgd-danger)' : 'var(--tgd-border)';
  const background = isWarning ? 'var(--tgm-red-soft)' : 'var(--tgd-surface)';
  const accentColor = isWarning ? 'var(--tgd-danger)' : 'var(--tgd-primary-gold)';

  return (
    <section
      className={`section-card section-card-${tone}`}
      style={{
        background,
        border: `1px solid ${borderColor}`,
        borderRadius: '10px',
        boxShadow: '0 18px 45px rgba(9, 9, 11, 0.10)',
        position: 'relative',
        padding: 20,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          background: accentColor,
          borderRadius: 999,
          display: 'block',
          height: 4,
          left: 20,
          position: 'absolute',
          right: 20,
          top: 0,
        }}
      />
      {(title || description || actions) ? (
        <div
          style={{
            alignItems: 'flex-start',
            display: 'flex',
            gap: 16,
            justifyContent: 'space-between',
            marginBottom: children ? 16 : 0,
          }}
        >
          <div>
            {title ? <h2 style={{ fontSize: 18, lineHeight: 1.3, margin: 0 }}>{title}</h2> : null}
            {description ? (
              <p style={{ color: 'var(--tgd-muted-text)', fontSize: 14, lineHeight: 1.5, margin: '6px 0 0' }}>{description}</p>
            ) : null}
          </div>
          {actions ? <div style={{ display: 'flex', gap: 8 }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export default SectionCard;
