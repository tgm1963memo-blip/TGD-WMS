// tests/unit/supabase-staging-apply-execution.test.js
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

// Real project root (no .gemini or artifact paths)
const projectRoot = path.resolve('C:/Users/TSS/OneDrive/เดสก์ท็อป/TGD Coldstorage/TGD WMS');

// Helper to ensure a path does not contain forbidden substrings
function assertNoForbiddenPath(p) {
  expect(p).not.toMatch(/\.gemini|artifact/);
}

const docs = [
  'supabase-staging-preflight-checklist.md',
  'supabase-staging-apply-execution-record.md',
  'supabase-staging-backup-evidence.md',
  'supabase-staging-apply-command-checklist.md',
  'supabase-staging-post-apply-validation.md',
];

describe('Sprint 13J-A documentation validation (full coverage)', () => {
  it('project root path is correct and contains no forbidden segments', () => {
    expect(projectRoot).toBeTruthy();
    assertNoForbiddenPath(projectRoot);
  });

  it('all required documentation files exist', () => {
    docs.forEach((f) => {
      const fullPath = path.join(projectRoot, 'docs', 'deployment', f);
      expect(existsSync(fullPath)).toBeTruthy();
    });
  });

  it('each document contains the required safety header', () => {
    const headerLines = [
      '# Sprint 13J - Controlled Supabase Staging Apply',
      'Project: TGD WMS',
      'Phase: 13J-A Preflight / Documentation Only',
      'Status: Prepared only',
      'Controller Approval: Pending',
      'Production Apply: Not executed',
      'Staging Apply: Not executed',
      'UI Live Write: Not implemented',
      'Real Warehouse Transaction: Not executed',
    ];
    docs.forEach((f) => {
      const filePath = path.join(projectRoot, 'docs', 'deployment', f);
      const content = readFileSync(filePath, 'utf-8');
      headerLines.forEach((line) => expect(content).toContain(line));
    });
  });

  it('execution record contains explicit pending controller approval wording', () => {
    const execPath = path.join(projectRoot, 'docs', 'deployment', 'supabase-staging-apply-execution-record.md');
    const content = readFileSync(execPath, 'utf-8');
    expect(content).toContain('Controller approval status: **Pending**');
  });

  it('preflight checklist lists all six approved SQL files', () => {
    const checklistPath = path.join(projectRoot, 'docs', 'deployment', 'supabase-staging-preflight-checklist.md');
    const content = readFileSync(checklistPath, 'utf-8');
    const requiredSql = [
      '001_tgd_wms_schema_foundation.sql',
      '002_tgd_wms_rls_policy_foundation.sql',
      '004_tgd_wms_customer_isolation_rls_refinement.sql',
      '003_tgd_wms_seed_data_foundation.sql',
      '005_tgd_wms_rpc_stock_movement_foundation.sql',
      '006_tgd_wms_stock_balance_trigger_design.sql',
    ];
    requiredSql.forEach((sql) => expect(content).toContain(sql));
  });

  it('apply command checklist includes stop‑on‑failure, backup path, and masked project ref', () => {
    const cmdPath = path.join(projectRoot, 'docs', 'deployment', 'supabase-staging-apply-command-checklist.md');
    const content = readFileSync(cmdPath, 'utf-8');
    expect(content).toContain('--stop-on-failure');
    expect(content).toContain('C:\\TGD-WMS-Backups\\staging\\');
    expect(content).toContain('<STAGING_PROJECT_REF_MASKED>');
    expect(content).toMatch(/Do not continue after failure/i);
  });

  it('no real Supabase credentials or service_role key are present in any doc', () => {
    const forbidden = [/supabase\.co/i, /apikey/i, /key\s*=/i, /password/i, /service_role/i];
    docs.forEach((f) => {
      const filePath = path.join(projectRoot, 'docs', 'deployment', f);
      const content = readFileSync(filePath, 'utf-8');
      forbidden.forEach((re) => expect(content).not.toMatch(re));
    });
  });

  it('validation summary markdown reflects correct statuses', () => {
    const validationPath = path.join(projectRoot, 'docs', 'sprints', 'sprint-13j-controlled-supabase-staging-apply-validation.md');
    const content = readFileSync(validationPath, 'utf-8');
    const expectedLines = [
      '- Phase A: Partially completed',
      '- Phase B: Not approved',
      '- Controller approval: Pending',
      '- Staging apply: Not executed',
      '- Production apply: Not executed',
      '- supabase db push: Not executed',
      '- psql execution: Not executed',
      '- Seed data apply: Not executed',
      '- RPC apply: Not executed',
      '- Trigger apply: Not executed',
      '- UI data connection: Not implemented',
      '- Real transaction writes: Not implemented',
    ];
    expectedLines.forEach((line) => expect(content).toContain(line));
  });
});
