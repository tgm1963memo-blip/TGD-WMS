import React from 'react';

export function AccountingChargeWarningPanel({ errors = [], warnings = [], loading, error }) {
  if (loading) return <p className="sprint-status">Loading staging validation warnings...</p>;
  if (error) return <p className="sprint-status">Unable to load validation warnings.</p>;

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  if (!hasErrors && !hasWarnings) {
    return <p className="sprint-status" style={{ color: '#5cb85c' }}>No validation errors or warnings found for this staging preview.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {hasErrors && (
        <div style={{ border: '1px solid #d9534f', padding: '1rem', borderRadius: '4px', backgroundColor: 'rgba(217, 83, 79, 0.02)' }}>
          <h4 style={{ color: '#d9534f', marginTop: 0 }}>Validation Errors ({errors.length})</h4>
          <ul style={{ paddingLeft: '1.2rem', margin: 0, color: '#333' }}>
            {errors.map((err, i) => (
              <li key={i}>{typeof err === 'object' ? JSON.stringify(err) : err}</li>
            ))}
          </ul>
        </div>
      )}

      {hasWarnings && (
        <div style={{ border: '1px solid #f0ad4e', padding: '1rem', borderRadius: '4px', backgroundColor: 'rgba(240, 173, 78, 0.02)' }}>
          <h4 style={{ color: '#f0ad4e', marginTop: 0 }}>Mapping Warning Logs ({warnings.length})</h4>
          <ul style={{ paddingLeft: '1.2rem', margin: 0, color: '#333' }}>
            {warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
        * Action Boundary: This validation warning panel is strictly for diagnosing data readiness. Operators cannot approve, post, or finalize rows from this screen.
      </p>
    </div>
  );
}
