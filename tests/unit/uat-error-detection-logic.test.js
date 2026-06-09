import { describe, it, expect } from 'vitest';
import { detectUatErrors } from '../utils/uatErrorDetection.js';

describe('UAT Error Detection Logic', () => {
  it('should detect real errors', () => {
    const text = 'The system encountered an error: rpc failed during execution.';
    const { errors, warnings } = detectUatErrors(text, 'http://localhost');
    
    expect(errors.length).toBeGreaterThan(0);
    expect(warnings.length).toBe(0);
    expect(errors.some(e => e.includes('rpc failed'))).toBe(true);
    expect(errors.some(e => e.includes('error:'))).toBe(true);
  });

  it('should ignore false positive static text', () => {
    const text = 'Receiving creation is controlled draft mode only. Confirm/Post is available on draft page via RPC.';
    const { errors, warnings } = detectUatErrors(text, 'http://localhost');
    
    expect(errors.length).toBe(0);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('via RPC');
  });

  it('should detect error even if ignore phrase is present', () => {
    const text = 'Production remains HOLD. However, a table not found error occurred.';
    const { errors, warnings } = detectUatErrors(text, 'http://localhost');
    
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('Production remains HOLD');
    
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('table not found');
  });

  it('should catch PG and Auth errors', () => {
    const texts = [
      'violates row-level security policy',
      'JWT expired',
      'PGRST116',
      'function not found in schema'
    ];

    texts.forEach(text => {
      const { errors } = detectUatErrors(text, 'http://localhost');
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
