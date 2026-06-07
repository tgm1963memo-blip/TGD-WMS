import { expect, test } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

test('Responsive classes and styles exist in styles.css', () => {
  const cssPath = path.resolve(__dirname, '../../src/styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // Check for auth layout presence
  expect(cssContent).toContain('.layout-auth');
  expect(cssContent).toContain('.login-container');

  // Check for max-width media query
  expect(cssContent).toContain('@media (max-width: 760px)');
  
  // Check that button sizes exist
  expect(cssContent).toContain('.btn-primary-gold');
});
