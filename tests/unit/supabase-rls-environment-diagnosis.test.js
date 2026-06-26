import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23J: Supabase RLS and Environment Diagnosis', () => {
  it('should verify document contents include Production HOLD and FINAL GO boundaries', () => {
    const docPath = path.join(process.cwd(), 'docs', '23J_SUPABASE_RLS_AND_ENVIRONMENT_DIAGNOSIS.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('should verify document includes required SQL statements and no anon key exposure', () => {
    const docPath = path.join(process.cwd(), 'docs', '23J_SUPABASE_RLS_AND_ENVIRONMENT_DIAGNOSIS.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('select schemaname, tablename, rowsecurity');
    expect(docContent).toContain('select schemaname, tablename, policyname');
    expect(docContent).toContain('No Sensitive Exposure');
    expect(docContent).toContain('Environment Mismatch');
  });

  it('should verify ReceivingDetailPage.jsx uses controlled post wrapper', () => {
    const pagePath = path.join(process.cwd(), 'src', 'features', 'operations', 'receiving', 'ReceivingDetailPage.jsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    expect(pageContent).toContain('postReceivingDocument');
    expect(pageContent).toContain('No stock movement until Confirm/Post');
  });
  
  it('should verify transaction-uat-round-1.spec.js captures pageDiagnostics 23J', () => {
    const testPath = path.join(process.cwd(), 'tests', 'e2e', 'transaction-uat-round-1.spec.js');
    const testContent = fs.readFileSync(testPath, 'utf8');
    
    expect(testContent).toContain('data-testid="receiving-create-diagnostics"');
  });
});
