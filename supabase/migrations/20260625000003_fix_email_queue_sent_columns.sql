-- Fix email queue loop: add sent_at and error_log columns
-- The process-email-queue.js processor tried to update these columns but they didn't exist.
-- PostgREST returned an error → status stayed PENDING → emails were resent on every cron run.
ALTER TABLE public.tgd_customer_request_email_queue
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_log text;

-- Clean up: delete all SKIPPED emails (old customer-submit notifications, now disabled)
DELETE FROM public.tgd_customer_request_email_queue WHERE status = 'SKIPPED';
