import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { DEFAULT_LANGUAGE, TRANSLATION_CATALOG } from '../../src/i18n/translationCatalog.js';
import LanguageToggle from '../../src/components/common/LanguageToggle.jsx';
import { DocumentFilterBar } from '../../src/components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../src/components/operations/DocumentToolbar.jsx';
import { DraftLineEditor } from '../../src/components/operations/DraftLineEditor.jsx';
import { ReceivingPage } from '../../src/features/receiving/ReceivingPage.jsx';

const requiredOperationKeys = [
  'warehouse_operations',
  'receiving',
  'receiving_list',
  'receiving_detail',
  'create_receiving',
  'putaway',
  'putaway_list',
  'putaway_task',
  'transfer',
  'transfer_list',
  'create_transfer',
  'adjustment',
  'adjustment_list',
  'create_adjustment',
  'stock_count',
  'stock_count_list',
  'create_stock_count',
  'customer_withdrawal',
  'withdrawal_request',
  'withdrawal_list',
  'allocation',
  'allocation_list',
  'picking',
  'picking_list',
  'picking_task',
  'dispatch_goods_issue',
  'dispatch_list',
  'goods_issue',
  'scan_barcode',
  'scan_pallet',
  'scan_location',
  'scan_lot',
  'source_location',
  'destination_location',
  'requested_qty',
  'picked_qty',
  'dispatched_qty',
  'available_qty',
  'reserved_qty',
  'pending',
  'completed',
  'cancelled',
  'draft',
  'in_progress',
  'review_required',
  'operation_status',
  'created_by',
  'assigned_to',
  'updated_by',
  'operation_date',
  'reference_no',
  'document_no',
  'customer_owned_inventory',
  'no_operation_data',
  'select_customer',
  'select_product',
  'confirm_action',
  'operation_note',
];

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <LanguageProvider>{ui}</LanguageProvider>
    </MemoryRouter>
  );
}

describe('Sprint 12E warehouse operation UI polish', () => {
  it('keeps Thai as the default language and language toggle available', () => {
    expect(DEFAULT_LANGUAGE).toBe('th');

    renderWithProviders(<LanguageToggle />);

    expect(screen.getByLabelText('Current language')).toHaveTextContent('ไทย');
  });

  it('contains Thai and English operation translation keys', () => {
    for (const key of requiredOperationKeys) {
      expect(TRANSLATION_CATALOG[key], key).toBeTruthy();
      expect(TRANSLATION_CATALOG[key].th, `${key}.th`).toBeTruthy();
      expect(TRANSLATION_CATALOG[key].en, `${key}.en`).toBeTruthy();
    }
  });

  it('renders Thai-first operation filters and toolbar controls', () => {
    renderWithProviders(
      <>
        <DocumentToolbar title="รายการงานคลังสินค้า" createHref="/operations/receiving/new" onRefresh={() => {}} />
        <DocumentFilterBar onChange={() => {}} />
      </>
    );

    expect(screen.getByText('สร้างแบบร่าง')).toBeInTheDocument();
    expect(screen.getByText('รีเฟรช')).toBeInTheDocument();
    expect(screen.getByText('ค้นหา')).toBeInTheDocument();
    expect(screen.getByText('สถานะ')).toBeInTheDocument();
  });

  it('renders draft line editor with operation fields and no persistence actions', () => {
    renderWithProviders(<DraftLineEditor />);

    expect(screen.getByText('รายการแบบร่าง')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('สินค้า')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
  });

  it('renders a polished receiving operation page with modern layout components', () => {
    renderWithProviders(<ReceivingPage />);

    expect(screen.getByRole('heading', { name: 'รับสินค้าเข้า' })).toBeInTheDocument();
    expect(screen.getByText('สินค้าคงคลังของลูกค้า')).toBeInTheDocument();
    expect(screen.getByText('สแกนบาร์โค้ด')).toBeInTheDocument();
  });
});
