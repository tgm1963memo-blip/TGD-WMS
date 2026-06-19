-- 20260619000005_product_service_rates_and_roles.sql
-- 1. Per-product service rate rules (replaces per-customer WEIGHT/PALLET only)
-- 2. Role definitions table for configurable role management

begin;

-- ── 1. Per-product service rates ───────────────────────────────────────────
create table if not exists public.tgd_customer_product_service_rates (
  id                  uuid primary key default gen_random_uuid(),
  customer_product_id uuid not null references public.tgd_customer_products(id) on delete cascade,
  service_type        text not null,   -- STORAGE / HANDLING_IN / HANDLING_OUT / LABEL / FREEZING / OTHER
  rate                numeric(14,4) not null default 0,
  unit_basis          text not null,   -- PER_KG / PER_UNIT / PER_PALLET / PER_TRIP / FLAT / PER_DAY
  currency            text not null default 'THB',
  note                text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint tgd_product_service_rates_type_check check (
    service_type in ('STORAGE','HANDLING_IN','HANDLING_OUT','LABEL','FREEZING','OTHER')
  ),
  constraint tgd_product_service_rates_unit_check check (
    unit_basis in ('PER_KG','PER_UNIT','PER_PALLET','PER_TRIP','FLAT','PER_DAY')
  ),
  constraint tgd_product_service_rates_unique unique (customer_product_id, service_type)
);

create index if not exists tgd_product_service_rates_product_idx
  on public.tgd_customer_product_service_rates (customer_product_id);

alter table public.tgd_customer_product_service_rates enable row level security;

drop policy if exists tgd_product_service_rates_admin_all on public.tgd_customer_product_service_rates;
create policy tgd_product_service_rates_admin_all
  on public.tgd_customer_product_service_rates for all to authenticated
  using (public.tgd_current_user_role() in ('admin','warehouse_manager','accounting'))
  with check (public.tgd_current_user_role() in ('admin','warehouse_manager','accounting'));

grant select, insert, update, delete on public.tgd_customer_product_service_rates to authenticated;

-- Upsert RPC
create or replace function public.tgd_upsert_product_service_rate(
  p_rate_id           uuid,
  p_customer_product_id uuid,
  p_service_type      text,
  p_rate              numeric,
  p_unit_basis        text,
  p_currency          text default 'THB',
  p_note              text default null,
  p_is_active         boolean default true
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  if p_rate_id is not null then
    update public.tgd_customer_product_service_rates
    set service_type = p_service_type,
        rate         = p_rate,
        unit_basis   = p_unit_basis,
        currency     = coalesce(p_currency, 'THB'),
        note         = p_note,
        is_active    = p_is_active,
        updated_at   = now()
    where id = p_rate_id
    returning id into v_id;
  else
    insert into public.tgd_customer_product_service_rates
      (customer_product_id, service_type, rate, unit_basis, currency, note, is_active)
    values (p_customer_product_id, p_service_type, p_rate, p_unit_basis,
            coalesce(p_currency,'THB'), p_note, p_is_active)
    on conflict (customer_product_id, service_type)
    do update set rate       = excluded.rate,
                  unit_basis = excluded.unit_basis,
                  currency   = excluded.currency,
                  note       = excluded.note,
                  is_active  = excluded.is_active,
                  updated_at = now()
    returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function public.tgd_upsert_product_service_rate to authenticated;

-- ── 2. Role definitions (configurable display names + custom aliases) ────────
create table if not exists public.tgd_role_definitions (
  id           uuid primary key default gen_random_uuid(),
  role_code    text not null unique,        -- value stored in tgd_user_profiles.role
  display_name text not null,
  description  text,
  is_system    boolean not null default false,  -- true = built-in, false = custom
  base_role    text,                        -- for custom roles, underlying permission level
  sort_order   int not null default 99,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.tgd_role_definitions enable row level security;

drop policy if exists tgd_role_def_read on public.tgd_role_definitions;
create policy tgd_role_def_read
  on public.tgd_role_definitions for select to authenticated using (true);

drop policy if exists tgd_role_def_admin_write on public.tgd_role_definitions;
create policy tgd_role_def_admin_write
  on public.tgd_role_definitions for all to authenticated
  using (public.tgd_current_user_role() = 'admin')
  with check (public.tgd_current_user_role() = 'admin');

grant select, insert, update on public.tgd_role_definitions to authenticated;

-- Seed system roles
insert into public.tgd_role_definitions (role_code, display_name, description, is_system, sort_order) values
  ('admin',             'ผู้ดูแลระบบ (Admin)',              'เข้าถึงทุกฟีเจอร์ของระบบ', true, 1),
  ('warehouse_manager', 'ผู้จัดการคลัง (Manager)',          'ดูแลภาพรวมการดำเนินงานคลังสินค้า', true, 2),
  ('warehouse_admin',   'เจ้าหน้าที่คลัง (Warehouse Admin)','จัดการรับเข้า เบิกออก และยอดคงคลัง', true, 3),
  ('warehouse_staff',   'พนักงานคลัง (Staff)',              'ใช้งานระบบ Handheld สแกนสินค้า', true, 4),
  ('accounting',        'บัญชี (Accounting)',               'ดูรายงานการเรียกเก็บและใบแจ้งหนี้', true, 5),
  ('viewer',            'ผู้ดูข้อมูล (Viewer)',             'ดูข้อมูลรายงานเท่านั้น', true, 6),
  ('customer_user',     'ลูกค้า (Customer)',                'เข้าถึง Customer Portal', true, 7)
on conflict (role_code) do update
  set display_name = excluded.display_name,
      description  = excluded.description,
      is_system    = excluded.is_system,
      sort_order   = excluded.sort_order;

commit;
