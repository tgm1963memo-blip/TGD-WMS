-- 048_stock_balances_schema_alignment.sql
-- Non-destructive alignment when migration 001 created tgd_stock_balances before migration 002.
-- Safe to run on UAT/Dev only after review.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tgd_stock_balances'
      and column_name = 'warehouse_id'
  ) then
    alter table public.tgd_stock_balances
      add column warehouse_id uuid references public.tgd_warehouses(id);
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tgd_stock_balances'
      and column_name = 'qty_on_hand'
  ) then
    alter table public.tgd_stock_balances
      add column qty_on_hand numeric not null default 0;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tgd_stock_balances'
      and column_name = 'qty_allocated'
  ) then
    alter table public.tgd_stock_balances
      add column qty_allocated numeric not null default 0;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tgd_stock_balances'
      and column_name = 'pallet_id'
  ) then
    alter table public.tgd_stock_balances
      add column pallet_id uuid references public.tgd_pallets(id);
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tgd_stock_balances'
      and column_name = 'uom'
  ) then
    alter table public.tgd_stock_balances
      add column uom text;
  end if;
end $$;
