import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('19C Operational Responsive CSS', () => {
  it('contains operational page responsive CSS in styles.css', () => {
    const cssPath = path.resolve(__dirname, '../../src/styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Filter grid responsive CSS
    expect(cssContent).toContain('.filter-grid');
    expect(cssContent).toContain('display: grid');
    
    // Table compact CSS
    expect(cssContent).toContain('.tgd-table');
    expect(cssContent).toContain('padding: 8px 10px');
    
    // Long text wrapping
    expect(cssContent).toContain('word-break: break-word');
    
    // Mobile breakpoint
    expect(cssContent).toContain('@media (max-width: 760px)');
  });
});
