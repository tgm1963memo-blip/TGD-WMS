-- Customer catalog unit-of-measure conversion (แพ็ค/ลัง). A product's box is
-- the only unit the deposit/withdrawal request forms can enter today
-- (weight_per_box handles box<->kg only). This adds a per-product,
-- admin/customer-managed list of additional named counting units (e.g. "1
-- ลัง = 10 กล่อง", "1 แพ็ค = 500 กรัม") so a customer can type "5 ลัง" on a
-- withdrawal request and have it convert down to boxes/weight automatically.
-- BOXES itself is never a row here -- it stays the implicit native unit
-- (backed by the catalog's existing pack_weight_kg / the line's own
-- weight_per_box), so a product with zero rows in this table behaves
-- identically to today.
--
-- A child table (not a fixed pair of extra columns) was chosen because
-- different products/customers need different numbers of packaging tiers
-- (some need only "ลัง", others "แพ็ค" AND "ลัง", etc). Capped at 4 units per
-- product (enforced below and again in the app) purely to keep the entry-
-- unit dropdown usable -- not a schema limitation.

begin;

create table public.tgd_customer_product_units (
  id                   uuid primary key default gen_random_uuid(),
  customer_product_id  uuid not null references public.tgd_customer_products(id) on delete cascade,
  unit_code            text not null,
  unit_label           text not null,
  weight_per_unit_kg   numeric(14,4) not null,
  boxes_per_unit       numeric(14,4),
  display_order        integer not null default 0,
  is_active            boolean not null default true,
  note                 text,
  created_by_user_id   uuid references public.tgd_user_profiles(id),
  updated_by_user_id   uuid references public.tgd_user_profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint tgd_customer_product_units_code_check
    check (unit_code = upper(btrim(unit_code)) and unit_code <> '' and unit_code <> 'BOXES'),
  constraint tgd_customer_product_units_unique unique (customer_product_id, unit_code),
  constraint tgd_customer_product_units_weight_positive check (weight_per_unit_kg > 0),
  constraint tgd_customer_product_units_boxes_positive
    check (boxes_per_unit is null or boxes_per_unit > 0)
);

create index tgd_customer_product_units_product_idx
  on public.tgd_customer_product_units (customer_product_id);

drop trigger if exists set_tgd_customer_product_units_updated_at on public.tgd_customer_product_units;
create trigger set_tgd_customer_product_units_updated_at
before update on public.tgd_customer_product_units
for each row execute function public.set_updated_at();

comment on table public.tgd_customer_product_units is
  'Per-product packaging-unit conversions (e.g. ลัง/แพ็ค) used by deposit/withdrawal request entry to derive boxes+weight. BOXES itself is never a row here.';

-- RLS -- SELECT scoped exactly like tgd_customer_products itself; writes via
-- RPC only (security definer, no direct grants to authenticated).
alter table public.tgd_customer_product_units enable row level security;

drop policy if exists rls_customer_product_units_select on public.tgd_customer_product_units;
create policy rls_customer_product_units_select
on public.tgd_customer_product_units
for select
to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_manager', 'warehouse_admin', 'warehouse_staff', 'viewer')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and exists (
        select 1 from public.tgd_customer_products cp
        where cp.id = tgd_customer_product_units.customer_product_id
          and cp.customer_id = public.tgd_current_user_customer_id()
      )
    )
  )
);

revoke insert, update, delete on public.tgd_customer_product_units from anon, authenticated;
grant select on public.tgd_customer_product_units to authenticated;

-- ---------------------------------------------------------------------------
-- Upsert a product's unit
-- ---------------------------------------------------------------------------

create or replace function public.tgd_upsert_customer_product_unit(
  p_unit_id             uuid default null,
  p_customer_product_id uuid default null,
  p_unit_code           text default null,
  p_unit_label          text default null,
  p_weight_per_unit_kg  numeric default null,
  p_boxes_per_unit      numeric default null,
  p_display_order       integer default 0,
  p_is_active           boolean default true,
  p_note                text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_product_customer_id uuid;
  v_code text := upper(nullif(btrim(p_unit_code), ''));
  v_label text := nullif(btrim(p_unit_label), '');
  v_target_id uuid;
  v_unit_id uuid;
  v_action text;
  v_active_unit_count integer;
begin
  if v_auth_user_id is null or not public.tgd_current_user_is_active() then
    raise exception 'Active authenticated user required';
  end if;

  select p.id, p.role, p.customer_id into v_profile
  from public.tgd_user_profiles p
  where p.auth_user_id = v_auth_user_id and p.is_active = true
  limit 1;
  if not found then raise exception 'Active user profile required'; end if;

  select customer_id into v_product_customer_id
  from public.tgd_customer_products where id = p_customer_product_id;
  if not found then raise exception 'customer_product_id not found'; end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null or v_profile.customer_id <> v_product_customer_id then
      raise exception 'Customer product not found for this scope';
    end if;
  elsif v_profile.role not in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager') then
    raise exception 'Only admin, warehouse staff, or customer admin can manage product units';
  end if;

  if v_code is null then raise exception 'unit_code is required'; end if;
  if v_code = 'BOXES' then raise exception 'BOXES is reserved for the native box unit'; end if;
  if v_label is null then raise exception 'unit_label is required'; end if;
  if p_weight_per_unit_kg is null or p_weight_per_unit_kg <= 0 then
    raise exception 'weight_per_unit_kg must be greater than zero';
  end if;
  if p_boxes_per_unit is not null and p_boxes_per_unit <= 0 then
    raise exception 'boxes_per_unit must be greater than zero when provided';
  end if;

  v_target_id := p_unit_id;
  if v_target_id is null then
    select id into v_target_id from public.tgd_customer_product_units
    where customer_product_id = p_customer_product_id and unit_code = v_code
    limit 1;
  end if;

  -- Cap at 4 units per product (only matters for brand-new units -- editing
  -- an existing one never increases the count).
  if v_target_id is null then
    select count(*) into v_active_unit_count
    from public.tgd_customer_product_units
    where customer_product_id = p_customer_product_id and is_active = true;
    if v_active_unit_count >= 4 then
      raise exception 'A product can have at most 4 packaging units';
    end if;
  end if;

  if v_target_id is not null then
    update public.tgd_customer_product_units
    set unit_code = v_code, unit_label = v_label,
        weight_per_unit_kg = p_weight_per_unit_kg, boxes_per_unit = p_boxes_per_unit,
        display_order = coalesce(p_display_order, 0), is_active = coalesce(p_is_active, true),
        note = nullif(btrim(p_note), ''), updated_by_user_id = v_profile.id, updated_at = now()
    where id = v_target_id and customer_product_id = p_customer_product_id
    returning id into v_unit_id;
    v_action := 'UPDATE_CUSTOMER_PRODUCT_UNIT';
  else
    insert into public.tgd_customer_product_units (
      customer_product_id, unit_code, unit_label, weight_per_unit_kg,
      boxes_per_unit, display_order, is_active, note, created_by_user_id, updated_by_user_id
    ) values (
      p_customer_product_id, v_code, v_label, p_weight_per_unit_kg,
      p_boxes_per_unit, coalesce(p_display_order, 0), coalesce(p_is_active, true),
      nullif(btrim(p_note), ''), v_profile.id, v_profile.id
    ) returning id into v_unit_id;
    v_action := 'INSERT_CUSTOMER_PRODUCT_UNIT';
  end if;

  return jsonb_build_object('id', v_unit_id, 'customer_product_id', p_customer_product_id, 'action', v_action);
end;
$$;

revoke all on function public.tgd_upsert_customer_product_unit(uuid, uuid, text, text, numeric, numeric, integer, boolean, text) from public;
grant execute on function public.tgd_upsert_customer_product_unit(uuid, uuid, text, text, numeric, numeric, integer, boolean, text) to authenticated;

-- tgd_delete_customer_product_unit is added in migration 20260824110000,
-- AFTER 20260824100000 adds entry_unit_code to the deposit/withdrawal line
-- tables -- its usage-check query references that column, which does not
-- exist yet at this point in migration order.

notify pgrst, 'reload schema';

commit;
