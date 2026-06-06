import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OutboundListPage } from '../../src/features/operations/outbound/OutboundListPage.jsx';

vi.mock('../../src/services/outboundPickingService.js', () => ({
  listOutboundDocuments: vi.fn(() => Promise.resolve([
    { id: '1', document_no: 'OUT-001', status: 'DRAFT', customer_id: 'CUST-A' },
  ])),
  getOutboundDocumentDetail: vi.fn(() => Promise.resolve({
    document: { id: '1', document_no: 'OUT-001', status: 'DRAFT' },
    lines: [],
    reservations: [],
  })),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <OutboundListPage />
    </MemoryRouter>
  );
}

describe('17D Outbound UI Polish', () => {
  it('Outbound UI renders without crashing', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Outbound Operations')).toBeInTheDocument();
    });
  });

  it('Outbound UI includes Outbound Operations or Outbound Picking', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Outbound Operations')).toBeInTheDocument();
    });
  });

  it('Outbound UI includes Draft', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    });
  });

  it('Outbound UI includes Reserved', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Reserved').length).toBeGreaterThan(0);
    });
  });

  it('Outbound UI includes Picked', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Picked').length).toBeGreaterThan(0);
    });
  });

  it('Outbound UI includes Posted', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Posted').length).toBeGreaterThan(0);
    });
  });

  it('Outbound UI includes workflow labels', async () => {
    renderPage();
    await waitFor(() => {
      const labels = ['Draft', 'Reserve', 'Pick', 'Post Outbound'];
      labels.forEach(label => {
        expect(screen.getByText(label, { selector: '.workflow-step-name' })).toBeInTheDocument();
      });
    });
  });

  it('Outbound UI includes Production remains HOLD', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Production remains HOLD')).toBeInTheDocument();
    });
  });

  it('Outbound UI includes FINAL GO: Apply Outbound migrations 025-030 to Production', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('FINAL GO: Apply Outbound migrations 025-030 to Production')).toBeInTheDocument();
    });
  });

  it('Outbound UI includes APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1')).toBeInTheDocument();
    });
  });

  it('Outbound UI includes Post Outbound feature gate remains OFF by default', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Post Outbound feature gate remains OFF by default.')).toBeInTheDocument();
    });
  });
});
