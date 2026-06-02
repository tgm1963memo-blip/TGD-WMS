import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ReceivingCreatePage } from '../../src/features/operations/receiving/ReceivingCreatePage.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
  createReceivingDocument: vi.fn(async () => ({ data: 'draft-1', error: null })),
  addReceivingLine: vi.fn(async () => ({ data: 'line-1', error: null })),
}));

const projectRoot = resolve(__dirname, '../..');
const listPagePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingListPage.jsx');
const createPagePath = resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx');
const receivingServicePath = resolve(projectRoot, 'src/services/receivingService.js');

function readSource(path) {
  return readFileSync(path, 'utf8');
}

describe('Sprint 13J-I receiving operational write gate', () => {
  it('Receiving list does not expose active createHref to the receiving create route', () => {
    const source = readSource(listPagePath);

    expect(source).not.toContain('createHref="/operations/receiving/new"');
    expect(source).toContain('createHref="/operations/receiving/create"');
    expect(source).toContain('createLabel="Create Receiving Draft"');
    expect(source).toContain('Receiving creation is controlled draft mode only. Confirm/Post remains locked.');
  });

  it('Receiving list renders controlled draft navigation with post locked warning', async () => {
    render(
      <MemoryRouter>
        <ReceivingListPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Receiving creation is controlled draft mode only. Confirm/Post remains locked.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Receiving Draft' })).toHaveAttribute(
      'href',
      '/operations/receiving/create',
    );
  });

  it('Receiving create page is controlled draft only with Confirm/Post locked', () => {
    render(
      <MemoryRouter>
        <ReceivingCreatePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Controlled receiving draft mode' })).toBeInTheDocument();
    expect(screen.getByLabelText('Customer ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Document No')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getAllByText('Confirm/Post is still locked').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Back to receiving' })).toHaveAttribute('href', '/operations/receiving');
    expect(screen.queryByRole('button', { name: /^Confirm$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Post$/i })).not.toBeInTheDocument();
  });

  it('Receiving create page imports only controlled draft/add-line functions and no post/direct writes', () => {
    const source = readSource(createPagePath);

    expect(source).toContain('createReceivingDocument');
    expect(source).toContain('addReceivingLine');
    expect(source).not.toContain('updateReceivingDocument');
    expect(source).not.toContain('postReceivingDocument');
    expect(source).not.toContain('tgd_rpc_post_receiving_document');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
  });

  it('Receiving service write wrappers are RPC-only and direct table writes are removed', () => {
    const source = readSource(receivingServicePath);

    expect(source).toContain('createReceivingDocument');
    expect(source).toContain('tgd_rpc_create_receiving_draft');
    expect(source).toContain('p_document_no: input.document_no');
    expect(source).not.toContain('p_reference');
    expect(source).toContain('updateReceivingDocument');
    expect(source).toContain('postReceivingDocument');
    expect(source).toContain('tgd_rpc_post_receiving_document');
    expect(source).toContain('Posting receiving documents is disabled under controller HOLD');
    expect(source).toContain('tgd_rpc_add_receiving_line');
    expect(source).toContain('p_location_id: input.location_id');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/\.upsert\s*\(/);
  });

  it('Receiving gate source has no private key or production env references', () => {
    const combinedSource = `${readSource(listPagePath)}\n${readSource(createPagePath)}`;

    expect(combinedSource).not.toMatch(/service_role/i);
    expect(combinedSource).not.toMatch(/SERVICE_ROLE/);
    expect(combinedSource).not.toMatch(/production/i);
    expect(combinedSource).not.toMatch(/VITE_SUPABASE_SERVICE/i);
  });
});
