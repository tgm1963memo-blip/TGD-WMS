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

const documentPath = path.resolve(
  process.cwd(),
  'docs/23V_UAT_ERROR_FALSE_POSITIVE_AND_NULL_DRAFT_RPC_RESPONSE.md',
);

describe('Phase 23V UAT error detection and null draft RPC diagnostics', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('documents the false positive, response states, and safety boundaries', () => {
    expect(fs.existsSync(documentPath)).toBe(true);
    const content = fs.readFileSync(documentPath, 'utf8');

    expect(content).toContain('`Save draft RPC error: None`');
    expect(content).toContain('Real RPC errors are still detected');
    expect(content).toContain('null or');
    expect(content).toContain('undefined');
    expect(content).toContain('direct UUID');
    expect(content).toContain('`DRAFT_ID_MISSING` remains **BLOCKED**');
    expect(content).toContain('No direct insert into `tgd_receiving_documents`');
    expect(content).toContain('No direct stock update');
    expect(content).toContain('No movement ledger bypass');
    expect(content).toContain('Production remains **HOLD**');
    expect(content).toContain('**FINAL GO is NOT AUTHORIZED**');
  });

  it('filters safe None lines but preserves real RPC errors', () => {
    const safeBody = [
      'Diagnostic version: 23V',
      'Save draft RPC error: None',
      'RPC error: None',
      'Production remains HOLD',
      'FINAL GO is NOT AUTHORIZED',
    ].join('\n');

    const safeDetection = detectUatErrors(safeBody, '/operations/receiving/create');
    expect(safeDetection.errors).toEqual([]);
    expect(safeDetection.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Production remains HOLD'),
      expect.stringContaining('FINAL GO is NOT AUTHORIZED'),
    ]));

    const real = detectUatErrors(
      'Save draft RPC error: invalid input syntax for type uuid',
      '/operations/receiving/create',
    );
    expect(real.errors.some((error) => error.includes('error:'))).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('reports %s response without creating a fake draft id', async (expectedType, data) => {
    rpc.mockResolvedValue({ data, error: null });

    const result = await createReceivingDocument({
      customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      document_no: `UAT-DOC-${expectedType}`,
    });

    expect(result.data).toBeNull();
    expect(result.error.message).toContain('DRAFT_ID_MISSING');
    expect(result.diagnostics).toMatchObject({
      rpcCalled: true,
      rawResponseType: expectedType,
      rawResponsePreview: 'None',
      normalizedDocumentId: null,
      errorMessage: 'DRAFT_ID_MISSING',
    });
  });

  it('continues to normalize a direct UUID response', async () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    rpc.mockResolvedValue({ data: uuid, error: null });

    const result = await createReceivingDocument({
      customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      document_no: 'UAT-DOC-UUID',
    });

    expect(result.data).toEqual({ id: uuid, document_id: uuid });
    expect(result.diagnostics).toMatchObject({
      rawResponseType: 'string',
      normalizedDocumentId: uuid,
      errorMessage: null,
    });
  });
});
