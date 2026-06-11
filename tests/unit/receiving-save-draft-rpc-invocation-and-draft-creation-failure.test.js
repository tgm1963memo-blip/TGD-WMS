import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Phase 23T: Diagnose Receiving Save Draft RPC Invocation and Draft Creation Failure', () => {
  it('documentation exists and asserts core safety guarantees', () => {
    const docPath = path.resolve(process.cwd(), 'docs/23T_RECEIVING_SAVE_DRAFT_RPC_INVOCATION_AND_DRAFT_CREATION_FAILURE.md');
    const content = fs.readFileSync(docPath, 'utf8');

    expect(content).toContain('no new row was created in');
    expect(content).toContain('tgd_receiving_documents');
    expect(content).toContain('tgd_rpc_create_receiving_draft');
    expect(content).toContain('DRAFT_ID_MISSING');
    expect(content).toContain('BLOCKED');
    expect(content).toContain('No direct inserts into `tgd_receiving_documents` are made from the frontend');
    expect(content).toContain('No direct stock updates');
    expect(content).toContain('Production remains **HOLD**');
    expect(content).toContain('**FINAL GO is NOT AUTHORIZED**');
  });

  it('ReceivingCreatePage.jsx exposes 23T diagnostics', () => {
    const jsxPath = path.resolve(process.cwd(), 'src/features/operations/receiving/ReceivingCreatePage.jsx');
    const content = fs.readFileSync(jsxPath, 'utf8');

    expect(content).toContain('id="diagnostic-23t"');
    expect(content).toContain('Diagnostic version: 23T');
    expect(content).toContain('Save draft RPC called');
    expect(content).toContain('Save draft RPC error');
    expect(content).toContain('Normalized draft id');
  });

  it('receivingService.js createReceivingDocument returns diagnostics', () => {
    const jsPath = path.resolve(process.cwd(), 'src/services/receivingService.js');
    const content = fs.readFileSync(jsPath, 'utf8');

    expect(content).toContain('tgd_rpc_create_receiving_draft');
    expect(content).toContain('diagnostics: {');
    expect(content).toContain('rpcCalled');
    expect(content).toContain('rawResponseType');
  });
});
