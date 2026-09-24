// Client-side shrinking of files before they go to Supabase Storage.
//
// Only raster images are re-encoded: they are resized so the long edge is at
// most IMAGE_MAX_EDGE px (an A4 scan/photo at that size is still ~280 dpi, so
// text and stamps stay sharp) and saved as JPEG at IMAGE_QUALITY. PDF and
// Office files are uploaded untouched — Office formats are already zip
// compressed, and recompressing a PDF in the browser would mean rasterising
// it (losing selectable text), which is worse than the size saving.

export const IMAGE_MAX_EDGE = 2400;
export const IMAGE_QUALITY = 0.85;
// Below this the saving isn't worth the re-encode.
export const IMAGE_MIN_COMPRESS_BYTES = 300 * 1024;

const COMPRESSIBLE_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp'];

export function isCompressibleImage(file) {
  return COMPRESSIBLE_IMAGE_TYPES.includes(String(file?.type || '').toLowerCase());
}

export function shouldCompressFile(file) {
  return isCompressibleImage(file) && Number(file?.size ?? 0) >= IMAGE_MIN_COMPRESS_BYTES;
}

export function getScaledDimensions(width, height, maxEdge = IMAGE_MAX_EDGE) {
  const longEdge = Math.max(width, height);
  if (!longEdge || longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function toJpegFileName(name) {
  const base = String(name || 'image').replace(/\.[^./\\]+$/, '');
  return `${base || 'image'}.jpg`;
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    // 'from-image' applies EXIF rotation so phone photos aren't sideways.
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressFileForUpload(file) {
  if (!shouldCompressFile(file) || typeof document === 'undefined') return file;

  try {
    const image = await decodeImage(file);
    const sourceWidth = image.width || image.naturalWidth;
    const sourceHeight = image.height || image.naturalHeight;
    const { width, height } = getScaledDimensions(sourceWidth, sourceHeight);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG has no alpha — paint white so transparent PNG areas don't turn black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);
    image.close?.();

    const blob = await canvasToBlob(canvas, 'image/jpeg', IMAGE_QUALITY);
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], toJpegFileName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified ?? Date.now(),
    });
  } catch {
    // Undecodable image — upload the original rather than block the user.
    return file;
  }
}
