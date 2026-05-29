export function PageShell({ title, description, children }) {
  return (
    <section className="page-shell">
      <div className="page-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <p className="sprint-status">Sprint status: placeholder only</p>
      {children}
    </section>
  );
}

