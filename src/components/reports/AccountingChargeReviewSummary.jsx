import React from 'react';

// Simple summary card displaying provided summary data
export const AccountingChargeReviewSummary = ({ summary }) => {
  return (
    <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f5faff', borderRadius: '8px', border: '1px solid #e0eaff' }}>
      <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#2c3e50' }}>Review Summary</h2>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem' }}>
        {Object.entries(summary || {}).map(([key, value]) => (
          <li key={key} style={{ marginBottom: '0.25rem' }}>
            <strong>{key.replace(/_/g, ' ')}:</strong> {value}
          </li>
        ))}
      </ul>
    </div>
  );
};
