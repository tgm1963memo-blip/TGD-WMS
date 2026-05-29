create table if not exists tgd_user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text,
  display_name text,
  role text not null default 'VIEWER',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_user_profiles_role_check check (
    role in (
      'ADMIN',
      'MANAGER',
      'WAREHOUSE_SUPERVISOR',
      'WAREHOUSE_STAFF',
      'VIEWER',
      'AUDITOR'
    )
  )
);

create table if not exists tgd_audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  performed_by uuid references tgd_user_profiles(id),
  performed_by_auth_user_id uuid,
  ip_address text,
  user_agent text,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists tgd_user_profiles_auth_user_id_idx
  on tgd_user_profiles (auth_user_id);
create index if not exists tgd_user_profiles_email_idx
  on tgd_user_profiles (email);
create index if not exists tgd_user_profiles_role_idx
  on tgd_user_profiles (role);
create index if not exists tgd_user_profiles_is_active_idx
  on tgd_user_profiles (is_active);

create index if not exists tgd_audit_logs_entity_idx
  on tgd_audit_logs (entity_type, entity_id);
create index if not exists tgd_audit_logs_action_idx
  on tgd_audit_logs (action);
create index if not exists tgd_audit_logs_performed_by_idx
  on tgd_audit_logs (performed_by);
create index if not exists tgd_audit_logs_performed_by_auth_user_id_idx
  on tgd_audit_logs (performed_by_auth_user_id);
create index if not exists tgd_audit_logs_created_at_idx
  on tgd_audit_logs (created_at);
create index if not exists tgd_audit_logs_request_id_idx
  on tgd_audit_logs (request_id);

drop trigger if exists set_tgd_user_profiles_updated_at on tgd_user_profiles;
create trigger set_tgd_user_profiles_updated_at
before update on tgd_user_profiles
for each row execute function set_updated_at();

create or replace function tgd_write_audit_log(input jsonb)
returns uuid
language plpgsql
as $$
declare
  v_entity_type text;
  v_action text;
  v_audit_log_id uuid;
begin
  v_entity_type := nullif(input->>'entity_type', '');
  v_action := nullif(input->>'action', '');

  if v_entity_type is null then
    raise exception 'entity_type is required';
  end if;

  if v_action is null then
    raise exception 'action is required';
  end if;

  insert into tgd_audit_logs (
    entity_type,
    entity_id,
    action,
    old_value,
    new_value,
    metadata,
    performed_by,
    performed_by_auth_user_id,
    ip_address,
    user_agent,
    request_id
  )
  values (
    v_entity_type,
    nullif(input->>'entity_id', '')::uuid,
    v_action,
    input->'old_value',
    input->'new_value',
    input->'metadata',
    nullif(input->>'performed_by', '')::uuid,
    nullif(input->>'performed_by_auth_user_id', '')::uuid,
    input->>'ip_address',
    input->>'user_agent',
    input->>'request_id'
  )
  returning id into v_audit_log_id;

  return v_audit_log_id;
end;
$$;

create or replace function tgd_current_user_role()
returns text
language plpgsql
stable
as $$
declare
  v_auth_user_id uuid;
  v_role text;
begin
  begin
    v_auth_user_id := auth.uid();
  exception
    when undefined_function or invalid_schema_name then
      return 'VIEWER';
  end;

  if v_auth_user_id is null then
    return 'VIEWER';
  end if;

  select role
  into v_role
  from tgd_user_profiles
  where auth_user_id = v_auth_user_id
    and is_active = true;

  return coalesce(v_role, 'VIEWER');
end;
$$;

create or replace function tgd_is_admin()
returns boolean
language sql
stable
as $$
  select tgd_current_user_role() = 'ADMIN';
$$;

create or replace function tgd_is_manager_or_admin()
returns boolean
language sql
stable
as $$
  select tgd_current_user_role() in ('ADMIN', 'MANAGER');
$$;

create or replace function tgd_can_view_inventory()
returns boolean
language sql
stable
as $$
  select tgd_current_user_role() in (
    'ADMIN',
    'MANAGER',
    'WAREHOUSE_SUPERVISOR',
    'WAREHOUSE_STAFF',
    'VIEWER',
    'AUDITOR'
  );
$$;

create or replace function tgd_can_post_inventory_movement()
returns boolean
language sql
stable
as $$
  select tgd_current_user_role() in (
    'ADMIN',
    'MANAGER',
    'WAREHOUSE_SUPERVISOR',
    'WAREHOUSE_STAFF'
  );
$$;

create or replace function tgd_can_view_audit_logs()
returns boolean
language sql
stable
as $$
  select tgd_current_user_role() in ('ADMIN', 'AUDITOR');
$$;

