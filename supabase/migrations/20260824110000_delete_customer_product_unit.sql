-- tgd_delete_customer_product_unit -- added after 20260824100000 so its
-- usage-check query can reference entry_unit_code on the deposit/withdrawal
-- line tables. Blocks hard-deleting a unit that has ever actually been used
-- on a real line (deactivate instead); lines reference the catalog by
-- (customer_id, customer_product_code), never by a product id FK, so the
-- usage check joins through customer_product_code rather than an id.

begin;

create or replace function public.tgd_delete_customer_product_unit(p_unit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_unit record;
  v_in_use boolean;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true limit 1;
  if not found then raise exception 'Active user profile required'; end if;

  select u.id, u.unit_code, cp.customer_id as product_customer_id, cp.customer_product_code as product_code
  into v_unit
  from public.tgd_customer_product_units u
  join public.tgd_customer_products cp on cp.id = u.customer_product_id
  where u.id = p_unit_id;
  if not found then raise exception 'Unit not found'; end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null or v_profile.customer_id <> v_unit.product_customer_id then
      raise exception 'Unit not found for this scope';
    end if;
  elsif v_profile.role not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager') then
    raise exception 'Only admin, warehouse staff, or customer admin can manage product units';
  end if;

  select exists (
    select 1
    from public.tgd_customer_deposit_request_lines l
    join public.tgd_customer_deposit_requests r on r.id = l.deposit_request_id
    where r.customer_id = v_unit.product_customer_id
      and l.customer_product_code = v_unit.product_code
      and l.entry_unit_code = v_unit.unit_code
    union all
    select 1
    from public.tgd_customer_withdrawal_request_lines l
    join public.tgd_customer_withdrawal_requests r on r.id = l.withdrawal_request_id
    where r.customer_id = v_unit.product_customer_id
      and l.customer_product_code = v_unit.product_code
      and l.entry_unit_code = v_unit.unit_code
  ) into v_in_use;

  if v_in_use then
    raise exception 'This unit has been used on existing deposit/withdrawal lines -- deactivate it instead of deleting';
  end if;

  delete from public.tgd_customer_product_units where id = p_unit_id;
  return jsonb_build_object('id', p_unit_id, 'deleted', true);
end;
$$;

revoke all on function public.tgd_delete_customer_product_unit(uuid) from public;
grant execute on function public.tgd_delete_customer_product_unit(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
