-- 035_tgd_wms_reason_codes_foundation.sql
-- Gate 2: Reason code master for adjustment/UAT references.
-- DRAFT ONLY until applied on confirmed UAT/DEV Supabase.
-- Production remains HOLD. FINAL GO is NOT AUTHORIZED.

create table if not exists public.tgd_reason_codes (
  id uuid primary key default gen_random_uuid(),
  reason_code text not null unique,
  reason_name text not null,
  reason_category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tgd_reason_codes_category_idx
  on public.tgd_reason_codes (reason_category);

insert into public.tgd_reason_codes (reason_code, reason_name, reason_category, is_active)
values
  ('UAT_ADJUST', 'UAT Adjustment', 'ADJUSTMENT', true),
  ('UAT_DAMAGE', 'UAT Damage Adjustment', 'ADJUSTMENT', true),
  ('UAT_COUNT', 'UAT Stock Count Variance', 'STOCK_COUNT', true),
  ('UAT_TRANSFER', 'UAT Internal Transfer Note', 'TRANSFER', true)
on conflict (reason_code) do nothing;

comment on table public.tgd_reason_codes is
  'Master reason codes for adjustment/stock count references. UAT/DEV seed only.';
