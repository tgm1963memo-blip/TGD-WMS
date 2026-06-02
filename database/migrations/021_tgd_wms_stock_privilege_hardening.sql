-- 021_tgd_wms_stock_privilege_hardening.sql
-- Sprint 13J-R Stock Table + Receiving RPC Privilege Hardening Migration Draft.
-- Draft only.
-- Staging apply requires Controller approval.
-- Production locked.
-- Receiving UI remains locked.
-- Real stock posting remains locked.
-- SELECT privileges are intentionally left unchanged for read access through RLS.
-- Existing RLS SELECT policies are not modified by this draft.

-- Revoke unsafe direct stock table privileges from browser-accessible roles.
revoke insert, update, delete, truncate, trigger, references
  on public.tgd_stock_movements
  from anon, authenticated;

revoke insert, update, delete, truncate, trigger, references
  on public.tgd_stock_balances
  from anon, authenticated;

-- Harden existing Receiving RPC execute grants.
-- These RPCs should not be executable by PUBLIC or anon.
revoke execute on function public.tgd_rpc_create_receiving_draft(uuid, text) from public;
revoke execute on function public.tgd_rpc_create_receiving_draft(uuid, text) from anon;

revoke execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric) from public;
revoke execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric) from anon;

revoke execute on function public.tgd_rpc_confirm_receiving_document(uuid) from public;
revoke execute on function public.tgd_rpc_confirm_receiving_document(uuid) from anon;

grant execute on function public.tgd_rpc_create_receiving_draft(uuid, text) to authenticated;
grant execute on function public.tgd_rpc_add_receiving_line(uuid, uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.tgd_rpc_confirm_receiving_document(uuid) to authenticated;
