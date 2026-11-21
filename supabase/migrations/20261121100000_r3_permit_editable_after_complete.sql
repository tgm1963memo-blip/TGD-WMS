-- The ร.3 paperwork often reaches TGC after the goods were dispatched, but
-- staff could not key in the permit rows once the withdrawal was COMPLETED,
-- so it kept showing "ไม่มีใน ร.3" even with the ร.3 file attached.
-- Staff may now edit the rows on any withdrawal except CANCELLED or
-- ADMIN_REJECTED. The rows are warn-only (no effect on stock or billing).
-- Customers are unchanged: only while the request is WITHDRAWAL_DRAFT.

create or replace function public.tgd_replace_withdrawal_r3_permit_items(
  p_request_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_document record;
  v_item jsonb;
  v_code text;
  v_kg numeric;
  v_count integer := 0;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.email, p.role, p.customer_id
  into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id
    and p.is_active = true
  limit 1;

  if not found then
    raise exception 'Active profile required';
  end if;

  perform public.tgd_assert_customer_request_actor(v_profile.role, v_profile.customer_id);

  select w.id, w.customer_id, w.status
  into v_document
  from public.tgd_customer_withdrawal_requests w
  where w.id = p_request_id
  for update;

  if not found then
    raise exception 'Customer withdrawal request not found';
  end if;

  perform public.tgd_assert_customer_request_document_scope(
    v_profile.role, v_profile.customer_id, v_document.customer_id
  );

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_document.status <> 'WITHDRAWAL_DRAFT' then
      raise exception 'ร.3 permit can only be edited while the withdrawal request is WITHDRAWAL_DRAFT';
    end if;
  elsif v_document.status in ('CANCELLED', 'ADMIN_REJECTED') then
    raise exception 'ร.3 permit can no longer be edited at status %', v_document.status;
  end if;

  if p_items is not null and jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array';
  end if;

  delete from public.tgd_customer_withdrawal_r3_permit_items
  where withdrawal_request_id = v_document.id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_code := nullif(btrim(v_item->>'r3_carcass_type_code'), '');
    v_kg := nullif(btrim(v_item->>'permitted_kg'), '')::numeric;

    if v_code is null then
      raise exception 'r3_carcass_type_code is required on every ร.3 permit row';
    end if;
    if not exists (select 1 from public.tgd_r3_carcass_types t where t.code = v_code) then
      raise exception 'Unknown r3_carcass_type_code: %', v_code;
    end if;
    if v_kg is null or v_kg < 0 then
      raise exception 'permitted_kg must be zero or greater';
    end if;

    insert into public.tgd_customer_withdrawal_r3_permit_items (
      withdrawal_request_id, customer_id, r3_no, r3_carcass_type_code,
      permitted_kg, note, created_by_user_id, created_by_email
    ) values (
      v_document.id, v_document.customer_id,
      nullif(btrim(v_item->>'r3_no'), ''), v_code, v_kg,
      nullif(btrim(v_item->>'note'), ''),
      v_profile.id, v_profile.email
    );
    v_count := v_count + 1;
  end loop;

  insert into public.tgd_customer_document_timeline_events (
    document_type, document_id, customer_id, action, from_status, to_status,
    actor_user_id, actor_email, actor_role, actor_customer_id, comment, metadata_json
  ) values (
    'CUSTOMER_WITHDRAWAL_REQUEST', v_document.id, v_document.customer_id,
    'UPDATE_R3_PERMIT', v_document.status, v_document.status,
    v_profile.id, v_profile.email, v_profile.role, v_profile.customer_id,
    null, jsonb_build_object('items', coalesce(p_items, '[]'::jsonb))
  );

  return jsonb_build_object('id', v_document.id, 'item_count', v_count, 'action', 'UPDATE_R3_PERMIT');
end;
$$;

revoke all on function public.tgd_replace_withdrawal_r3_permit_items(uuid, jsonb) from public, anon;
grant execute on function public.tgd_replace_withdrawal_r3_permit_items(uuid, jsonb) to authenticated;
