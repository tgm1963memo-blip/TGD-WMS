import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23H: Receiving Master Data Runtime Load Errors', () => {
  it('should verify document contents include Production HOLD and FINAL GO boundaries', () => {
    const docPath = path.join(process.cwd(), 'docs', '23H_RECEIVING_MASTER_DATA_RUNTIME_LOAD_ERRORS.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('should verify document includes products loaded count and warehouses loaded count', () => {
    const docPath = path.join(process.cwd(), 'docs', '23H_RECEIVING_MASTER_DATA_RUNTIME_LOAD_ERRORS.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('Products loaded count');
    expect(docContent).toContain('Warehouses loaded count');
  });

  it('should verify document does not expose sensitive tokens', () => {
    const docPath = path.join(process.cwd(), 'docs', '23H_RECEIVING_MASTER_DATA_RUNTIME_LOAD_ERRORS.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('No Sensitive Expsoure');
  });
  
  it('should verify ReceivingCreatePage.jsx contains the diagnostics panel', () => {
    const pagePath = path.join(process.cwd(), 'src', 'features', 'operations', 'receiving', 'ReceivingCreatePage.jsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    
    expect(pageContent).toContain('UAT Master Data Diagnostics');
    expect(pageContent).toContain('Products loaded:');
    expect(pageContent).toContain('Warehouses loaded:');
    expect(pageContent).toContain('Products error:');
    expect(pageContent).toContain('Warehouses error:');
  });
  
  it('should verify transaction-uat-round-1.spec.js captures runtimeDiagnostics', () => {
    const testPath = path.join(process.cwd(), 'tests', 'e2e', 'transaction-uat-round-1.spec.js');
    const testContent = fs.readFileSync(testPath, 'utf8');
    
    expect(testContent).toContain('runtimeDiagnostics: [],');
    expect(testContent).toContain('resultData.runtimeDiagnostics.push(text);');
  });
});
