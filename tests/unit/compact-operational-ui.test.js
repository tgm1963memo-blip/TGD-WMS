import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('19B Compact Operational UI Refinement', () => {
  it('should contain compact operational UI tokens in styles.css', () => {
    const cssPath = path.resolve(__dirname, '../../src/styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Forms
    expect(cssContent).toContain('font-size: 12px');
    expect(cssContent).toContain('font-size: 13px');
    expect(cssContent).toContain('height: 32px');
    
    // Tables
    expect(cssContent).toContain('table-header');
    expect(cssContent).toContain('word-break: break-word');
    
    // Responsive safeguards
    expect(cssContent).toContain('@media (max-width: 760px)');
    expect(cssContent).toContain('height: 40px'); // Touch-friendly size
  });
});
