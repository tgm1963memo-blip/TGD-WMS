import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const listMock = vi.fn();
const downloadMock = vi.fn();

vi.mock('../../src/services/customerDocumentAttachmentService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listCustomerDocumentAttachments: (...args) => listMock(...args),
    downloadCustomerDocumentAttachment: (...args) => downloadMock(...args),
  };
});

import { describeAttachmentUploader } from '../../src/services/customerDocumentAttachmentService.js';
import { R3AttachmentDownloadPanel } from '../../src/components/customer/R3AttachmentDownloadPanel.jsx';

describe('R3 attachment download', () => {
  beforeEach(() => {
    listMock.mockReset();
    downloadMock.mockReset();
  });

  it('labels customer uploads by email and staff uploads as TGC', () => {
    expect(describeAttachmentUploader({ uploaded_by_email: 'a@cust.co' })).toBe('ลูกค้า (a@cust.co)');
    expect(describeAttachmentUploader({ uploaded_by_email: null })).toBe('TGC');
  });

  it('lists both TGC and customer ร.3 files and downloads the chosen one', async () => {
    const tgcFile = { id: 't1', file_name: 'r3-tgc.pdf', file_size_bytes: 2048, uploaded_by_email: null, storage_path: 'c/x/t1.pdf' };
    const customerFile = { id: 'c1', file_name: 'r3-cust.pdf', file_size_bytes: 1024, uploaded_by_email: 'a@cust.co', storage_path: 'c/x/c1.pdf' };
    listMock.mockResolvedValue({ data: [tgcFile, customerFile], error: null });
    downloadMock.mockResolvedValue({ data: 'url', error: null });

    render(<R3AttachmentDownloadPanel documentId="wd-1" />);

    await waitFor(() => expect(screen.getByText(/r3-tgc\.pdf/)).toBeInTheDocument());
    expect(listMock).toHaveBeenCalledWith('CUSTOMER_WITHDRAWAL_REQUEST', 'wd-1');
    expect(screen.getByText(/r3-cust\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/อัปโหลดโดย TGC/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('r3-attachment-download-button')[0]);
    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith(tgcFile));
  });

  it('renders nothing when there are no files and ร.3 is not required', async () => {
    listMock.mockResolvedValue({ data: [], error: null });
    const { container } = render(<R3AttachmentDownloadPanel documentId="wd-2" />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="r3-attachment-download-panel"]')).toBeNull();
  });
});
