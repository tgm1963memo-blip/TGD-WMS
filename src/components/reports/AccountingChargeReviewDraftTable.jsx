import React from 'react';

// Table displaying draft rows with optional notes editing (in-memory)
export const AccountingChargeReviewDraftTable = ({ draft, notes, onNoteChange }) => {
  const rows = draft?.canonical_payload?.rows || [];
  return (
    <div style={{ marginTop: '1rem' }}>
      <h3>Review Draft Rows</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f8ff' }}>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Row ID</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Customer</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Amount</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Review Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{row.id}</td>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{row.customer_code}</td>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{row.amount}</td>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                <textarea
                  rows={2}
                  style={{ width: '100%', fontFamily: 'inherit' }}
                  value={notes[row.id] || ''}
                  onChange={(e) => onNoteChange(row.id, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
