export function ReportSummaryCard({ label, value, helperText }) {
  return (
    <div className="kpi-card">
      <div className="kpi-title">{label}</div>
      <div className="kpi-value">{value ?? 0}</div>
      {helperText ? <div className="kpi-helper">{helperText}</div> : null}
    </div>
  );
}
