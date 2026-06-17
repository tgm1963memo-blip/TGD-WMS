import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CUSTOMER_PORTAL_ADMIN_REVIEW_ROLES,
  CUSTOMER_PORTAL_WRITE_ROLES,
  toNullableNumber,
  toNullableText,
} from '../../src/services/customerPortalServiceUtils.js';

const serviceFiles = [
  'src/services/customerDepositRequestService.js',
  'src/services/customerWithdrawalRequestService.js',
  'src/services/customerDocumentTimelineService.js',
  'src/services/customerPortalDashboardService.js',
  'src/services/customerPortalRequestHistoryService.js',
];

const docPath = path.join(process.cwd(), 'docs/CUSTOMER_PORTAL_2F_UI_REAL_DATA_SWITCH.md');

describe('CUSTOMER-PORTAL-2F service and UI real data switch', () => {
  it('creates the 2F documentation', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  serviceFiles.forEach((relativePath) => {
    it(`defines ${relativePath}`, () => {
      expect(existsSync(path.join(process.cwd(), relativePath))).toBe(true);
    });
  });

  it('defines deposit create/edit/submit RPC wrappers', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/services/customerDepositRequestService.js'), 'utf8');
    expect(source).toContain("supabase.rpc('tgd_create_customer_deposit_request'");
    expect(source).toContain('p_customer_id: customerId');
    expect(source).toContain("supabase.rpc('tgd_upsert_customer_deposit_request_line'");
    expect(source).toContain("supabase.rpc('tgd_submit_customer_deposit_request'");
    expect(source).toContain("supabase.rpc('tgd_review_customer_deposit_request'");
    expect(source).not.toContain('tgd_stock_movements');
  });

  it('defines withdrawal create/edit/submit RPC wrappers', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/services/customerWithdrawalRequestService.js'), 'utf8');
    expect(source).toContain("supabase.rpc('tgd_create_customer_withdrawal_request'");
    expect(source).toContain('p_customer_id: customerId');
    expect(source).toContain("supabase.rpc('tgd_upsert_customer_withdrawal_request_line'");
    expect(source).toContain("supabase.rpc('tgd_submit_customer_withdrawal_request'");
    expect(source).not.toContain('tgd_post_dispatch_document');
  });

  it('normalizes nullable helpers for RPC payloads', () => {
    expect(toNullableText('  hello ')).toBe('hello');
    expect(toNullableText('   ')).toBeNull();
    expect(toNullableNumber('12.5')).toBe(12.5);
    expect(toNullableNumber('')).toBeNull();
  });

  it('keeps customer role constants aligned with backend RPCs', () => {
    expect(CUSTOMER_PORTAL_WRITE_ROLES).toEqual(['customer_admin', 'customer_user']);
    expect(CUSTOMER_PORTAL_ADMIN_REVIEW_ROLES).toEqual(['admin', 'accounting']);
  });

  it('documents deferred storage and blocked execution gates', () => {
    const doc = readFileSync(docPath, 'utf8').toLowerCase();
    expect(doc).toContain('2g');
    expect(doc).toContain('3b-5');
    expect(doc).toContain('no stock movement');
  });
});
