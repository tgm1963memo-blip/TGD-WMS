-- 028_tgd_wms_outbound_grant_hardening.sql
-- Sprint 14K-Fix-2: outbound grant hardening draft.
-- Staging review required. Production is not touched by this draft.
-- Grant hardening only. No outbound posting and no stock mutation.

revoke insert, update, delete, truncate, references, trigger
on public.tgd_outbound_documents
from anon, authenticated;

revoke select
on public.tgd_outbound_documents
from anon;

grant select
on public.tgd_outbound_documents
to authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.tgd_outbound_lines
from anon, authenticated;

revoke select
on public.tgd_outbound_lines
from anon;

grant select
on public.tgd_outbound_lines
to authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.tgd_outbound_reservations
from anon, authenticated;

revoke select
on public.tgd_outbound_reservations
from anon;

grant select
on public.tgd_outbound_reservations
to authenticated;
