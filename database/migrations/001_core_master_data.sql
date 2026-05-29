create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists tgd_customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  customer_name text not null,
  customer_type text,
  tax_id text,
  contact_name text,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tgd_products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  product_name text not null,
  product_name_en text,
  barcode text,
  base_uom text not null,
  storage_type text,
  temperature_type text,
  shelf_life_days integer,
  weight_kg numeric,
  volume_cbm numeric,
  is_lot_controlled boolean not null default true,
  is_expiry_controlled boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_products_shelf_life_days_nonnegative check (
    shelf_life_days is null or shelf_life_days >= 0
  ),
  constraint tgd_products_weight_kg_nonnegative check (
    weight_kg is null or weight_kg >= 0
  ),
  constraint tgd_products_volume_cbm_nonnegative check (
    volume_cbm is null or volume_cbm >= 0
  )
);

create table if not exists tgd_warehouses (
  id uuid primary key default gen_random_uuid(),
  warehouse_code text not null unique,
  warehouse_name text not null,
  warehouse_type text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tgd_zones (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references tgd_warehouses(id),
  zone_code text not null,
  zone_name text not null,
  temperature_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_zones_warehouse_zone_code_unique unique (warehouse_id, zone_code)
);

create table if not exists tgd_rooms (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references tgd_zones(id),
  room_code text not null,
  room_name text not null,
  temperature_min numeric,
  temperature_max numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_rooms_zone_room_code_unique unique (zone_id, room_code),
  constraint tgd_rooms_temperature_range_valid check (
    temperature_min is null
    or temperature_max is null
    or temperature_min <= temperature_max
  )
);

create table if not exists tgd_locations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references tgd_rooms(id),
  location_code text not null,
  location_name text,
  location_type text,
  barcode text,
  is_pick_face boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_locations_room_location_code_unique unique (room_id, location_code)
);

create table if not exists tgd_pallets (
  id uuid primary key default gen_random_uuid(),
  pallet_code text not null unique,
  barcode text unique,
  current_location_id uuid references tgd_locations(id),
  pallet_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tgd_lots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references tgd_products(id),
  lot_no text not null,
  mfg_date date,
  exp_date date,
  received_date date,
  supplier_lot_no text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_lots_product_lot_no_unique unique (product_id, lot_no)
);

create unique index if not exists tgd_locations_barcode_unique_idx
  on tgd_locations (barcode)
  where barcode is not null;

create index if not exists tgd_customers_customer_code_idx on tgd_customers (customer_code);
create index if not exists tgd_customers_active_idx on tgd_customers (is_active) where is_active = true;

create index if not exists tgd_products_product_code_idx on tgd_products (product_code);
create index if not exists tgd_products_barcode_idx on tgd_products (barcode);
create index if not exists tgd_products_active_idx on tgd_products (is_active) where is_active = true;

create index if not exists tgd_warehouses_warehouse_code_idx on tgd_warehouses (warehouse_code);
create index if not exists tgd_warehouses_active_idx on tgd_warehouses (is_active) where is_active = true;

create index if not exists tgd_zones_warehouse_zone_code_idx on tgd_zones (warehouse_id, zone_code);
create index if not exists tgd_zones_active_idx on tgd_zones (is_active) where is_active = true;

create index if not exists tgd_rooms_zone_room_code_idx on tgd_rooms (zone_id, room_code);
create index if not exists tgd_rooms_active_idx on tgd_rooms (is_active) where is_active = true;

create index if not exists tgd_locations_room_location_code_idx on tgd_locations (room_id, location_code);
create index if not exists tgd_locations_barcode_idx on tgd_locations (barcode);
create index if not exists tgd_locations_active_idx on tgd_locations (is_active) where is_active = true;

create index if not exists tgd_pallets_pallet_code_idx on tgd_pallets (pallet_code);
create index if not exists tgd_pallets_barcode_idx on tgd_pallets (barcode);
create index if not exists tgd_pallets_current_location_id_idx on tgd_pallets (current_location_id);
create index if not exists tgd_pallets_active_idx on tgd_pallets (is_active) where is_active = true;

create index if not exists tgd_lots_product_lot_no_idx on tgd_lots (product_id, lot_no);
create index if not exists tgd_lots_active_idx on tgd_lots (is_active) where is_active = true;

drop trigger if exists set_tgd_customers_updated_at on tgd_customers;
create trigger set_tgd_customers_updated_at
before update on tgd_customers
for each row execute function set_updated_at();

drop trigger if exists set_tgd_products_updated_at on tgd_products;
create trigger set_tgd_products_updated_at
before update on tgd_products
for each row execute function set_updated_at();

drop trigger if exists set_tgd_warehouses_updated_at on tgd_warehouses;
create trigger set_tgd_warehouses_updated_at
before update on tgd_warehouses
for each row execute function set_updated_at();

drop trigger if exists set_tgd_zones_updated_at on tgd_zones;
create trigger set_tgd_zones_updated_at
before update on tgd_zones
for each row execute function set_updated_at();

drop trigger if exists set_tgd_rooms_updated_at on tgd_rooms;
create trigger set_tgd_rooms_updated_at
before update on tgd_rooms
for each row execute function set_updated_at();

drop trigger if exists set_tgd_locations_updated_at on tgd_locations;
create trigger set_tgd_locations_updated_at
before update on tgd_locations
for each row execute function set_updated_at();

drop trigger if exists set_tgd_pallets_updated_at on tgd_pallets;
create trigger set_tgd_pallets_updated_at
before update on tgd_pallets
for each row execute function set_updated_at();

drop trigger if exists set_tgd_lots_updated_at on tgd_lots;
create trigger set_tgd_lots_updated_at
before update on tgd_lots
for each row execute function set_updated_at();

