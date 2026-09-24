import { describe, expect, it } from 'vitest';
import {
  IMAGE_MAX_EDGE,
  IMAGE_MIN_COMPRESS_BYTES,
  compressFileForUpload,
  getScaledDimensions,
  shouldCompressFile,
  toJpegFileName,
} from '../../src/utils/fileCompression.js';

describe('fileCompression', () => {
  it('only compresses large raster images', () => {
    expect(shouldCompressFile({ type: 'image/png', size: IMAGE_MIN_COMPRESS_BYTES })).toBe(true);
    expect(shouldCompressFile({ type: 'image/jpeg', size: 1000 })).toBe(false);
    expect(shouldCompressFile({ type: 'application/pdf', size: 5_000_000 })).toBe(false);
    expect(shouldCompressFile({ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 5_000_000 })).toBe(false);
  });

  it('scales the long edge down and keeps aspect ratio', () => {
    expect(getScaledDimensions(4800, 3600)).toEqual({ width: IMAGE_MAX_EDGE, height: 1800 });
    expect(getScaledDimensions(3000, 6000)).toEqual({ width: 1200, height: IMAGE_MAX_EDGE });
    expect(getScaledDimensions(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it('renames converted files to .jpg', () => {
    expect(toJpegFileName('ร3 สแกน.png')).toBe('ร3 สแกน.jpg');
    expect(toJpegFileName('photo')).toBe('photo.jpg');
  });

  it('returns non-image files unchanged', async () => {
    const pdf = new File(['%PDF-1.4'], 'r3.pdf', { type: 'application/pdf' });
    expect(await compressFileForUpload(pdf)).toBe(pdf);
  });
});
