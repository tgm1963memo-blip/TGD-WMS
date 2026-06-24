-- Migration: 20260624000000_add_receiving_signatures.sql
-- Adds handheld_confirmed_by and web_approved_by to tgd_receiving_documents and backfills them.

ALTER TABLE tgd_receiving_documents
ADD COLUMN IF NOT EXISTS handheld_confirmed_by varchar(255),
ADD COLUMN IF NOT EXISTS web_approved_by varchar(255);

UPDATE tgd_receiving_documents doc
SET handheld_confirmed_by = sess.completed_by
FROM tgd_handheld_receiving_sessions sess
WHERE sess.receiving_document_id = doc.id
  AND sess.status = 'COMPLETED'
  AND doc.handheld_confirmed_by IS NULL;

UPDATE tgd_receiving_documents doc
SET web_approved_by = COALESCE(
  (
    SELECT performed_by_email 
    FROM tgd_audit_logs 
    WHERE record_id = doc.id 
      AND entity = 'RECEIVING_DOCUMENT' 
      AND action IN ('CONFIRM_RECEIVING', 'POST_RECEIVING')
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  doc.updated_by,
  doc.created_by
)
WHERE doc.status IN ('CONFIRMED', 'POSTED')
  AND doc.web_approved_by IS NULL;
