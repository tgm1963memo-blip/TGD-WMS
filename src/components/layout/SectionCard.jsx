import React from 'react';

export function SectionCard({ title, description, actions, children, tone = 'default' }) {
  return (
    <section className={`section-card card section-card-${tone}`} data-tone={tone}>
      {(title || description || actions) ? (
        <div className="section-card-header card-header">
          <div>
            {title ? <h2 className="section-card-title card-title">{title}</h2> : null}
            {description ? <p className="section-card-description">{description}</p> : null}
          </div>
          {actions ? <div className="section-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="card-body">{children}</div>
    </section>
  );
}

export default SectionCard;
