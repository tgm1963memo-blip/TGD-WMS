export function ReportSummaryCard({ label, value, helperText, testId }) {
  return (
    <div className="kpi-card" data-testid={testId}>
      <div className="kpi-title">{label}</div>
      <div className="kpi-value">{value ?? 0}</div>
      {helperText ? <div className="kpi-helper">{helperText}</div> : null}
    </div>
  );
}
