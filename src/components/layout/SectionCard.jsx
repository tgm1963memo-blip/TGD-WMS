import React from 'react';
import { brandConfig } from '../../config/brandConfig.js';

export function SectionCard({ title, description, actions, children, tone = 'default' }) {
  const borderColor = tone === 'warning' ? brandConfig.colors.red : '#e5e7eb';
  const background = tone === 'warning' ? brandConfig.colors.redSoft : brandConfig.colors.white;
  const accentColor = tone === 'warning' ? brandConfig.colors.red : brandConfig.colors.gold;

  return (
    <section
      className={`section-card section-card-${tone}`}
      style={{
        background,
        border: `1px solid ${borderColor}`,
        borderRadius: brandConfig.ui.borderRadius,
        boxShadow: brandConfig.ui.cardShadow,
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
              <p style={{ color: '#526173', fontSize: 14, lineHeight: 1.5, margin: '6px 0 0' }}>{description}</p>
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
