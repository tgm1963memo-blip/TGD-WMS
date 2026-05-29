import React from 'react';
import {
  auditDemoRoleSelectorRisk,
  auditProductionAuthReadiness,
  auditRoleAssignmentReadiness,
  summarizeAuthReadiness,
} from '../../security/authReadinessAuditService.js';

const DEFAULT_CONFIG = {
  authProviderConfigured: false,
  userProfileRoleSourceConfigured: false,
  demoRoleSelectorEnabled: true,
  viewerFallbackEnabled: true,
  publicEnv: {},
};

const DEFAULT_USERS = [
  { name: 'Admin review required', role: 'admin' },
  { name: 'Warehouse review required', role: 'warehouse_manager' },
  { name: 'Accounting review required', role: 'accounting' },
];

function StatusPill({ ready }) {
  return (
    <span className={`status-badge ${ready ? 'status-ready' : 'status-warning'}`}>
      {ready ? 'Ready' : 'Requires review'}
    </span>
  );
}

export function AuthReadinessPanel({
  config = DEFAULT_CONFIG,
  users = DEFAULT_USERS,
  demoSelectorOptions = { enabled: true, environment: 'staging' },
}) {
  const authAudit = auditProductionAuthReadiness(config);
  const roleAudit = auditRoleAssignmentReadiness(users);
  const demoRisk = auditDemoRoleSelectorRisk(demoSelectorOptions);
  const summary = summarizeAuthReadiness(authAudit);
  const warnings = [...authAudit.warnings, ...roleAudit.warnings, ...demoRisk.warnings];

  return (
    <section className="auth-readiness-panel" aria-label="Production authentication readiness">
      <div className="document-section">
        <h2>ความพร้อม Production Authentication</h2>
        <p>
          หน้านี้เป็นการตรวจสอบแบบอ่านอย่างเดียว (Read-only Review) สำหรับการเตรียมแทนที่
          ตัวเลือกบทบาทสาธิต (Demo Role Selector) ด้วยบทบาทผู้ใช้จริงในอนาคต
        </p>
        <div className="summary-grid">
          <article className="summary-card">
            <span>Auth readiness</span>
            <strong>{summary.status}</strong>
            <StatusPill ready={summary.ready} />
          </article>
          <article className="summary-card">
            <span>Demo role selector risk</span>
            <strong>{demoRisk.riskLevel}</strong>
            <StatusPill ready={demoRisk.riskLevel === 'low'} />
          </article>
          <article className="summary-card">
            <span>Role assignment readiness</span>
            <strong>{roleAudit.ready ? 'ready' : 'requires_review'}</strong>
            <StatusPill ready={roleAudit.ready} />
          </article>
        </div>
      </div>

      <div className="document-section">
        <h3>รายการตรวจสอบ</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {authAudit.checks.map((check) => (
              <tr key={check.id}>
                <td>{check.id}</td>
                <td>{check.status}</td>
                <td>{check.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="document-section">
        <h3>คำเตือนและงานถัดไป</h3>
        {warnings.length > 0 ? (
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>No warnings found.</p>
        )}
      </div>
    </section>
  );
}
