import React from 'react';

export function AccountingChargeStagingSummaryCard({ label, value, isWarning = false }) {
  const cardStyle = isWarning
    ? { borderLeft: '4px solid #f0ad4e', backgroundColor: 'rgba(240, 173, 78, 0.05)' }
    : {};

  return (
    <section className="quantity-summary-card" style={cardStyle}>
      <strong>{label}</strong>
      <span>{value}</span>
    </section>
  );
}
