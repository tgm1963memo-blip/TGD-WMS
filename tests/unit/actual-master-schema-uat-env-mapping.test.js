import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('22O Actual Master Schema UAT Env Mapping', () => {
  it('should verify document exists and contains required rules and mappings', () => {
    const docPath = path.resolve(__dirname, '../../docs/22O_ACTUAL_MASTER_SCHEMA_UAT_ENV_MAPPING.md');
    
    // verify document exists
    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf-8');

    // includes actual schema mappings
    expect(docContent).toContain('UAT_PRODUCT_CODE');
    expect(docContent).toContain('tgd_products.sku');

    // includes customer name mapping
    expect(docContent).toContain('tgd_customers.name');

    // includes missing tgd_uoms
    expect(docContent).toContain('tgd_uoms');

    // includes missing tgd_reason_codes
    expect(docContent).toContain('tgd_reason_codes');

    // includes Adjustment BLOCKED rule
    expect(docContent).toContain('Adjustment scenarios will be BLOCKED');

    // includes Production remains HOLD
    expect(docContent).toContain('Production remains **HOLD**');

    // includes FINAL GO is NOT AUTHORIZED
    expect(docContent).toContain('FINAL GO is **NOT AUTHORIZED**');

    // does not imply Go Live approval
    expect(docContent).not.toContain('Go Live is **AUTHORIZED**');
    expect(docContent).not.toContain('Go Live is **APPROVED**');
    expect(docContent).not.toContain('FINAL GO is **AUTHORIZED**');
  });
});
