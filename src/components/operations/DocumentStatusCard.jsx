import { StatusBadge } from '../ui/StatusBadge.jsx';
import { ReadOnlyField } from './ReadOnlyField.jsx';

export function DocumentStatusCard({ title, status, fields = [] }) {
  return (
    <section
      className="document-card"
      style={{ background: '#ffffff', border: '1px solid #d9e2ec', borderRadius: 8, padding: 16 }}
    >
      <div className="document-card-header" style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <StatusBadge value={status} />
      </div>
      <div className="field-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginTop: 14 }}>
        {fields.map((field) => (
          <ReadOnlyField key={field.label} label={field.label} value={field.value} />
        ))}
      </div>
    </section>
  );
}
