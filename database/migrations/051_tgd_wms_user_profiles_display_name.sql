-- 051_tgd_wms_user_profiles_display_name.sql
-- Add display_name column required by User Management UI and admin RPC.

begin;

alter table if exists public.tgd_user_profiles
  add column if not exists display_name text;

update public.tgd_user_profiles
set display_name = coalesce(
  nullif(btrim(display_name), ''),
  split_part(email, '@', 1)
)
where display_name is null
  and email is not null;

comment on column public.tgd_user_profiles.display_name is
  'Human-readable label shown in User Management and profile settings.';

commit;
