export function ReportSummaryCard({ label, value, helperText }) {
  return (
    <section className="quantity-summary-card">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
      {helperText ? <small>{helperText}</small> : null}
    </section>
  );
}
