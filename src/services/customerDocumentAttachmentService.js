import { supabase } from './supabaseClient.js';
import { missingSupabaseClientResult } from './customerPortalServiceUtils.js';
import { compressFileForUpload } from '../utils/fileCompression.js';

export const CUSTOMER_DOCUMENT_ATTACHMENT_BUCKET = 'customer-portal-attachments';

function sanitizeFileName(name) {
  const baseName = String(name || 'attachment')
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return baseName || 'attachment';
}

function buildStoragePath({ customerId, documentType, documentId, fileName }) {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${customerId}/${documentType}/${documentId}/${uniquePart}-${sanitizeFileName(fileName)}`;
}

export async function uploadCustomerDocumentAttachments({
  documentType,
  documentId,
  customerId,
  files,
  uploadedByUserId = null,
  uploadedByEmail = null,
} = {}) {
  if (!supabase) return missingSupabaseClientResult();
  if (!documentType || !documentId || !customerId) {
    return { data: [], error: new Error('Missing document attachment target.') };
  }

  const selectedFiles = Array.from(files ?? []);
  const uploadedRows = [];

  for (const originalFile of selectedFiles) {
    const file = await compressFileForUpload(originalFile);
    const storagePath = buildStoragePath({
      customerId,
      documentType,
      documentId,
      fileName: file.name,
    });

    const uploadResult = await supabase.storage
      .from(CUSTOMER_DOCUMENT_ATTACHMENT_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadResult.error) {
      return { data: uploadedRows, error: uploadResult.error };
    }

    const { data, error } = await supabase
      .from('tgd_customer_document_attachments')
      .insert({
        document_type: documentType,
        document_id: documentId,
        customer_id: customerId,
        file_name: file.name,
        file_mime_type: file.type || null,
        file_size_bytes: file.size ?? null,
        storage_bucket: CUSTOMER_DOCUMENT_ATTACHMENT_BUCKET,
        storage_path: storagePath,
        uploaded_by_user_id: uploadedByUserId,
        uploaded_by_email: uploadedByEmail,
        uploaded_at: new Date().toISOString(),
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) {
      await supabase.storage.from(CUSTOMER_DOCUMENT_ATTACHMENT_BUCKET).remove([storagePath]);
      return { data: uploadedRows, error };
    }

    uploadedRows.push(data);
  }

  return { data: uploadedRows, error: null };
}

export async function listCustomerDocumentAttachments(documentType, documentId) {
  if (!supabase) return missingSupabaseClientResult();
  if (!documentType || !documentId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('tgd_customer_document_attachments')
    .select('id, document_type, document_id, customer_id, file_name, file_mime_type, file_size_bytes, storage_bucket, storage_path, uploaded_by_email, uploaded_at, status, created_at')
    .eq('document_type', documentType)
    .eq('document_id', documentId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  return { data: data ?? [], error };
}

export async function getCustomerDocumentAttachmentUrl(attachment, expiresInSeconds = 300) {
  if (!supabase) return missingSupabaseClientResult();
  if (!attachment?.storage_path) return { data: null, error: new Error('Missing attachment storage path.') };

  const { data, error } = await supabase.storage
    .from(attachment.storage_bucket || CUSTOMER_DOCUMENT_ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.storage_path, expiresInSeconds);

  return { data: data?.signedUrl ?? null, error };
}

// Receiving photos are keyed by deposit request LINE id (see migration
// 20261007100000_deposit_receiving_photos.sql).
export const DEPOSIT_RECEIVING_PHOTO_DOCUMENT_TYPE = 'CUSTOMER_DEPOSIT_RECEIVING_PHOTO';

export async function listCustomerDocumentAttachmentsForDocuments(documentType, documentIds) {
  if (!supabase) return missingSupabaseClientResult();
  const ids = Array.from(new Set((documentIds ?? []).filter(Boolean)));
  if (!documentType || !ids.length) return { data: [], error: null };

  const { data, error } = await supabase
    .from('tgd_customer_document_attachments')
    .select('id, document_type, document_id, customer_id, file_name, file_mime_type, file_size_bytes, storage_bucket, storage_path, uploaded_by_email, uploaded_at, status, created_at')
    .eq('document_type', documentType)
    .in('document_id', ids)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true });

  return { data: data ?? [], error };
}

// One round trip for a whole gallery; returns { [attachmentId]: signedUrl }.
export async function getCustomerDocumentAttachmentUrls(attachments, expiresInSeconds = 3600) {
  if (!supabase) return missingSupabaseClientResult();
  const withPath = (attachments ?? []).filter((a) => a?.storage_path);
  if (!withPath.length) return { data: {}, error: null };

  const byBucket = new Map();
  withPath.forEach((a) => {
    const bucket = a.storage_bucket || CUSTOMER_DOCUMENT_ATTACHMENT_BUCKET;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(a);
  });

  const urls = {};
  for (const [bucket, items] of byBucket) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(items.map((a) => a.storage_path), expiresInSeconds);
    if (error) return { data: urls, error };
    (data ?? []).forEach((entry, index) => {
      if (entry?.signedUrl) urls[items[index].id] = entry.signedUrl;
    });
  }
  return { data: urls, error: null };
}

// Soft delete: the row is hidden (status DELETED) but the stored object is
// kept, so a mistaken removal can still be recovered by an admin.
export async function deleteCustomerDocumentAttachment(attachmentId) {
  if (!supabase) return missingSupabaseClientResult();
  if (!attachmentId) return { data: null, error: new Error('Missing attachment id.') };

  const { data, error } = await supabase
    .from('tgd_customer_document_attachments')
    .update({ status: 'DELETED' })
    .eq('id', attachmentId)
    .select('id')
    .maybeSingle();

  if (!error && !data) return { data: null, error: new Error('ไม่มีสิทธิ์ลบรูปนี้') };
  return { data, error };
}

// Packaging photos on the customer product master, keyed by
// tgd_customer_products.id (migration 20261007110000_location_stock_count.sql).
export const PRODUCT_PACKAGING_PHOTO_DOCUMENT_TYPE = 'CUSTOMER_PRODUCT_PACKAGING_PHOTO';

export function productPhotoKey(customerId, customerProductCode) {
  return `${customerId ?? ''}::${String(customerProductCode ?? '').trim().toLowerCase()}`;
}

// Chooses which photo to show for each counted item: the product's
// packaging photo (latest) first, else the first photo taken when that lot
// was received. items: [{ deposit_line_id, customer_id, customer_product_code }].
// Returns { [deposit_line_id]: attachment }.
export function pickCountPhotoAttachments(items, productIdByKey, packagingPhotos = [], receivingPhotos = []) {
  const latestPackagingByProduct = new Map();
  packagingPhotos.forEach((photo) => {
    const current = latestPackagingByProduct.get(photo.document_id);
    if (!current || String(photo.created_at ?? '') > String(current.created_at ?? '')) {
      latestPackagingByProduct.set(photo.document_id, photo);
    }
  });
  const firstReceivingByLine = new Map();
  receivingPhotos.forEach((photo) => {
    const current = firstReceivingByLine.get(photo.document_id);
    if (!current || String(photo.created_at ?? '') < String(current.created_at ?? '')) {
      firstReceivingByLine.set(photo.document_id, photo);
    }
  });

  const chosen = {};
  (items ?? []).forEach((item) => {
    if (!item?.deposit_line_id || chosen[item.deposit_line_id]) return;
    const productId = productIdByKey?.get(productPhotoKey(item.customer_id, item.customer_product_code));
    const photo = (productId && latestPackagingByProduct.get(productId)) || firstReceivingByLine.get(item.deposit_line_id);
    if (photo) chosen[item.deposit_line_id] = photo;
  });
  return chosen;
}

// Resolves display URLs for counted items in a few round trips. products:
// rows from listCustomerProducts (any customers). Returns
// { [deposit_line_id]: { url, source: 'PACKAGING' | 'RECEIVING' } }.
export async function resolveCountPhotoUrls(items, products = []) {
  if (!supabase) return missingSupabaseClientResult();
  const productIdByKey = new Map(
    (products ?? []).map((p) => [productPhotoKey(p.customer_id, p.customer_product_code), p.id]),
  );
  const productIds = (items ?? [])
    .map((item) => productIdByKey.get(productPhotoKey(item.customer_id, item.customer_product_code)))
    .filter(Boolean);
  const lineIds = (items ?? []).map((item) => item.deposit_line_id).filter(Boolean);

  const [packagingResult, receivingResult] = await Promise.all([
    listCustomerDocumentAttachmentsForDocuments(PRODUCT_PACKAGING_PHOTO_DOCUMENT_TYPE, productIds),
    listCustomerDocumentAttachmentsForDocuments(DEPOSIT_RECEIVING_PHOTO_DOCUMENT_TYPE, lineIds),
  ]);
  const chosen = pickCountPhotoAttachments(items, productIdByKey, packagingResult.data ?? [], receivingResult.data ?? []);
  const urlResult = await getCustomerDocumentAttachmentUrls(Object.values(chosen));

  const resolved = {};
  Object.entries(chosen).forEach(([lineId, photo]) => {
    const url = urlResult.data?.[photo.id];
    if (url) {
      resolved[lineId] = {
        url,
        source: photo.document_type === PRODUCT_PACKAGING_PHOTO_DOCUMENT_TYPE ? 'PACKAGING' : 'RECEIVING',
      };
    }
  });
  return { data: resolved, error: packagingResult.error ?? receivingResult.error ?? urlResult.error ?? null };
}
