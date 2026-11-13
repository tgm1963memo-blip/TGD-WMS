import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  getR3VehicleRegistration,
  isVehicleRegistrationMismatch,
  normalizeVehicleRegistration,
} from '../../src/utils/vehicleRegistrationUtils.js';
import { VehicleRegistrationControl } from '../../src/components/customer/WorkPhaseTimeControl.jsx';

describe('vehicle registration ร.3 comparison', () => {
  it('normalises spacing, hyphens, dots, case and Thai digits', () => {
    expect(normalizeVehicleRegistration('81-5480')).toBe('815480');
    expect(normalizeVehicleRegistration(' 81 5480 ')).toBe('815480');
    expect(normalizeVehicleRegistration('๘๑-๕๔๘๐')).toBe('815480');
    expect(normalizeVehicleRegistration('1กข 1234 กทม.')).toBe('1กข1234กทม');
    expect(normalizeVehicleRegistration(null)).toBe('');
  });

  it('only flags a real difference against the ร.3 plate', () => {
    expect(isVehicleRegistrationMismatch('81 5480', '81-5480')).toBe(false);
    expect(isVehicleRegistrationMismatch('82-1111', '81-5480')).toBe(true);
    expect(isVehicleRegistrationMismatch('', '81-5480')).toBe(true);
    expect(isVehicleRegistrationMismatch('82-1111', null)).toBe(false);
  });

  it('uses the declared snapshot as the ร.3 plate once staff have edited', () => {
    expect(getR3VehicleRegistration({ vehicle_registration: '81-5480' })).toBe('81-5480');
    expect(getR3VehicleRegistration({ vehicle_registration: '82-1111', declared_vehicle_registration: '81-5480', vehicle_registration_set_at: '2026-11-13T00:00:00Z' })).toBe('81-5480');
    // Customer declared no plate: a staff edit must never become the ร.3 plate.
    expect(getR3VehicleRegistration({ vehicle_registration: '82-1111', declared_vehicle_registration: null, vehicle_registration_set_at: '2026-11-13T00:00:00Z' })).toBeNull();
  });
});

describe('VehicleRegistrationControl', () => {
  it('warns before saving a plate that differs from the ร.3, but still saves', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <VehicleRegistrationControl
        label="ทะเบียนรถ" value="81-5480" r3Plate="81-5480" hasR3 canWrite onSave={onSave}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขทะเบียนรถ' }));
    fireEvent.change(screen.getByTestId('vehicle-registration-input'), { target: { value: '82-1111' } });
    expect(screen.getByRole('alert').textContent).toContain('ไม่ตรงกับทะเบียนรถในเอกสาร ร.3 (81-5480)');
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('82-1111', ''));
  });

  it('shows a persistent warning on a mismatched saved plate only when the document has a ร.3', () => {
    const { rerender } = render(
      <VehicleRegistrationControl label="ทะเบียนรถ" value="82-1111" r3Plate="81-5480" hasR3 canWrite={false} onSave={vi.fn()} />,
    );
    expect(screen.getByRole('alert').textContent).toContain('81-5480');
    rerender(
      <VehicleRegistrationControl label="ทะเบียนรถ" value="82-1111" r3Plate="81-5480" hasR3={false} canWrite={false} onSave={vi.fn()} />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
