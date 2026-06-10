import { describe, it, expect } from 'vitest';
import { normalizeReceivingDocumentId } from '../../src/services/receivingService';
import fs from 'fs';
import path from 'path';

describe('23R Receiving Draft UUID RPC Response Mapping', () => {
  it('accepts direct UUID string', () => {
    const directUuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(normalizeReceivingDocumentId(directUuid)).toBe(directUuid);
  });

  it('accepts object with id', () => {
    const obj = { id: 'uuid-1' };
    expect(normalizeReceivingDocumentId(obj)).toBe('uuid-1');
  });

  it('accepts object with document_id', () => {
    const obj = { document_id: 'uuid-2' };
    expect(normalizeReceivingDocumentId(obj)).toBe('uuid-2');
  });

  it('accepts array with first object id', () => {
    const arr = [{ id: 'uuid-3' }];
    expect(normalizeReceivingDocumentId(arr)).toBe('uuid-3');
  });

  it('returns empty string for missing id, which triggers DRAFT_ID_MISSING later', () => {
    expect(normalizeReceivingDocumentId({})).toBe('');
    expect(normalizeReceivingDocumentId([])).toBe('');
    expect(normalizeReceivingDocumentId(null)).toBe('');
  });

  it('verifies documentation constraints', () => {
    const docPath = path.join(process.cwd(), 'docs/23R_RECEIVING_DRAFT_UUID_RPC_RESPONSE_MAPPING.md');
    const docContent = fs.readFileSync(docPath, 'utf8');

    expect(docContent).toContain('public.tgd_receiving_documents');
    expect(docContent).toContain('tgd_rpc_create_receiving_draft');
    expect(docContent).toContain('returns a direct UUID');
    expect(docContent).not.toMatch(/tgd_receiving_headers.*is the active table/i);
    expect(docContent).toContain('No direct stock balance updates');
    expect(docContent).toContain('No movement ledger bypass');
    expect(docContent).toContain('Production state remains **HOLD**');
    expect(docContent).toContain('FINAL GO is **NOT AUTHORIZED**');
  });
});
