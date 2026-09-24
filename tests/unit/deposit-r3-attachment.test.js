import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const modalPath = path.join(process.cwd(), 'src/components/customer/CustomerDepositDetailModal.jsx');
const servicePath = path.join(process.cwd(), 'src/services/customerDocumentAttachmentService.js');

describe('deposit (receiving) R.3 attachment', () => {
  it('lets staff upload and open R.3 files on the deposit detail modal', () => {
    const source = readFileSync(modalPath, 'utf8');
    expect(source).toContain('uploadCustomerDocumentAttachments');
    expect(source).toContain("listCustomerDocumentAttachments('CUSTOMER_DEPOSIT_REQUEST'");
    expect(source).toContain("documentType: 'CUSTOMER_DEPOSIT_REQUEST'");
    expect(source).toContain('data-testid="admin-deposit-r3-attachment-input"');
    expect(source).toContain('handleOpenR3Attachment');
  });

  it('exposes a signed URL helper for viewing private attachments', () => {
    const source = readFileSync(servicePath, 'utf8');
    expect(source).toContain('export async function getCustomerDocumentAttachmentUrl');
    expect(source).toContain('createSignedUrl');
  });
});
