import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const modalPath = path.join(process.cwd(), 'src/components/customer/CustomerDepositDetailModal.jsx');

describe('CustomerDepositDetailModal receiving time and temperature controls', () => {
  it('shows editable receiving start and finish controls in the modal', () => {
    const source = readFileSync(modalPath, 'utf8');

    expect(source).toContain('WorkPhaseTimeControl');
    expect(source).toContain('setDepositReceivingTime');
    expect(source).toContain('startedLabel="เริ่มลงสินค้า"');
    expect(source).toContain('finishedLabel="เสร็จสิ้นการลงสินค้า"');
    expect(source).toContain("handleRecordReceivingTime('START'");
    expect(source).toContain("handleRecordReceivingTime('FINISH'");
  });

  it('renders an editable temperature selector for deposit lines', () => {
    const source = readFileSync(modalPath, 'utf8');

    expect(source).toContain('DEPOSIT_LINE_TEMPERATURE_TYPES');
    expect(source).toContain('lineTemperatureTypes');
    expect(source).toContain('savingTemperatureType');
    expect(source).toContain('TEMPERATURE_TYPE_LABELS[type]');
    expect(source).toContain('temperatureType: nextTemperatureType');
    expect(source).toContain('<th style={{ whiteSpace: \'nowrap\' }}>อุณหภูมิ</th>');
  });
});
