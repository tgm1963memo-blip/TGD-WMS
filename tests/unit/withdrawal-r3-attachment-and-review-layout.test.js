import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const reviewPagePath = path.join(process.cwd(), 'src/features/customer/CustomerAdminWithdrawalReviewPage.jsx');
const createPagePath = path.join(process.cwd(), 'src/features/customer/CustomerWithdrawalRequestCreatePage.jsx');
const attachmentServicePath = path.join(process.cwd(), 'src/services/customerDocumentAttachmentService.js');
const migrationPath = path.join(process.cwd(), 'database/migrations/115_customer_document_attachment_storage.sql');
const stylesPath = path.join(process.cwd(), 'src/styles.css');

describe('withdrawal R.3 attachment and review line layout', () => {
  it('keeps the recount action compact so product names have room', () => {
    const source = readFileSync(reviewPagePath, 'utf8');
    const css = readFileSync(stylesPath, 'utf8');

    expect(source).toContain('admin-withdrawal-lines-table__product-cell');
    expect(source).toContain('admin-withdrawal-lines-table__recount-btn');
    expect(source).toContain('aria-label={t(\'admin_recount_button\')}');
    expect(source).toContain('นับใหม่');
    expect(css).toContain('.admin-withdrawal-lines-table__product-col { width: 260px; }');
    expect(css).toContain('.admin-withdrawal-lines-table__action-col { width: 76px; }');
  });

  it('renders withdrawal status filtering as an inline multi-select dropdown', () => {
    const source = readFileSync(reviewPagePath, 'utf8');
    const css = readFileSync(stylesPath, 'utf8');

    expect(source).toContain('statusFilterOpen');
    expect(source).toContain('withdrawal-review-status-dropdown-button');
    expect(source).toContain('withdrawal-review-status-dropdown-menu');
    expect(source).toContain('type="checkbox"');
    expect(source).not.toContain('withdrawal-review-status-chip-');
    expect(css).toContain('.withdrawal-review-status-filter__menu');
  });

  it('adds R.3 attachments to the withdrawal request form', () => {
    const source = readFileSync(createPagePath, 'utf8');
    const reviewSource = readFileSync(reviewPagePath, 'utf8');

    expect(source).toContain('uploadCustomerDocumentAttachments');
    expect(source).toContain('r3Attachments');
    expect(source).toContain('handleR3Attachments');
    expect(source).toContain('data-testid="customer-withdrawal-r3-attachment-input"');
    expect(source).toContain('updateHeaderField(\'requires_r3_document\', true)');
    expect(source).toContain("documentType: 'CUSTOMER_WITHDRAWAL_REQUEST'");
    expect(source).toContain('MAX_ATTACHMENT_SIZE');
    expect(source).not.toContain('customer_deposit_attachments_deferred_note');
    expect(reviewSource).toContain('admin-withdrawal-r3-attachment-input');
    expect(reviewSource).toContain('handleUploadR3Attachments');
  });

  it('persists customer document attachments through storage and metadata', () => {
    const service = readFileSync(attachmentServicePath, 'utf8');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(service).toContain('CUSTOMER_DOCUMENT_ATTACHMENT_BUCKET');
    expect(service).toContain('listCustomerDocumentAttachments');
    expect(service).toContain('.storage');
    expect(service).toContain(".from('tgd_customer_document_attachments')");
    expect(sql).toContain("insert into storage.buckets");
    expect(sql).toContain("'customer-portal-attachments'");
    expect(sql).toContain('tgd_customer_portal_attachments_insert');
  });
});
