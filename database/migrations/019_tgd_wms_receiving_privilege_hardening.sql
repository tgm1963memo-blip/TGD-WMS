-- 019_tgd_wms_receiving_privilege_hardening.sql
-- Sprint 13J-L Receiving RPC Staging Apply Privilege Hardening.
-- Staging only. Production locked until Controller approval.
-- Receiving UI remains locked.
-- Receiving write model remains RPC-only; frontend direct table writes stay disabled.
-- SELECT privilege is intentionally left unchanged for read access through RLS.
-- Existing RPC execute grants are intentionally left unchanged.

revoke truncate, trigger, references on public.tgd_receiving_documents from anon, authenticated;
revoke truncate, trigger, references on public.tgd_receiving_lines from anon, authenticated;
