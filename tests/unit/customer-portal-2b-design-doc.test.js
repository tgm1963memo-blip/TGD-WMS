import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/CUSTOMER_PORTAL_2B_REAL_DATA_MODEL_DESIGN.md');

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

describe('CUSTOMER-PORTAL-2B real data model design document', () => {
  it('creates the design document', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it('documents source document principle and tables', () => {
    const doc = readDoc();

    expect(doc).toContain('Source document principle');
    expect(doc).toContain('tgd_customer_deposit_requests');
    expect(doc).toContain('tgd_customer_withdrawal_requests');
    expect(doc).toContain('tgd_customer_document_timeline_events');
    expect(doc).toContain('tgd_customer_document_attachments');
  });

  it('documents RLS, storage, and linkage recommendation', () => {
    const doc = readDoc();

    expect(doc).toContain('RLS design summary');
    expect(doc).toContain('tgd_current_user_customer_id()');
    expect(doc).toContain('customer-portal-attachments');
    expect(doc).toContain('Option 1');
    expect(doc).toContain('RECOMMENDED');
  });

  it('documents status transitions and implementation phases', () => {
    const doc = readDoc();

    expect(doc).toContain('RECEIVING_VARIANCE');
    expect(doc).toContain('WAREHOUSE_PICKING');
    expect(doc).toContain('2B');
    expect(doc).toContain('2D');
    expect(doc).toContain('2E');
    expect(doc).toContain('2F');
  });

  it('states design-only scope and prohibitions', () => {
    const doc = readDoc();

    expect(doc).toContain('design and migration draft only');
    expect(doc).toContain('not applied');
    expect(doc).toContain('No Gate 3B-5');
    expect(doc).toContain('Multi-admin');
  });
});
