-- Adds a delete RPC for tgd_customer_product_service_rates — the admin UI
-- (CustomerProductServiceRatesPage.jsx) only ever let you create/edit a
-- rate, never remove one, so a rate entered by mistake (wrong product,
-- wrong temperature scope, duplicate custom service type) could only be
-- fixed by direct SQL.
--
-- Rates can be referenced by tgd_customer_deposit_request_services.service_rate_id
-- (not null) and tgd_billing_invoice_draft_lines.service_rate_id (nullable),
-- both plain FKs with no ON DELETE action (i.e. RESTRICT) — deleting a rate
-- that's already been selected on a live deposit request or billed on an
-- invoice draft would either error out or, worse, silently corrupt those
-- historical records if the FK action were ever loosened. Rather than
-- surface a raw FK-violation error to the admin, fall back to deactivating
-- the rate (is_active = false, same as the "ปิด" status already shown in
-- the table) when a hard delete isn't possible, and report which happened.

begin;

create or replace function public.tgd_delete_product_service_rate(p_rate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_role text;
  v_hard_deleted boolean := false;
begin
  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.role into v_role
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;

  if v_role not in ('admin') then
    raise exception 'Admin role required to manage product service rates';
  end if;

  begin
    delete from public.tgd_customer_product_service_rates where id = p_rate_id;
    if not found then
      raise exception 'Product service rate not found: %', p_rate_id;
    end if;
    v_hard_deleted := true;
  exception when foreign_key_violation then
    update public.tgd_customer_product_service_rates
    set is_active = false, updated_at = now()
    where id = p_rate_id;
    v_hard_deleted := false;
  end;

  return jsonb_build_object('deleted', v_hard_deleted);
end;
$function$;

grant execute on function public.tgd_delete_product_service_rate(uuid) to authenticated;

commit;
