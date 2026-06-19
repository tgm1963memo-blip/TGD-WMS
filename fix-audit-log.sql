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
