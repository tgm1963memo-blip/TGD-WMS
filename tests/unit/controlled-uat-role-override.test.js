import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getUatRoleOverride } from '../../src/security/uatRoleOverride.js';

describe('23D Controlled UAT Role Override', () => {
  it('should ignore override if UAT mode is not explicitly set', () => {
    const env = {
      VITE_UAT_ROLE_OVERRIDE: 'warehouse_staff',
      VITE_APP_ENV: 'production'
    };
    expect(getUatRoleOverride(env)).toBeNull();
  });

  it('should activate override if VITE_UAT_MODE is true and allowed role is requested', () => {
    const env = {
      VITE_UAT_MODE: 'true',
      VITE_UAT_ROLE_OVERRIDE: 'warehouse_staff'
    };
    expect(getUatRoleOverride(env)).toBe('warehouse_staff');
  });

  it('should activate override if VITE_APP_ENV is uat and allowed role is requested', () => {
    const env = {
      VITE_APP_ENV: 'uat',
      VITE_UAT_ROLE_OVERRIDE: 'admin'
    };
    expect(getUatRoleOverride(env)).toBe('admin');
  });

  it('should reject unrecognised roles', () => {
    const env = {
      VITE_UAT_MODE: 'true',
      VITE_UAT_ROLE_OVERRIDE: 'god_mode'
    };
    expect(getUatRoleOverride(env)).toBeNull();
  });

  it('should reject empty override', () => {
    const env = {
      VITE_UAT_MODE: 'true',
      VITE_UAT_ROLE_OVERRIDE: ''
    };
    expect(getUatRoleOverride(env)).toBeNull();
  });
});

describe('23D Documentation Validation', () => {
  it('must verify document exists and contains required safety language', () => {
    const docPath = path.resolve(__dirname, '../../docs/23D_CONTROLLED_UAT_ROLE_OVERRIDE.md');
    
    // Document exists
    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf8');

    // required env vars and values
    expect(docContent).toContain('VITE_UAT_ROLE_OVERRIDE');
    expect(docContent).toContain('warehouse_staff');
    
    // required boundaries
    const lowerDoc = docContent.toLowerCase();
    expect(lowerDoc).toContain('unconditional write access');
    expect(lowerDoc).toContain('guard preserved');
    
    // production safety
    expect(docContent).toContain('Production remains HOLD');
    expect(docContent).toContain('FINAL GO is NOT AUTHORIZED');
    expect(docContent).toContain('does not imply Go Live approval');
  });
});
