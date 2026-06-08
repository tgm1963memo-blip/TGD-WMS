import React from 'react';

export function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header modern-page-header doc-header">
      <div className="page-header-content doc-info">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions doc-actions">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
