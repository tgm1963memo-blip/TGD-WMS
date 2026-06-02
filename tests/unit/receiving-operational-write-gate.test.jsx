import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ReceivingCreatePage } from '../../src/features/operations/receiving/ReceivingCreatePage.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn(async () => ({ data: [], error: null })),
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
    expect(source).toContain('การสร้างเอกสารรับเข้าใหม่ยังถูกล็อกอยู่ระหว่าง Operational Write Gate');
  });

  it('Receiving list renders read-only locked message without active create draft link', async () => {
    render(
      <MemoryRouter>
        <ReceivingListPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('การสร้างเอกสารรับเข้าใหม่ยังถูกล็อกอยู่ระหว่าง Operational Write Gate')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create draft/i })).not.toBeInTheDocument();
  });

  it('Receiving create page is a locked gate page', () => {
    render(
      <MemoryRouter>
        <ReceivingCreatePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Receiving Create Locked' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operational write is locked' })).toBeInTheDocument();
    expect(screen.getByText('Controlled write passed in 13J-H')).toBeInTheDocument();
    expect(screen.getByText('Next approval required before enabling real receiving')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to receiving' })).toHaveAttribute('href', '/operations/receiving');
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
  });

  it('Receiving create page does not import or call receiving write functions', () => {
    const source = readSource(createPagePath);

    expect(source).not.toContain('createReceivingDocument');
    expect(source).not.toContain('updateReceivingDocument');
    expect(source).not.toContain('postReceivingDocument');
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.rpc\s*\(/);
  });

  it('Receiving service direct write functions remain detected as locked risk only', () => {
    const source = readSource(receivingServicePath);

    expect(source).toContain('createReceivingDocument');
    expect(source).toMatch(/\.insert\s*\(/);
    expect(source).toContain('updateReceivingDocument');
    expect(source).toMatch(/\.update\s*\(/);
    expect(source).toContain('postReceivingDocument');
    expect(source).toMatch(/\.rpc\s*\(\s*'tgd_post_receiving_document'/);
  });

  it('Receiving gate source has no private key or production env references', () => {
    const combinedSource = `${readSource(listPagePath)}\n${readSource(createPagePath)}`;

    expect(combinedSource).not.toMatch(/service_role/i);
    expect(combinedSource).not.toMatch(/SERVICE_ROLE/);
    expect(combinedSource).not.toMatch(/production/i);
    expect(combinedSource).not.toMatch(/VITE_SUPABASE_SERVICE/i);
  });
});
