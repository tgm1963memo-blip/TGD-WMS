-- ร.3 (animal-movement permit) per-category check for withdrawals.
--
-- A ร.3 permits a fixed kg per carcass type (e.g. "สุกร / เนื้อสุกรแช่แข็ง
-- 400 kg", "สุกร / มันสุกรแช่แข็ง 500 kg"). Which type a customer product
-- counts as can't be guessed from its name (SPC112 "เศษตัดแต่งจากสามชั้น"
-- is declared as มันสุกร), so it's recorded once on the customer catalog
-- and snapshotted onto each withdrawal line.
--
-- Deliberately a separate column from product_category: that one drives
-- billing scope and report filters, and is free text per customer.
--
-- The comparison itself is warn-only (client side) — submit is NOT blocked,
-- so tgd_submit_customer_withdrawal_request is untouched.

begin;

-- 1. Fixed list of ร.3 carcass types
create table if not exists public.tgd_r3_carcass_types (
  code text primary key,
  animal_type text not null,
  label_th text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.tgd_r3_carcass_types (code, animal_type, label_th, sort_order) values
  ('PORK_MEAT_FROZEN',    'สุกร',    'เนื้อสุกรแช่แข็ง',      10),
  ('PORK_FAT_FROZEN',     'สุกร',    'มันสุกรแช่แข็ง',        20),
  ('PORK_OFFAL_FROZEN',   'สุกร',    'เครื่องในสุกรแช่แข็ง',  30),
  ('PORK_SKIN_FROZEN',    'สุกร',    'หนังสุกรแช่แข็ง',       40),
  ('PORK_BONE_FROZEN',    'สุกร',    'กระดูกสุกรแช่แข็ง',     50),
  ('BEEF_MEAT_FROZEN',    'โค',      'เนื้อโคแช่แข็ง',        60),
  ('CHICKEN_MEAT_FROZEN', 'ไก่',     'เนื้อไก่แช่แข็ง',       70)
on conflict (code) do nothing;

alter table public.tgd_r3_carcass_types enable row level security;

drop policy if exists rls_r3_carcass_types_select on public.tgd_r3_carcass_types;
create policy rls_r3_carcass_types_select
on public.tgd_r3_carcass_types
for select to authenticated
using (public.tgd_current_user_is_active());

grant select on public.tgd_r3_carcass_types to authenticated;

-- 2. Catalog column
alter table public.tgd_customer_products
  add column if not exists r3_carcass_type_code text
    references public.tgd_r3_carcass_types(code);

-- 3. Line snapshot. Filled by trigger (not inside each RPC) so every path
-- that writes lines — customer upsert, admin add, admin recode — gets it.
-- Refreshed when the line's product code changes, or while still empty
-- (so fixing the catalog then re-saving a draft line picks it up). Once
-- set, later catalog edits don't rewrite history.
alter table public.tgd_customer_withdrawal_request_lines
  add column if not exists r3_carcass_type_code text;

create or replace function public.tgd_withdrawal_line_fill_r3_carcass_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or new.r3_carcass_type_code is null
     or new.customer_product_code is distinct from old.customer_product_code then
    select cp.r3_carcass_type_code
    into new.r3_carcass_type_code
    from public.tgd_customer_withdrawal_requests w
    join public.tgd_customer_products cp
      on cp.customer_id = w.customer_id
     and cp.customer_product_code = new.customer_product_code
    where w.id = new.withdrawal_request_id
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_withdrawal_line_fill_r3_carcass_type on public.tgd_customer_withdrawal_request_lines;
create trigger trg_withdrawal_line_fill_r3_carcass_type
before insert or update on public.tgd_customer_withdrawal_request_lines
for each row execute function public.tgd_withdrawal_line_fill_r3_carcass_type();

-- Backfill existing lines from whatever the catalog has (nothing yet on a
-- fresh deploy — harmless; re-saving a line later fills it too).
update public.tgd_customer_withdrawal_request_lines l
set r3_carcass_type_code = cp.r3_carcass_type_code
from public.tgd_customer_withdrawal_requests w
join public.tgd_customer_products cp on cp.customer_id = w.customer_id
where w.id = l.withdrawal_request_id
  and cp.customer_product_code = l.customer_product_code
  and cp.r3_carcass_type_code is not null
  and l.r3_carcass_type_code is null;

-- 4. Permitted kg per ร.3 per carcass type, per withdrawal request. One
-- request may carry several ร.3, so r3_no is on every row.
create table if not exists public.tgd_customer_withdrawal_r3_permit_items (
  id uuid primary key default gen_random_uuid(),
  withdrawal_request_id uuid not null
    references public.tgd_customer_withdrawal_requests(id) on delete cascade,
  customer_id uuid not null references public.tgd_customers(id),
  r3_no text,
  r3_carcass_type_code text not null references public.tgd_r3_carcass_types(code),
  permitted_kg numeric(12, 2) not null,
  note text,
  created_by_user_id uuid references public.tgd_user_profiles(id),
  created_by_email text,
  created_at timestamptz not null default now(),
  constraint tgd_customer_withdrawal_r3_permit_items_kg_nonnegative check (permitted_kg >= 0)
);

create index if not exists tgd_customer_withdrawal_r3_permit_items_request_idx
  on public.tgd_customer_withdrawal_r3_permit_items (withdrawal_request_id);

alter table public.tgd_customer_withdrawal_r3_permit_items enable row level security;

-- Same scope as rls_customer_withdrawal_request_lines_select (20260729130000).
-- Writes go through the RPC below only.
drop policy if exists rls_customer_withdrawal_r3_permit_items_select on public.tgd_customer_withdrawal_r3_permit_items;
create policy rls_customer_withdrawal_r3_permit_items_select
on public.tgd_customer_withdrawal_r3_permit_items
for select to authenticated
using (
  public.tgd_current_user_is_active()
  and (
    (
      public.tgd_current_user_role() in (
        'admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'accounting', 'viewer'
      )
      and (
        public.tgd_current_user_role_customer_scope() is null
        or public.tgd_current_user_role_customer_scope() = customer_id
      )
    )
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  )
);

grant select on public.tgd_customer_withdrawal_r3_permit_items to authenticated;

-- 5. Replace-all RPC. Customers edit only while WITHDRAWAL_DRAFT; staff
-- (proxy roles) until the truck is confirmed loaded.
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
  elsif v_document.status in ('LOADED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'CLOSED', 'COMPLETED', 'CANCELLED', 'ADMIN_REJECTED') then
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

-- 6. Catalog upsert RPC — add p_r3_carcass_type_code (arity change: drop
-- the 16-arg signature from 20260912120000 first).
drop function if exists public.tgd_upsert_customer_product(
  uuid, uuid, text, text, text, uuid, text, text, text, text, numeric, text, text, boolean, text, integer
);

create or replace function public.tgd_upsert_customer_product(
  p_product_id uuid default null,
  p_customer_id uuid default null,
  p_customer_product_code text default null,
  p_product_name text default null,
  p_internal_product_code text default null,
  p_internal_product_id uuid default null,
  p_uom text default null,
  p_temperature_type text default null,
  p_argent_type text default null,
  p_storage_charge_basis text default null,
  p_pack_weight_kg numeric default null,
  p_allergen text default null,
  p_note text default null,
  p_is_active boolean default true,
  p_product_category text default null,
  p_default_boxes_per_pallet integer default null,
  p_r3_carcass_type_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile record;
  v_customer_id uuid;
  v_code text := nullif(btrim(p_customer_product_code), '');
  v_name text := nullif(btrim(p_product_name), '');
  v_temp text := nullif(upper(btrim(p_temperature_type)), '');
  v_argent text := nullif(upper(btrim(p_argent_type)), '');
  v_basis text := nullif(upper(btrim(p_storage_charge_basis)), '');
  v_category text := nullif(btrim(p_product_category), '');
  v_r3_code text := nullif(upper(btrim(p_r3_carcass_type_code)), '');
  v_product_id uuid;
  v_target_id uuid;
  v_action text;
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
    raise exception 'Active user profile required';
  end if;

  if v_profile.role in ('customer_admin', 'customer_user') then
    if v_profile.customer_id is null then
      raise exception 'Customer profile must be linked to a customer_id';
    end if;
    v_customer_id := v_profile.customer_id;
  elsif v_profile.role in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager') then
    v_customer_id := p_customer_id;
    if v_customer_id is null then
      raise exception 'customer_id is required for catalog writes';
    end if;
  else
    raise exception 'Only admin, warehouse staff, or customer admin can manage customer product catalog';
  end if;

  if v_code is null then raise exception 'customer_product_code is required'; end if;
  if v_name is null then raise exception 'product_name is required'; end if;

  if v_temp is not null and v_temp not in ('FROZEN', 'CHILLED', 'AMBIENT') then
    raise exception 'temperature_type must be FROZEN, CHILLED, or AMBIENT';
  end if;
  if v_argent is not null and v_argent not in ('ARGENT', 'NON_ARGENT') then
    raise exception 'argent_type must be ARGENT or NON_ARGENT';
  end if;
  if v_basis is not null and v_basis not in ('WEIGHT', 'PALLET') then
    raise exception 'storage_charge_basis must be WEIGHT or PALLET';
  end if;
  if p_pack_weight_kg is not null and p_pack_weight_kg < 0 then
    raise exception 'pack_weight_kg must be zero or greater';
  end if;
  if p_default_boxes_per_pallet is not null and p_default_boxes_per_pallet <= 0 then
    raise exception 'default_boxes_per_pallet must be greater than zero';
  end if;
  if v_r3_code is not null and not exists (
    select 1 from public.tgd_r3_carcass_types t where t.code = v_r3_code
  ) then
    raise exception 'Unknown r3_carcass_type_code: %', v_r3_code;
  end if;

  if not exists (select 1 from public.tgd_customers c where c.id = v_customer_id) then
    raise exception 'customer_id not found';
  end if;

  v_target_id := p_product_id;

  if v_target_id is not null and v_profile.role in ('customer_admin', 'customer_user') then
    if not exists (
      select 1 from public.tgd_customer_products cp
      where cp.id = v_target_id and cp.customer_id = v_customer_id
    ) then
      raise exception 'Customer product not found for this scope';
    end if;
  end if;

  if v_target_id is null then
    select id into v_target_id
    from public.tgd_customer_products
    where customer_id = v_customer_id
      and customer_product_code = v_code
    limit 1;
  end if;

  if v_target_id is not null then
    update public.tgd_customer_products
    set customer_product_code = v_code,
        product_name = v_name,
        internal_product_code = nullif(btrim(p_internal_product_code), ''),
        internal_product_id = p_internal_product_id,
        uom = nullif(btrim(p_uom), ''),
        temperature_type = v_temp,
        argent_type = v_argent,
        storage_charge_basis = v_basis,
        pack_weight_kg = p_pack_weight_kg,
        allergen = nullif(btrim(p_allergen), ''),
        note = nullif(btrim(p_note), ''),
        is_active = coalesce(p_is_active, true),
        product_category = v_category,
        default_boxes_per_pallet = p_default_boxes_per_pallet,
        r3_carcass_type_code = v_r3_code,
        updated_by_user_id = v_profile.id,
        updated_at = now()
    where id = v_target_id and customer_id = v_customer_id
    returning id into v_product_id;
    if not found then raise exception 'Customer product not found for this scope'; end if;
    v_action := 'UPDATE_CUSTOMER_PRODUCT';
  else
    insert into public.tgd_customer_products (
      customer_id, customer_product_code, product_name,
      internal_product_code, internal_product_id, uom, temperature_type,
      argent_type, storage_charge_basis, pack_weight_kg, allergen,
      note, is_active, product_category, default_boxes_per_pallet,
      r3_carcass_type_code,
      created_by_user_id, updated_by_user_id
    ) values (
      v_customer_id, v_code, v_name,
      nullif(btrim(p_internal_product_code), ''), p_internal_product_id,
      nullif(btrim(p_uom), ''), v_temp, v_argent, v_basis,
      p_pack_weight_kg, nullif(btrim(p_allergen), ''),
      nullif(btrim(p_note), ''), coalesce(p_is_active, true), v_category,
      p_default_boxes_per_pallet, v_r3_code,
      v_profile.id, v_profile.id
    )
    returning id into v_product_id;
    v_action := 'INSERT_CUSTOMER_PRODUCT';
  end if;

  return jsonb_build_object('id', v_product_id, 'customer_id', v_customer_id, 'action', v_action);
end;
$$;

revoke all on function public.tgd_upsert_customer_product(uuid, uuid, text, text, text, uuid, text, text, text, text, numeric, text, text, boolean, text, integer, text) from public;
grant execute on function public.tgd_upsert_customer_product(uuid, uuid, text, text, text, uuid, text, text, text, text, numeric, text, text, boolean, text, integer, text) to authenticated;

notify pgrst, 'reload schema';

commit;
