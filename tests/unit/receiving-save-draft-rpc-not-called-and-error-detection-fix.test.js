import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectUatErrors } from '../utils/uatErrorDetection.js';

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: { rpc },
}));

import { createReceivingDocument } from '../../src/services/receivingService.js';

const phaseDocumentPath = path.resolve(
  process.cwd(),
  'docs/23U_RECEIVING_SAVE_DRAFT_RPC_NOT_CALLED_AND_ERROR_DETECTION_FIX.md',
);

describe('Phase 23U receiving save draft RPC and UAT error detection fix', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('documents the blocker, fix, and operational safety boundaries', () => {
    expect(fs.existsSync(phaseDocumentPath)).toBe(true);
    const content = fs.readFileSync(phaseDocumentPath, 'utf8');

    expect(content).toContain('Save draft RPC called: false');
    expect(content).toContain('tgd_rpc_create_receiving_draft');
    expect(content).toContain('RPC returns `uuid`');
    expect(content).toContain('Diagnostics are version **23U**');
    expect(content).toContain('RPC error: None');
    expect(content).toContain('`DRAFT_ID_MISSING` remains **BLOCKED**');
    expect(content).toContain('No direct insert into `tgd_receiving_documents`');
    expect(content).toContain('No direct stock update');
    expect(content).toContain('No movement ledger bypass');
    expect(content).toContain('Production remains **HOLD**');
    expect(content).toContain('**FINAL GO is NOT AUTHORIZED**');
  });

  it('calls the receiving draft RPC and normalizes a direct UUID response', async () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    rpc.mockResolvedValue({ data: uuid, error: null });

    const result = await createReceivingDocument({
      customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      document_no: 'UAT-DOC-23U',
    });

    expect(rpc).toHaveBeenCalledWith('tgd_rpc_create_receiving_draft', {
      p_customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      p_document_no: 'UAT-DOC-23U',
    });
    expect(result.data).toEqual({ id: uuid, document_id: uuid });
    expect(result.diagnostics).toMatchObject({
      rpcCalled: true,
      rpcName: 'tgd_rpc_create_receiving_draft',
      rawResponseType: 'string',
      normalizedDocumentId: uuid,
      errorMessage: null,
    });
  });

  it('exposes RPC errors safely after an attempted call', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for function' },
    });

    const result = await createReceivingDocument({
      customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      document_no: 'UAT-DOC-ERROR',
    });

    expect(result.diagnostics.rpcCalled).toBe(true);
    expect(result.diagnostics.errorMessage).toBe('permission denied for function');
  });

  it('ignores None RPC diagnostics but still detects actual RPC errors', () => {
    expect(detectUatErrors('Save draft RPC error: None', '/receiving').errors).toEqual([]);
    expect(detectUatErrors('RPC error: None', '/receiving').errors).toEqual([]);

    const actual = detectUatErrors(
      'Save draft RPC error: permission denied',
      '/receiving',
    );
    expect(actual.errors.some((error) => error.includes('error:'))).toBe(true);
  });
});
