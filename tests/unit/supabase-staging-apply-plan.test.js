// supabase-staging-apply-plan.test.js
// Targeted validation test for Sprint 13I documentation and apply plan

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../../');
const docs = {
  applyPlan: path.join(projectRoot, 'docs/deployment/supabase-staging-apply-plan.md'),
  checklist: path.join(projectRoot, 'docs/deployment/supabase-staging-validation-sql-checklist.md'),
  rollback: path.join(projectRoot, 'docs/deployment/supabase-staging-rollback-plan.md'),
  smoke: path.join(projectRoot, 'docs/deployment/supabase-staging-smoke-test-plan.md'),
  risk: path.join(projectRoot, 'docs/deployment/supabase-staging-apply-risk-register.md'),
  validation: path.join(projectRoot, 'docs/sprints/sprint-13i-supabase-staging-apply-plan-validation.md')
};

function read(p) { return fs.readFileSync(p, {encoding: 'utf8'}); }

describe('Sprint 13I targeted documentation validation', () => {
  it('All required docs exist', () => {
    Object.values(docs).forEach(p => expect(fs.existsSync(p)).toBe(true));
  });

  it('Apply plan includes required apply order', () => {
    const content = read(docs.applyPlan);
    const order = [
      'database/migrations/001_tgd_wms_schema_foundation.sql',
      'database/policies/002_tgd_wms_rls_policy_foundation.sql',
      'database/policies/004_tgd_wms_customer_isolation_rls_refinement.sql',
      'database/seeds/003_tgd_wms_seed_data_foundation.sql',
      'database/rpc/005_tgd_wms_rpc_stock_movement_foundation.sql',
      'database/triggers/006_tgd_wms_stock_balance_trigger_design.sql'
    ];
    order.forEach(item => expect(content).toMatch(new RegExp(item)));
  });

  it('Docs state Do NOT apply to production and require controller approval', () => {
    const apply = read(docs.applyPlan);
    expect(apply).toMatch(/Do NOT apply this plan to a production/i);
    expect(apply).toMatch(/Controller approval required/i);
  });

  it('Rollback plan includes trigger, RPC and seed rollback sections', () => {
    const content = read(docs.rollback);
    expect(content).toMatch(/Disable trigger/i);
    expect(content).toMatch(/Drop RPC functions/i);
    expect(content).toMatch(/Remove seed demo data/i);
  });

  it('Validation checklist references required objects', () => {
    const content = read(docs.checklist);
    const refs = ['tables', 'RLS', 'policies', 'RPC', 'trigger'];
    refs.forEach(r => expect(content).toMatch(new RegExp(r, 'i')));
  });

  it('Smoke test plan references key items', () => {
    const content = read(docs.smoke);
    const items = ['connection readiness', 'auth role mapping', 'RLS isolation', 'RPC', 'trigger', 'stock balance'];
    items.forEach(i => expect(content).toMatch(new RegExp(i, 'i')));
  });

  it('Risk register includes critical risks', () => {
    const content = read(docs.risk);
    const risks = ['production apply by mistake', 'service_role exposure', 'customer data leakage'];
    risks.forEach(r => expect(content).toMatch(new RegExp(r, 'i')));
  });

  it('Validation doc declares no live apply or UI writes', () => {
    const content = read(docs.validation);
    expect(content).toMatch(/No live Supabase apply confirmation/i);
    expect(content).toMatch(/No UI live write confirmation/i);
  });

  it('Validation doc contains no forbidden business terms', () => {
    const content = read(docs.validation).toLowerCase();
    const forbidden = ['sales_order','sales_orders','so_','outbound_orders','invoice','invoice_lines'];
    forbidden.forEach(term => expect(content).not.toContain(term));
  });
});
