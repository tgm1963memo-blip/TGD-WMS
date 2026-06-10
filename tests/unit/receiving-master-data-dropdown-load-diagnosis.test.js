import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23G: Receiving Master Data Dropdown Load Diagnosis', () => {
  it('should verify document contents include Production HOLD and FINAL GO boundaries', () => {
    const docPath = path.join(process.cwd(), 'docs', '23G_RECEIVING_MASTER_DATA_DROPDOWN_LOAD_DIAGNOSIS.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
  });

  it('should verify product loader no longer uses is_active filter in receivingService.js', () => {
    const servicePath = path.join(process.cwd(), 'src', 'services', 'receivingService.js');
    const serviceContent = fs.readFileSync(servicePath, 'utf8');

    expect(serviceContent).not.toContain('function isActiveRow(row)');
    expect(serviceContent).not.toContain('.filter(isActiveRow)');
  });

  it('should verify no product_code, warehouse_code, or customer_code is used for ordering in masterDataService.js', () => {
    const masterPath = path.join(process.cwd(), 'src', 'services', 'masterDataService.js');
    const masterContent = fs.readFileSync(masterPath, 'utf8');

    expect(masterContent).not.toContain('product_code');
    expect(masterContent).not.toContain('warehouse_code');
    expect(masterContent).not.toContain('customer_code');
  });
});
