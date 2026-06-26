import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(content).toContain('Diagnostics are version **23U**');
    expect(content).toContain('No direct stock update');
    expect(content).toContain('Production remains **HOLD**');
    expect(content).toContain('**FINAL GO is NOT AUTHORIZED**');
  });

  it('returns locked standalone draft error without calling RPC', async () => {
    const result = await createReceivingDocument({
      customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      document_no: 'UAT-DOC-23U',
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
    expect(result.error.message).toContain('Standalone receiving draft creation was removed');
    expect(result.diagnostics).toMatchObject({
      rpcCalled: false,
      rpcName: 'tgd_rpc_create_receiving_draft',
      normalizedDocumentId: null,
    });
  });

  it('keeps diagnostics shape for blocked draft creation', async () => {
    const result = await createReceivingDocument({
      customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      document_no: 'UAT-DOC-ERROR',
    });

    expect(result.diagnostics.rpcCalled).toBe(false);
    expect(result.diagnostics.errorMessage).toContain('Standalone receiving draft UI removed');
  });
});
