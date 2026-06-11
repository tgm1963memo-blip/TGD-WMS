export function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header">
      <div className="page-header-content">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions action-row">{actions}</div> : null}
    </header>
  );
}
