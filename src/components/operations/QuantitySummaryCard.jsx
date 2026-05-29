export function QuantitySummaryCard({ label, value, uom, helperText }) {
  return (
    <section
      className="quantity-summary-card"
      style={{ background: '#ffffff', border: '1px solid #d9e2ec', borderRadius: 8, padding: 16 }}
    >
      <span style={{ color: '#627d98', fontSize: 13, fontWeight: 700 }}>{label}</span>
      <strong style={{ color: '#102a43', display: 'block', fontSize: 24, lineHeight: 1.2, marginTop: 6 }}>
        {value ?? 0}{uom ? ` ${uom}` : ''}
      </strong>
      {helperText ? <small>{helperText}</small> : null}
    </section>
  );
}
