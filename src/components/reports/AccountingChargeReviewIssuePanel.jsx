import React from 'react';

// Panel to display grouped review issues (BLOCKED, WARNING, INFO, READY)
export const AccountingChargeReviewIssuePanel = ({ issues }) => {
  const severityOrder = ['BLOCKED', 'WARNING', 'INFO', 'READY'];
  return (
    <div style={{ marginTop: '1rem' }}>
      <h3>Review Issues</h3>
      {severityOrder.map((level) => {
        const items = issues?.[level] || [];
        if (!items.length) return null;
        return (
          <div key={level} style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: level === 'BLOCKED' ? '#d9534f' : '#f0ad4e' }}>{level}</strong>
            <ul style={{ listStyle: 'disc', marginLeft: '1.5rem' }}>
              {items.map((it, idx) => (
                <li key={idx}>{it}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
