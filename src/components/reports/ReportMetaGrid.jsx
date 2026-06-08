export function ReportMetaGrid({ fields = [] }) {
  return (
    <div className="operational-report-meta-grid">
      {fields.map((field) => (
        <div key={field.label} className="operational-report-meta-item">
          <span className="operational-report-meta-label">{field.label}</span>
          <span className="operational-report-meta-value">{field.value ?? '-'}</span>
        </div>
      ))}
    </div>
  );
}
