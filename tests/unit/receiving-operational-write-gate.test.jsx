import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ReceivingCreatePage } from '../../src/features/operations/receiving/ReceivingCreatePage.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
  createReceivingDocument: vi.fn(async () => ({ data: { id: 'draft-1', document_id: 'draft-1' }, error: null })),
  addReceivingLine: vi.fn(async () => ({ data: 'line-1', error: null })),
  postReceivingDocument: vi.fn(async () => ({ data: { status: 'CONFIRMED' }, error: null })),
  getReceivingCustomers: vi.fn(async () => ({ data: [], error: null })),
  getReceivingProducts: vi.fn(async () => ({ data: [], error: null })),
  getReceivingLots: vi.fn(async () => ({ data: [], error: null })),
  getReceivingLocations: vi.fn(async () => ({ data: [], error: null })),
  getReceivingWarehouses: vi.fn(async () => ({ data: [], error: null })),
}));

const projectRoot = resolve(__dirname, '../..');
const listPagePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingListPage.jsx');
const createPagePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx');
const detailPagePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingDetailPage.jsx');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');

function readSource(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-AI receiving operational write gate', () => {
  it('Receiving list links to controlled draft page with updated status message', () => {
    const source = readSource(listPagePath);

    expect(source).not.toContain('createHref="/operations/receiving/new"');
    expect(source).toContain('createHref={canWrite ? "/operations/receiving/create" : null}');
    expect(source).toContain('createLabel={canWrite ? "Create Receiving Draft" : null}');
    // Confirm/Post is no longer locked – message must reflect RPC availability
    expect(source).toContain('Confirm/Post is available on draft page via RPC');
    expect(source).not.toContain('Confirm/Post remains locked');
  });

  it('Receiving list renders controlled draft navigation with RPC status', async () => {
    render(
      <MemoryRouter>
        <ReceivingListPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Receiving creation is controlled draft mode only. Confirm/Post is available on draft page via RPC.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Receiving Draft' })).toHaveAttribute(
      'href',
      '/operations/receiving/create',
    );
  });

  it('Receiving create page keeps Confirm/Post hidden until draft exists', async () => {
    render(
      <MemoryRouter>
        <ReceivingCreatePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Controlled receiving draft mode' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Customer')).toBeInTheDocument();
    expect(screen.getByLabelText('Document No')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getByText('Controlled Confirm/Post')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm/Post Receiving' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to receiving' })).toHaveAttribute('href', '/operations/receiving');
    expect(screen.queryByRole('button', { name: /^Confirm$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Post$/i })).not.toBeInTheDocument();
  });

  it('Receiving create page uses postReceivingDocument wrapper and no direct RPC or DML', () => {
    const source = readSource(createPagePath);

    // Allowed: import postReceivingDocument from service wrapper
    expect(source).toContain('createReceivingDocument');
    expect(source).toContain('addReceivingLine');
    expect(source).toContain('postReceivingDocument');
    // Forbidden: direct RPC string in UI component
    expect(source).not.toContain('tgd_rpc_post_receiving_document');
    // Forbidden: supabase.from in UI
    expect(source).not.toContain('supabase.from');
    // Forbidden: direct DML
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
    // Forbidden: direct .rpc call in UI
    expect(source).not.toMatch(/\.rpc\s*\(/);
    // Forbidden: stock table references
    expect(source).not.toContain('tgd_stock_movements');
    expect(source).not.toContain('tgd_stock_balances');
    // Forbidden: updateReceivingDocument (still locked)
    expect(source).not.toContain('updateReceivingDocument');
  });

  it('ReceivingDetailPage uses postReceivingDocument wrapper and no direct RPC or DML', () => {
    const source = readSource(detailPagePath);

    // Allowed: import postReceivingDocument from service wrapper
    expect(source).toContain('postReceivingDocument');
    // Forbidden: direct RPC string in UI component
    expect(source).not.toContain('tgd_rpc_post_receiving_document');
    // Forbidden: supabase.from in UI
    expect(source).not.toContain('supabase.from');
    // Forbidden: direct DML
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
    // Forbidden: direct .rpc call in UI
    expect(source).not.toMatch(/\.rpc\s*\(/);
    // Forbidden: stock table references
    expect(source).not.toContain('tgd_stock_movements');
    expect(source).not.toContain('tgd_stock_balances');
  });

  it('receivingService.postReceivingDocument uses tgd_rpc_post_receiving_document with p_document_id', () => {
    const source = readSource(receivingServicePath);

    expect(source).toContain('postReceivingDocument');
    expect(source).toContain('tgd_rpc_post_receiving_document');
    expect(source).toContain('p_document_id: id');
  });

  it('receivingService has no direct DML', () => {
    const source = readSource(receivingServicePath);

    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
  });

  it('receivingService write wrappers are RPC-only', () => {
    const source = readSource(receivingServicePath);

    expect(source).toContain('createReceivingDocument');
    expect(source).toContain('tgd_rpc_create_receiving_draft');
    expect(source).toContain('p_document_no: input.document_no');
    expect(source).not.toContain('p_reference');
    expect(source).toContain('updateReceivingDocument');
    expect(source).toContain('tgd_rpc_add_receiving_line');
    expect(source).toContain('p_location_id: input.location_id');
  });

  it('Receiving gate source has no private key or production env references', () => {
    const combinedSource = `${readSource(listPagePath)}\n${readSource(createPagePath)}\n${readSource(detailPagePath)}`;

    expect(combinedSource).not.toMatch(/service_role/i);
    expect(combinedSource).not.toMatch(/SERVICE_ROLE/);
    expect(combinedSource).not.toMatch(/VITE_SUPABASE_SERVICE/i);
    expect(combinedSource).not.toMatch(/NODE_ENV\s*===\s*['"]production['"]/);
    expect(combinedSource).not.toMatch(/import\.meta\.env\.PROD/);
  });
});
