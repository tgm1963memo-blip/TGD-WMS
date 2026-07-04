import { describe, expect, it, vi, afterEach } from 'vitest';
import { printWithOrientation } from '../../src/components/reports/ReportPreviewModal.jsx';

describe('printWithOrientation', () => {
  afterEach(() => {
    document.title = '';
    vi.restoreAllMocks();
  });

  it('sets document.title to the document number (before " — ") during print, then restores it', () => {
    document.title = 'TGC WMS';
    let titleDuringPrint;
    vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title;
    });

    printWithOrientation('portrait', 'OB-20260704-015615 — ใบงานพนักงาน');

    expect(titleDuringPrint).toBe('OB-20260704-015615');
    expect(document.title).toBe('TGC WMS');
  });

  it('uses the whole title when there is no " — " separator', () => {
    document.title = 'TGC WMS';
    let titleDuringPrint;
    vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title;
    });

    printWithOrientation('portrait', 'CWR-20260703-0002');

    expect(titleDuringPrint).toBe('CWR-20260703-0002');
  });

  it('strips characters that are invalid in Windows filenames', () => {
    document.title = 'TGC WMS';
    let titleDuringPrint;
    vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title;
    });

    printWithOrientation('portrait', 'DOC:2026/07*04?');

    expect(titleDuringPrint).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('leaves document.title untouched when no title is given', () => {
    document.title = 'TGC WMS';
    vi.spyOn(window, 'print').mockImplementation(() => {});

    printWithOrientation('portrait');

    expect(document.title).toBe('TGC WMS');
  });
});
