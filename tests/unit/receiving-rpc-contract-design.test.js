import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');
const contractPath = resolve(projectRoot, 'docs/13J-J_RECEIVING_RPC_CONTRACT.md');
const receivingGateTestPath = resolve(projectRoot, 'tests/unit/receiving-operational-write-gate.test.jsx');
const receivingDetailPath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingDetailPage.jsx');

function readProjectFile(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-J receiving RPC contract design', () => {
  it('creates the receiving RPC contract design document', () => {
    expect(existsSync(contractPath)).toBe(true);
  });

  it('states the current Receiving UI remains locked', () => {
    const contract = readProjectFile(contractPath);

    expect(contract).toContain('The current Receiving UI remains locked');
    expect(contract).toContain('must remain an Operational Write Gate page only');
    expect(contract).toContain('does not enable Receiving write behavior');
  });

  it('does not approve the missing legacy receiving post RPC for use', () => {
    const contract = readProjectFile(contractPath);

    expect(contract).toContain('tgd_post_receiving_document');
    expect(contract).toContain('is not approved for use');
  });

  it('requires an RPC-only write flow with traceability', () => {
    const contract = readProjectFile(contractPath);

    expect(contract).toContain('RPC-only');
    expect(contract).toContain('tgd_rpc_create_receiving_draft');
    expect(contract).toContain('tgd_rpc_add_receiving_line');
    expect(contract).toContain('tgd_rpc_confirm_receiving_document');
    expect(contract).toContain('reference');
    expect(contract).toContain('created_by');
    expect(contract).toContain('auth.uid()');
  });

  it('requires customer isolation and receiving line RLS before write enablement', () => {
    const contract = readProjectFile(contractPath);

    expect(contract).toContain('Customer isolation');
    expect(contract).toContain('customer-owned inventory');
    expect(contract).toContain('tgd_receiving_lines RLS');
    expect(contract).toContain('must exist, be enabled, and be evidenced');
  });

  it('requires future stock movement RPC to accept product, lot, and location fields', () => {
    const contract = readProjectFile(contractPath);

    expect(contract).toContain('p_product_id uuid');
    expect(contract).toContain('p_lot_id uuid');
    expect(contract).toContain('p_target_location_id uuid');
    expect(contract).toContain('must not derive `product_id` or `lot_id` from an existing stock balance');
  });

  it('keeps service role usage disallowed rather than allowed', () => {
    const contract = readProjectFile(contractPath);

    expect(contract).toContain('No service_role key is allowed');
    expect(contract).not.toMatch(/service_role\s+(is\s+)?allowed/i);
    expect(contract).not.toMatch(/allow\s+service_role/i);
  });

  it('keeps the existing receiving operational gate test and detail page post wrapper in place', () => {
    const gateTest = readProjectFile(receivingGateTestPath);
    const receivingDetail = readProjectFile(receivingDetailPath);

    expect(gateTest).toContain('Receiving operational write gate (customer deposit driven)');
    expect(receivingDetail).toContain('postReceivingDocument');
    expect(receivingDetail).toContain('Confirm/Post Receiving');
    expect(receivingDetail).toContain('No stock movement until Confirm/Post');
    expect(receivingDetail).not.toContain('tgd_rpc_post_receiving_document');
  });
});
