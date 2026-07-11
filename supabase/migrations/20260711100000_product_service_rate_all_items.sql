-- Let a service rate apply to "every item" (ทุกรายการ) for a customer,
-- instead of always requiring one specific product. Business need: many
-- service charges (e.g. a flat handling fee, a per-trip charge) are the
-- same across a customer's whole catalog, so admins shouldn't have to
-- create one identical rate row per product.
--
-- Design: customer_product_id becomes nullable; a new customer_id column
-- is used instead when the rate is customer-wide. Exactly one of the two
-- must be set (enforced by check constraint). Two partial unique indexes
-- replace the old single unique constraint, since a product-specific rate
-- and a customer-wide rate key on different columns.

begin;

alter table public.tgd_customer_product_service_rates
  add column if not exists customer_id uuid references public.tgd_customers(id) on delete cascade;

alter table public.tgd_customer_product_service_rates
  alter column customer_product_id drop not null;

alter table public.tgd_customer_product_service_rates
  drop constraint if exists tgd_product_service_rates_unique;

alter table public.tgd_customer_product_service_rates
  drop constraint if exists tgd_product_service_rates_scope_check;
alter table public.tgd_customer_product_service_rates
  add constraint tgd_product_service_rates_scope_check check (
    (customer_product_id is not null and customer_id is null)
    or (customer_product_id is null and customer_id is not null)
  );

drop index if exists tgd_product_service_rates_product_idx;
create unique index if not exists tgd_product_service_rates_product_uidx
  on public.tgd_customer_product_service_rates (customer_product_id, service_type)
  where customer_product_id is not null;

create unique index if not exists tgd_product_service_rates_customer_uidx
  on public.tgd_customer_product_service_rates (customer_id, service_type)
  where customer_product_id is null;

create index if not exists tgd_product_service_rates_customer_id_idx
  on public.tgd_customer_product_service_rates (customer_id);

-- CREATE OR REPLACE cannot change a function's argument list — it would
-- create a second, overloaded function alongside the old 8-arg one, and
-- PostgREST's named-parameter matching can't reliably pick between two
-- overloads that both satisfy a given call. Drop the old signature first.
drop function if exists public.tgd_upsert_product_service_rate(uuid, uuid, text, numeric, text, text, text, boolean);

create or replace function public.tgd_upsert_product_service_rate(
  p_rate_id             uuid default null,
  p_customer_product_id uuid default null,
  p_service_type        text default null,
  p_rate                numeric default 0,
  p_unit_basis          text default null,
  p_currency            text default 'THB',
  p_note                text default null,
  p_is_active           boolean default true,
  p_customer_id         uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_role text;
  v_row  public.tgd_customer_product_service_rates;
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

  if p_rate_id is not null then
    update public.tgd_customer_product_service_rates
    set service_type = coalesce(p_service_type, service_type),
        rate         = coalesce(p_rate, rate),
        unit_basis   = coalesce(p_unit_basis, unit_basis),
        currency     = coalesce(p_currency, currency),
        note         = p_note,
        is_active    = coalesce(p_is_active, is_active),
        updated_at   = now()
    where id = p_rate_id
    returning * into v_row;

    if not found then
      raise exception 'Product service rate not found: %', p_rate_id;
    end if;

    return to_jsonb(v_row);
  end if;

  if p_service_type is null or p_unit_basis is null then
    raise exception 'service_type and unit_basis are required for new rates';
  end if;

  if (p_customer_product_id is not null and p_customer_id is not null)
     or (p_customer_product_id is null and p_customer_id is null) then
    raise exception 'Provide exactly one of customer_product_id or customer_id (for an all-items rate)';
  end if;

  if p_customer_product_id is not null then
    insert into public.tgd_customer_product_service_rates (
      customer_product_id, service_type, rate, unit_basis, currency, note, is_active
    ) values (
      p_customer_product_id, p_service_type, coalesce(p_rate, 0), p_unit_basis,
      coalesce(p_currency, 'THB'), p_note, coalesce(p_is_active, true)
    )
    on conflict (customer_product_id, service_type) where customer_product_id is not null
    do update set
      rate       = excluded.rate,
      unit_basis = excluded.unit_basis,
      currency   = excluded.currency,
      note       = excluded.note,
      is_active  = excluded.is_active,
      updated_at = now()
    returning * into v_row;
  else
    insert into public.tgd_customer_product_service_rates (
      customer_id, service_type, rate, unit_basis, currency, note, is_active
    ) values (
      p_customer_id, p_service_type, coalesce(p_rate, 0), p_unit_basis,
      coalesce(p_currency, 'THB'), p_note, coalesce(p_is_active, true)
    )
    on conflict (customer_id, service_type) where customer_product_id is null
    do update set
      rate       = excluded.rate,
      unit_basis = excluded.unit_basis,
      currency   = excluded.currency,
      note       = excluded.note,
      is_active  = excluded.is_active,
      updated_at = now()
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.tgd_upsert_product_service_rate(uuid, uuid, text, numeric, text, text, text, boolean, uuid)
  to authenticated;

comment on table public.tgd_customer_product_service_rates is
  'Per-product (customer_product_id set) or per-customer all-items (customer_id set) service rates for admin billing configuration (handling, storage, labeling, etc.)';

commit;
