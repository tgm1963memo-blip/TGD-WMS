import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23I: Receiving Master Data Empty Result Diagnostics', () => {
  it('should verify document contents include Production HOLD and FINAL GO boundaries', () => {
    const docPath = path.join(process.cwd(), 'docs', '23I_RECEIVING_MASTER_DATA_EMPTY_RESULT_DIAGNOSTICS.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('should verify document includes d220f61 and diagnostic version 23I', () => {
    const docPath = path.join(process.cwd(), 'docs', '23I_RECEIVING_MASTER_DATA_EMPTY_RESULT_DIAGNOSTICS.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('d220f61');
    expect(docContent).toContain('23I');
    expect(docContent).toContain('pageDiagnostics');
    expect(docContent).toContain('runtimeDiagnostics');
  });

  it('should verify ReceivingCreatePage.jsx contains the diagnostics panel 23I', () => {
    const pagePath = path.join(process.cwd(), 'src', 'features', 'operations', 'receiving', 'ReceivingCreatePage.jsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    
    expect(pageContent).toContain('Diagnostic version: 23I');
    expect(pageContent).toContain('Products loader called:');
    expect(pageContent).toContain('Warehouses loader called:');
    expect(pageContent).toContain('Raw products returned count:');
    expect(pageContent).toContain('Products after filter count:');
  });
  
  it('should verify transaction-uat-round-1.spec.js captures pageDiagnostics', () => {
    const testPath = path.join(process.cwd(), 'tests', 'e2e', 'transaction-uat-round-1.spec.js');
    const testContent = fs.readFileSync(testPath, 'utf8');
    
    expect(testContent).toContain('pageDiagnostics: null,');
    expect(testContent).toContain('resultData.pageDiagnostics = diagText;');
  });
});
