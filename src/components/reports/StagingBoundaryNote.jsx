import React from 'react';

export function StagingBoundaryNote() {
  return (
    <section className="document-section" style={{ borderLeft: '4px solid #d9534f', paddingLeft: '1rem', backgroundColor: 'rgba(217, 83, 79, 0.05)' }}>
      <h3 style={{ color: '#d9534f' }}>Strict No-Send / Preview-Only Boundary</h3>
      <p>
        <strong>Inspection Notice:</strong> This staging page provides a read-only preview of canonical charges and Bplus draft mappings.
        External systems are not connected. In accordance with Sprint 7C boundaries:
      </p>
      <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
        <li>No automated transfer or handoff triggers exist.</li>
        <li>No file exports (CSV, Excel, PDF, JSON, TXT) are generated.</li>
        <li>No invoice documents can be created from this page.</li>
        <li>No billing period locking or general ledger posting functions are implemented.</li>
      </ul>
      <p style={{ marginTop: '0.5rem', fontStyle: 'italic', fontSize: '0.9rem' }}>
        State: Staging Preview Only. Action actions (such as send, export, generate, finalize, lock, or post) are strictly excluded.
      </p>
    </section>
  );
}
