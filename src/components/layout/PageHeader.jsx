import React from 'react';
import { brandConfig } from '../../config/brandConfig.js';

export function PageHeader({ title, description, actions }) {
  return (
    <header
      className="page-header modern-page-header"
      style={{
        alignItems: 'flex-start',
        display: 'flex',
        gap: 16,
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingTop: 4,
      }}
    >
      <div style={{ borderLeft: `4px solid ${brandConfig.colors.gold}`, paddingLeft: 14 }}>
        <h2 style={{ color: '#102a43', fontSize: 28, lineHeight: 1.2, margin: 0 }}>{title}</h2>
        {description ? (
          <p style={{ color: '#526173', fontSize: 15, lineHeight: 1.6, margin: '8px 0 0', maxWidth: 760 }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
