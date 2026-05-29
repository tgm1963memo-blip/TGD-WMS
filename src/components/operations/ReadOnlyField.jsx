export function ReadOnlyField({ label, value }) {
  return (
    <div className="readonly-field" style={{ display: 'grid', gap: 4 }}>
      <span style={{ color: '#627d98', fontSize: 13, fontWeight: 700 }}>{label}</span>
      <strong style={{ color: '#102a43', fontSize: 15 }}>{value ?? '-'}</strong>
    </div>
  );
}
