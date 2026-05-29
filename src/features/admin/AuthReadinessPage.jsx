// src/features/admin/AuthReadinessPage.jsx (modified)
import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { SectionCard } from '../../components/layout/SectionCard.jsx';
import { AuthReadinessPanel } from '../../components/security/AuthReadinessPanel.jsx';
import { PRODUCTION_ROLE_DESCRIPTIONS, PRODUCTION_ROLES, summarizeProductionRole } from '../../security/productionRoleModel.js';
import { createRoleAssignmentChecklist, summarizeRoleAssignmentVerification } from '../../security/realUserRoleVerificationService.js';
import { summarizeSupabaseReadiness } from '../../services/supabaseConnectionReadinessService.js';
import { getTranslation } from '../../i18n/translationCatalog.js';

const READ_ONLY_ROLE_ASSIGNMENT_SAMPLE = [
  {
    displayName: 'Production admin review pending',
    role: 'admin',
    explicitAdminAssignment: true,
    reviewedByAdmin: false,
    evidenceReference: '',
  },
  {
    displayName: 'Warehouse manager review pending',
    role: 'warehouse_manager',
    reviewedByAdmin: false,
    evidenceReference: '',
  },
];

function ThaiStatusBadge({ summary }) {
  let label = 'ต้องตรวจสอบ';
  if (summary.ready) label = 'ผ่าน';
  if (summary.evidenceMissing) label = 'ไม่พร้อมใช้งาน Production';

  return (
    <span className={`status-badge ${summary.ready ? 'status-ready' : 'status-warning'}`}>
      {label}
    </span>
  );
}

export function AuthReadinessPage() {
  const roleRows = PRODUCTION_ROLES.map((role) => summarizeProductionRole(role));
  const roleVerificationSummary = summarizeRoleAssignmentVerification(READ_ONLY_ROLE_ASSIGNMENT_SAMPLE);
  const roleChecklist = createRoleAssignmentChecklist(READ_ONLY_ROLE_ASSIGNMENT_SAMPLE);

  // Supabase readiness status (read‑only)
  const supabaseStatus = summarizeSupabaseReadiness();

  // Collapsible state – use native details element for simplicity

  return (
    <section className="page-shell">
      <PageHeader
        title={getTranslation('auth_readiness.title', 'th')}
        description={getTranslation('auth_readiness.description', 'th')}
      />

      <AuthReadinessPanel />

      {/* Supabase Connection Readiness panel */}
      <details open className="supabase-readiness-details" style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontSize: 18, fontWeight: 'bold' }}>
          Supabase Frontend Readiness
        </summary>
        <SectionCard
          title="Frontend connection readiness"
          description={supabaseStatus.ready ? 'Ready' : 'Not ready'}
          tone={supabaseStatus.ready ? 'default' : 'warning'}
          actions={<ThaiStatusBadge summary={supabaseStatus} />}
        >
          <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div>
              <strong>Secret display:</strong> Hidden
            </div>
            <div>
              <strong>Production readiness:</strong> Not ready
            </div>
            <div>
              <strong>Live write:</strong> Disabled
            </div>
            <div>
              <strong>Transaction write:</strong> Disabled
            </div>
            <div>
              <strong>service_role exposed:</strong> {supabaseStatus.serviceRoleExposed ? 'Yes' : 'No'}
            </div>
          </div>
        </SectionCard>
      </details>

      <SectionCard
        title="ตรวจสอบสิทธิ์ผู้ใช้จริง"
        description="Read-only role assignment verification foundation. No save, upload, database write, or persistence action is available here."
        tone="warning"
        actions={<ThaiStatusBadge summary={roleVerificationSummary} />}
      >
        <div className="summary-grid">
          <article className="summary-card">
            <span>verification_status</span>
            <strong>{roleVerificationSummary.status}</strong>
          </article>
          <article className="summary-card">
            <span>user_role_assignment</span>
            <strong>{roleVerificationSummary.totalAssignments}</strong>
          </article>
          <article className="summary-card">
            <span>admin_role_review_required</span>
            <strong>{roleVerificationSummary.adminReviewRequired ? 'ต้องตรวจสอบ' : 'ผ่าน'}</strong>
          </article>
        </div>
        <h3>role_assignment_checklist</h3>
        <ul>
          {roleChecklist.map((item) => (
            <li key={item.id}>
              <strong>{item.ready ? 'ผ่าน' : 'ต้องตรวจสอบ'}</strong> - {item.label}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Production Role Model">
        <table className="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Rank</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {roleRows.map((row) => (
              <tr key={row.role}>
                <td>{row.role}</td>
                <td>{row.rank}</td>
                <td>{PRODUCTION_ROLE_DESCRIPTIONS[row.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <section className="document-section tgm-warning-section">
        <h2>ข้อจำกัดสำหรับ Production</h2>
        <p>
          Frontend permission guard และ Demo Role Selector ไม่ใช่ backend security.
          ก่อนใช้งาน Production ต้องมี authentication จริง, role assignment จากผู้ใช้จริง,
          และ backend/RLS enforcement ที่ผ่านการตรวจสอบแล้ว
        </p>
      </section>

      <SectionCard title="Next Action Checklist" tone="warning">
        <ul>
          <li>กำหนด production authentication provider</li>
          <li>ผูก role assignment กับ authenticated user profile</li>
          <li>ตรวจสอบ admin role assignment ก่อน rollout</li>
          <li>ยืนยัน viewer fallback เมื่อไม่มี role หรือ role ไม่ถูกต้อง</li>
          <li>ปิด Demo Role Selector ก่อน Production</li>
          <li>ยืนยันว่าไม่มี service role key ใน frontend configuration</li>
        </ul>
      </SectionCard>
    </section>
  );
}
