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
