-- Per-user email notification switch, settable by the user themselves and
-- by an admin for any user.
--
-- tgd_user_profiles.receives_email_alerts = false now stops EVERY request
-- email to that person's address (customer_primary, customer_submitter,
-- warehouse_admin alerts, ...), enforced at the queue trigger, not only the
-- OPERATIONS_ALERT recipients loop. The hard rule that role=admin never
-- receives request emails (migration 118) still applies on top.

begin;

alter table public.tgd_user_profiles
  add column if not exists receives_email_alerts boolean not null default true;

create or replace function public.tgd_is_email_opted_out(p_email text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.tgd_user_profiles p
    where p.is_active = true
      and coalesce(p.receives_email_alerts, true) = false
      and lower(btrim(p.email)) = lower(btrim(coalesce(p_email, '')))
  );
$$;

create or replace function public.tgd_skip_admin_request_email_queue()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status = 'PENDING' then
    if lower(btrim(coalesce(new.recipient_role, ''))) = 'admin'
       or public.tgd_is_admin_email(new.recipient_email) then
      new.status := 'SKIPPED';
      new.error_log := coalesce(new.error_log, 'Skipped: role admin no longer receives request emails.');
      new.sent_at := coalesce(new.sent_at, now());
    elsif public.tgd_is_email_opted_out(new.recipient_email) then
      new.status := 'SKIPPED';
      new.error_log := coalesce(new.error_log, 'Skipped: recipient turned off email notifications.');
      new.sent_at := coalesce(new.sent_at, now());
    end if;
  end if;

  return new;
end;
$$;

-- The user switches their own notifications on/off.
create or replace function public.tgd_set_my_email_notifications(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  update public.tgd_user_profiles
  set receives_email_alerts = coalesce(p_enabled, true), updated_at = now()
  where auth_user_id = auth.uid() and is_active = true
  returning id into v_profile_id;

  if v_profile_id is null then
    raise exception 'User profile not found';
  end if;

  return jsonb_build_object('id', v_profile_id, 'receives_email_alerts', coalesce(p_enabled, true));
end;
$$;

-- An admin switches notifications on/off for any user.
create or replace function public.tgd_admin_set_user_email_notifications(p_profile_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  if public.tgd_current_user_role() <> 'admin' then
    raise exception 'Admin role required to change another user''s email notifications';
  end if;

  update public.tgd_user_profiles
  set receives_email_alerts = coalesce(p_enabled, true), updated_at = now()
  where id = p_profile_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  return jsonb_build_object('id', p_profile_id, 'receives_email_alerts', coalesce(p_enabled, true));
end;
$$;

revoke all on function public.tgd_set_my_email_notifications(boolean) from public;
revoke all on function public.tgd_admin_set_user_email_notifications(uuid, boolean) from public;
grant execute on function public.tgd_set_my_email_notifications(boolean) to authenticated;
grant execute on function public.tgd_admin_set_user_email_notifications(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
