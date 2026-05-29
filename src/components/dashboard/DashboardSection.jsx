export function DashboardSection({ title, children }) {
  return (
    <section className="document-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
