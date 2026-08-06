import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportFilterPanel } from '../../src/components/reports/ReportFilterPanel.jsx';

// Every field in ReportFilterPanel used to render unconditionally
// regardless of whether the report page's own service actually read it —
// e.g. Storage Aging (a current-stock snapshot with no date-range query
// at all — see storageAgingReportService.js) rendered Date From/To,
// ประเภทเอกสาร, Location, อุณหภูมิ, Warehouse, and Reference Type anyway,
// none of which it ever consumed. Filling one in silently did nothing,
// which reads as "this report ignores my filter," not just clutter.
// showDateRange/showProduct/showLocation/showTemperature/showWarehouse/
// showReferenceType let a page opt out of the fields it genuinely never
// uses; default true everywhere so an unmigrated caller's behavior is
// unchanged.

describe('ReportFilterPanel field opt-outs default to showing everything (unchanged behavior)', () => {
  it('renders every field by default', () => {
    render(<ReportFilterPanel onChange={() => {}} />);
    expect(screen.getByText('Date From')).toBeInTheDocument();
    expect(screen.getByText('Date To')).toBeInTheDocument();
    expect(screen.getByText('ประเภทเอกสาร')).toBeInTheDocument();
    expect(screen.getByText('สินค้า')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('อุณหภูมิ')).toBeInTheDocument();
    expect(screen.getByText('Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Reference Type')).toBeInTheDocument();
  });
});

describe('ReportFilterPanel omits fields a report never reads, when opted out', () => {
  it('hides every unused field for a Storage-Aging-shaped config', () => {
    render(
      <ReportFilterPanel
        onChange={() => {}}
        showLotNo
        showDateRange={false}
        showMovementType={false}
        showLocation={false}
        showTemperature={false}
        showWarehouse={false}
        showReferenceType={false}
      />,
    );
    expect(screen.queryByText('Date From')).not.toBeInTheDocument();
    expect(screen.queryByText('Date To')).not.toBeInTheDocument();
    expect(screen.queryByText('ประเภทเอกสาร')).not.toBeInTheDocument();
    expect(screen.queryByText('Location')).not.toBeInTheDocument();
    expect(screen.queryByText('อุณหภูมิ')).not.toBeInTheDocument();
    expect(screen.queryByText('Warehouse')).not.toBeInTheDocument();
    expect(screen.queryByText('Reference Type')).not.toBeInTheDocument();
    // Still-relevant fields stay.
    expect(screen.getByText('ลูกค้า')).toBeInTheDocument();
    expect(screen.getByText('สินค้า')).toBeInTheDocument();
    expect(screen.getByText('Lot สินค้า')).toBeInTheDocument();
  });

  it('hides สินค้า when showProduct is false', () => {
    render(<ReportFilterPanel onChange={() => {}} showProduct={false} />);
    expect(screen.queryByText('สินค้า')).not.toBeInTheDocument();
  });
});
