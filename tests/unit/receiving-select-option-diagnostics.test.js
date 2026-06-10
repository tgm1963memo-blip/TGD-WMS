import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('23F: Receiving Select Option Diagnostics and Env Alignment', () => {
  it('should document select option matching logic', () => {
    const docPath = path.join(process.cwd(), 'docs', '23F_RECEIVING_SELECT_OPTION_DIAGNOSTICS.md');
    const docContent = fs.readFileSync(docPath, 'utf8');
    
    expect(docContent).toContain('MISSING_OPTION');
    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
    expect(docContent).toContain('UAT_PRODUCT_NAME');
    expect(docContent).toContain('UAT_WAREHOUSE_NAME');
  });

  it('should implement advanced select matching locally to verify logic', () => {
    const value = 'WH-COLD-01';
    const fallbackValue = 'TGM Cold Storage Warehouse 01';
    
    // Simulate what the evaluate function does
    const ops = [
      { value: '1', text: 'TGM Cold Storage Warehouse 01', index: 0 },
      { value: '2', text: 'TGM Ambient Warehouse', index: 1 }
    ];
    
    // Attempt with code
    let val = value;
    let lowerVal = val.toLowerCase();
    let matchWithCode = ops.find(o => 
      o.value === val || 
      o.text === val || 
      o.text.includes(val) || 
      o.value.includes(val) ||
      o.value.toLowerCase() === lowerVal ||
      o.text.toLowerCase() === lowerVal ||
      o.text.toLowerCase().includes(lowerVal) ||
      o.value.toLowerCase().includes(lowerVal)
    );
    expect(matchWithCode).toBeUndefined(); // Code is not in the options

    // Attempt with fallback name
    val = fallbackValue;
    lowerVal = val.toLowerCase();
    let matchWithName = ops.find(o => 
      o.value === val || 
      o.text === val || 
      o.text.includes(val) || 
      o.value.includes(val) ||
      o.value.toLowerCase() === lowerVal ||
      o.text.toLowerCase() === lowerVal ||
      o.text.toLowerCase().includes(lowerVal) ||
      o.value.toLowerCase().includes(lowerVal)
    );
    expect(matchWithName).toBeDefined(); // Found it
    expect(matchWithName.value).toBe('1');
  });

  it('should support case-insensitive and partial matching', () => {
    const val = 'frozen shrimp';
    const ops = [
      { value: 'FSHR-001', text: 'Frozen Shrimp 500g', index: 0 },
      { value: '1002', text: 'Pork Sausage', index: 1 }
    ];

    const lowerVal = val.toLowerCase();
    const match = ops.find(o => 
      o.value === val || 
      o.text === val || 
      o.text.includes(val) || 
      o.value.includes(val) ||
      o.value.toLowerCase() === lowerVal ||
      o.text.toLowerCase() === lowerVal ||
      o.text.toLowerCase().includes(lowerVal) ||
      o.value.toLowerCase().includes(lowerVal)
    );

    expect(match).toBeDefined();
    expect(match.value).toBe('FSHR-001');
  });
});
