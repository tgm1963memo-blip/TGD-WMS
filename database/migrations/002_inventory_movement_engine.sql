create table if not exists tgd_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  movement_no text not null unique,
  movement_type text not null,
  movement_subtype text,
  customer_id uuid not null references tgd_customers(id),
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  from_warehouse_id uuid references tgd_warehouses(id),
  from_location_id uuid references tgd_locations(id),
  from_pallet_id uuid references tgd_pallets(id),
  to_warehouse_id uuid references tgd_warehouses(id),
  to_location_id uuid references tgd_locations(id),
  to_pallet_id uuid references tgd_pallets(id),
  qty numeric not null,
  uom text not null,
  reference_type text,
  reference_no text,
  reference_id uuid,
  reason_code text,
  remark text,
  created_by uuid,
  created_at timestamptz not null default now(),
  is_reversed boolean not null default false,
  reversed_by_movement_id uuid references tgd_inventory_movements(id),
  constraint tgd_inventory_movements_qty_positive check (qty > 0),
  constraint tgd_inventory_movements_type_check check (
    movement_type in (
      'OPENING_BALANCE',
      'RECEIVE',
      'PUTAWAY',
      'TRANSFER',
      'ADJUST_IN',
      'ADJUST_OUT',
      'PICK_ALLOCATE',
      'PICK_CONFIRM',
      'RETURN_IN',
      'REVERSE'
    )
  )
);

create table if not exists tgd_stock_balances (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references tgd_customers(id),
  product_id uuid not null references tgd_products(id),
  lot_id uuid references tgd_lots(id),
  warehouse_id uuid not null references tgd_warehouses(id),
  location_id uuid not null references tgd_locations(id),
  pallet_id uuid references tgd_pallets(id),
  qty_on_hand numeric not null default 0,
  qty_allocated numeric not null default 0,
  qty_available numeric generated always as (qty_on_hand - qty_allocated) stored,
  last_movement_id uuid references tgd_inventory_movements(id),
  updated_at timestamptz not null default now(),
  constraint tgd_stock_balances_qty_on_hand_nonnegative check (qty_on_hand >= 0),
  constraint tgd_stock_balances_qty_allocated_nonnegative check (qty_allocated >= 0),
  constraint tgd_stock_balances_allocated_lte_on_hand check (qty_allocated <= qty_on_hand)
);

create unique index if not exists tgd_stock_balances_identity_unique_idx
  on tgd_stock_balances (
    customer_id,
    product_id,
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
    warehouse_id,
    location_id,
    coalesce(pallet_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists tgd_inventory_movements_movement_no_idx
  on tgd_inventory_movements (movement_no);
create index if not exists tgd_inventory_movements_movement_type_idx
  on tgd_inventory_movements (movement_type);
create index if not exists tgd_inventory_movements_customer_product_idx
  on tgd_inventory_movements (customer_id, product_id);
create index if not exists tgd_inventory_movements_created_at_idx
  on tgd_inventory_movements (created_at);
create index if not exists tgd_inventory_movements_reference_idx
  on tgd_inventory_movements (reference_type, reference_no);

create index if not exists tgd_stock_balances_customer_product_idx
  on tgd_stock_balances (customer_id, product_id);
create index if not exists tgd_stock_balances_customer_product_lot_idx
  on tgd_stock_balances (customer_id, product_id, lot_id);
create index if not exists tgd_stock_balances_location_id_idx
  on tgd_stock_balances (location_id);
create index if not exists tgd_stock_balances_pallet_id_idx
  on tgd_stock_balances (pallet_id);
create index if not exists tgd_stock_balances_qty_available_idx
  on tgd_stock_balances (qty_available);

create or replace function tgd_guard_stock_balance_write()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('tgd.allow_stock_balance_write', true), '') <> 'on' then
    raise exception 'stock balances may only be changed by tgd_post_inventory_movement';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_tgd_stock_balances_write on tgd_stock_balances;
create trigger guard_tgd_stock_balances_write
before insert or update or delete on tgd_stock_balances
for each row execute function tgd_guard_stock_balance_write();

create or replace function tgd_find_stock_balance_id(
  p_customer_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_pallet_id uuid
)
returns uuid
language sql
as $$
  select id
  from tgd_stock_balances
  where customer_id = p_customer_id
    and product_id = p_product_id
    and lot_id is not distinct from p_lot_id
    and warehouse_id = p_warehouse_id
    and location_id = p_location_id
    and pallet_id is not distinct from p_pallet_id
  for update;
$$;

create or replace function tgd_increase_stock(
  p_customer_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_pallet_id uuid,
  p_qty numeric,
  p_movement_id uuid
)
returns void
language plpgsql
as $$
declare
  v_balance_id uuid;
begin
  if p_warehouse_id is null or p_location_id is null then
    raise exception 'to warehouse and location are required for stock increase';
  end if;

  select tgd_find_stock_balance_id(
    p_customer_id,
    p_product_id,
    p_lot_id,
    p_warehouse_id,
    p_location_id,
    p_pallet_id
  ) into v_balance_id;

  if v_balance_id is null then
    insert into tgd_stock_balances (
      customer_id,
      product_id,
      lot_id,
      warehouse_id,
      location_id,
      pallet_id,
      qty_on_hand,
      qty_allocated,
      last_movement_id,
      updated_at
    )
    values (
      p_customer_id,
      p_product_id,
      p_lot_id,
      p_warehouse_id,
      p_location_id,
      p_pallet_id,
      p_qty,
      0,
      p_movement_id,
      now()
    );
  else
    update tgd_stock_balances
    set qty_on_hand = qty_on_hand + p_qty,
        last_movement_id = p_movement_id,
        updated_at = now()
    where id = v_balance_id;
  end if;
end;
$$;

create or replace function tgd_decrease_stock(
  p_customer_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_pallet_id uuid,
  p_qty numeric,
  p_movement_id uuid
)
returns void
language plpgsql
as $$
declare
  v_balance tgd_stock_balances%rowtype;
begin
  if p_warehouse_id is null or p_location_id is null then
    raise exception 'from warehouse and location are required for stock decrease';
  end if;

  select *
  into v_balance
  from tgd_stock_balances
  where customer_id = p_customer_id
    and product_id = p_product_id
    and lot_id is not distinct from p_lot_id
    and warehouse_id = p_warehouse_id
    and location_id = p_location_id
    and pallet_id is not distinct from p_pallet_id
  for update;

  if v_balance.id is null then
    raise exception 'stock balance does not exist for requested decrease';
  end if;

  if v_balance.qty_available < p_qty then
    raise exception 'insufficient available stock';
  end if;

  update tgd_stock_balances
  set qty_on_hand = qty_on_hand - p_qty,
      last_movement_id = p_movement_id,
      updated_at = now()
  where id = v_balance.id;
end;
$$;

create or replace function tgd_allocate_stock(
  p_customer_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_pallet_id uuid,
  p_qty numeric,
  p_movement_id uuid
)
returns void
language plpgsql
as $$
declare
  v_balance tgd_stock_balances%rowtype;
begin
  select *
  into v_balance
  from tgd_stock_balances
  where customer_id = p_customer_id
    and product_id = p_product_id
    and lot_id is not distinct from p_lot_id
    and warehouse_id = p_warehouse_id
    and location_id = p_location_id
    and pallet_id is not distinct from p_pallet_id
  for update;

  if v_balance.id is null then
    raise exception 'stock balance does not exist for allocation';
  end if;

  if v_balance.qty_available < p_qty then
    raise exception 'insufficient available stock for allocation';
  end if;

  update tgd_stock_balances
  set qty_allocated = qty_allocated + p_qty,
      last_movement_id = p_movement_id,
      updated_at = now()
  where id = v_balance.id;
end;
$$;

create or replace function tgd_deallocate_stock(
  p_customer_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_pallet_id uuid,
  p_qty numeric,
  p_movement_id uuid
)
returns void
language plpgsql
as $$
declare
  v_balance tgd_stock_balances%rowtype;
begin
  select *
  into v_balance
  from tgd_stock_balances
  where customer_id = p_customer_id
    and product_id = p_product_id
    and lot_id is not distinct from p_lot_id
    and warehouse_id = p_warehouse_id
    and location_id = p_location_id
    and pallet_id is not distinct from p_pallet_id
  for update;

  if v_balance.id is null then
    raise exception 'stock balance does not exist for deallocation';
  end if;

  if v_balance.qty_allocated < p_qty then
    raise exception 'insufficient allocated stock';
  end if;

  update tgd_stock_balances
  set qty_allocated = qty_allocated - p_qty,
      last_movement_id = p_movement_id,
      updated_at = now()
  where id = v_balance.id;
end;
$$;

create or replace function tgd_confirm_pick_stock(
  p_customer_id uuid,
  p_product_id uuid,
  p_lot_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid,
  p_pallet_id uuid,
  p_qty numeric,
  p_movement_id uuid
)
returns void
language plpgsql
as $$
declare
  v_balance tgd_stock_balances%rowtype;
begin
  select *
  into v_balance
  from tgd_stock_balances
  where customer_id = p_customer_id
    and product_id = p_product_id
    and lot_id is not distinct from p_lot_id
    and warehouse_id = p_warehouse_id
    and location_id = p_location_id
    and pallet_id is not distinct from p_pallet_id
  for update;

  if v_balance.id is null then
    raise exception 'stock balance does not exist for pick confirmation';
  end if;

  if v_balance.qty_allocated < p_qty then
    raise exception 'insufficient allocated stock for pick confirmation';
  end if;

  update tgd_stock_balances
  set qty_on_hand = qty_on_hand - p_qty,
      qty_allocated = qty_allocated - p_qty,
      last_movement_id = p_movement_id,
      updated_at = now()
  where id = v_balance.id;
end;
$$;

create or replace function tgd_post_inventory_movement(input jsonb)
returns table (movement_id uuid, movement_no text)
language plpgsql
as $$
declare
  v_movement_id uuid;
  v_movement_no text;
  v_movement_type text;
  v_qty numeric;
  v_original tgd_inventory_movements%rowtype;
begin
  perform set_config('tgd.allow_stock_balance_write', 'on', true);

  v_movement_type := input->>'movement_type';
  v_qty := nullif(input->>'qty', '')::numeric;
  v_movement_no := coalesce(
    nullif(input->>'movement_no', ''),
    'MOV-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substr(gen_random_uuid()::text, 1, 8)
  );

  if v_movement_type not in (
    'OPENING_BALANCE',
    'RECEIVE',
    'PUTAWAY',
    'TRANSFER',
    'ADJUST_IN',
    'ADJUST_OUT',
    'PICK_ALLOCATE',
    'PICK_CONFIRM',
    'RETURN_IN',
    'REVERSE'
  ) then
    raise exception 'invalid movement_type: %', v_movement_type;
  end if;

  if v_qty is null or v_qty <= 0 then
    raise exception 'qty must be greater than zero';
  end if;

  if v_movement_type = 'REVERSE' then
    select *
    into v_original
    from tgd_inventory_movements
    where id = nullif(input->>'reversed_by_movement_id', '')::uuid
    for update;

    if v_original.id is null then
      raise exception 'original movement is required for reverse';
    end if;

    if v_original.is_reversed then
      raise exception 'original movement is already reversed';
    end if;

    if v_original.movement_type = 'REVERSE' then
      raise exception 'reverse movements cannot be reversed';
    end if;

    if v_qty <> v_original.qty then
      raise exception 'Sprint 1B reverse requires full original quantity';
    end if;

    insert into tgd_inventory_movements (
      movement_no,
      movement_type,
      movement_subtype,
      customer_id,
      product_id,
      lot_id,
      from_warehouse_id,
      from_location_id,
      from_pallet_id,
      to_warehouse_id,
      to_location_id,
      to_pallet_id,
      qty,
      uom,
      reference_type,
      reference_no,
      reference_id,
      reason_code,
      remark,
      created_by,
      reversed_by_movement_id
    )
    values (
      v_movement_no,
      v_movement_type,
      input->>'movement_subtype',
      v_original.customer_id,
      v_original.product_id,
      v_original.lot_id,
      v_original.to_warehouse_id,
      v_original.to_location_id,
      v_original.to_pallet_id,
      v_original.from_warehouse_id,
      v_original.from_location_id,
      v_original.from_pallet_id,
      v_qty,
      v_original.uom,
      coalesce(input->>'reference_type', 'MOVEMENT_REVERSAL'),
      coalesce(input->>'reference_no', v_original.movement_no),
      v_original.id,
      input->>'reason_code',
      input->>'remark',
      nullif(input->>'created_by', '')::uuid,
      v_original.id
    )
    returning id into v_movement_id;

    if v_original.movement_type in ('OPENING_BALANCE', 'RECEIVE', 'ADJUST_IN', 'RETURN_IN') then
      perform tgd_decrease_stock(
        v_original.customer_id,
        v_original.product_id,
        v_original.lot_id,
        v_original.to_warehouse_id,
        v_original.to_location_id,
        v_original.to_pallet_id,
        v_qty,
        v_movement_id
      );
    elsif v_original.movement_type in ('PUTAWAY', 'TRANSFER') then
      perform tgd_decrease_stock(
        v_original.customer_id,
        v_original.product_id,
        v_original.lot_id,
        v_original.to_warehouse_id,
        v_original.to_location_id,
        v_original.to_pallet_id,
        v_qty,
        v_movement_id
      );
      perform tgd_increase_stock(
        v_original.customer_id,
        v_original.product_id,
        v_original.lot_id,
        v_original.from_warehouse_id,
        v_original.from_location_id,
        v_original.from_pallet_id,
        v_qty,
        v_movement_id
      );
    elsif v_original.movement_type = 'ADJUST_OUT' then
      perform tgd_increase_stock(
        v_original.customer_id,
        v_original.product_id,
        v_original.lot_id,
        v_original.from_warehouse_id,
        v_original.from_location_id,
        v_original.from_pallet_id,
        v_qty,
        v_movement_id
      );
    elsif v_original.movement_type = 'PICK_ALLOCATE' then
      perform tgd_deallocate_stock(
        v_original.customer_id,
        v_original.product_id,
        v_original.lot_id,
        v_original.from_warehouse_id,
        v_original.from_location_id,
        v_original.from_pallet_id,
        v_qty,
        v_movement_id
      );
    elsif v_original.movement_type = 'PICK_CONFIRM' then
      perform tgd_increase_stock(
        v_original.customer_id,
        v_original.product_id,
        v_original.lot_id,
        v_original.from_warehouse_id,
        v_original.from_location_id,
        v_original.from_pallet_id,
        v_qty,
        v_movement_id
      );
      perform tgd_allocate_stock(
        v_original.customer_id,
        v_original.product_id,
        v_original.lot_id,
        v_original.from_warehouse_id,
        v_original.from_location_id,
        v_original.from_pallet_id,
        v_qty,
        v_movement_id
      );
    end if;

    update tgd_inventory_movements
    set is_reversed = true
    where id = v_original.id;

    movement_id := v_movement_id;
    movement_no := v_movement_no;
    return next;
    return;
  end if;

  insert into tgd_inventory_movements (
    movement_no,
    movement_type,
    movement_subtype,
    customer_id,
    product_id,
    lot_id,
    from_warehouse_id,
    from_location_id,
    from_pallet_id,
    to_warehouse_id,
    to_location_id,
    to_pallet_id,
    qty,
    uom,
    reference_type,
    reference_no,
    reference_id,
    reason_code,
    remark,
    created_by
  )
  values (
    v_movement_no,
    v_movement_type,
    input->>'movement_subtype',
    nullif(input->>'customer_id', '')::uuid,
    nullif(input->>'product_id', '')::uuid,
    nullif(input->>'lot_id', '')::uuid,
    nullif(input->>'from_warehouse_id', '')::uuid,
    nullif(input->>'from_location_id', '')::uuid,
    nullif(input->>'from_pallet_id', '')::uuid,
    nullif(input->>'to_warehouse_id', '')::uuid,
    nullif(input->>'to_location_id', '')::uuid,
    nullif(input->>'to_pallet_id', '')::uuid,
    v_qty,
    input->>'uom',
    input->>'reference_type',
    input->>'reference_no',
    nullif(input->>'reference_id', '')::uuid,
    input->>'reason_code',
    input->>'remark',
    nullif(input->>'created_by', '')::uuid
  )
  returning id into v_movement_id;

  if v_movement_type in ('OPENING_BALANCE', 'RECEIVE', 'ADJUST_IN', 'RETURN_IN') then
    perform tgd_increase_stock(
      nullif(input->>'customer_id', '')::uuid,
      nullif(input->>'product_id', '')::uuid,
      nullif(input->>'lot_id', '')::uuid,
      nullif(input->>'to_warehouse_id', '')::uuid,
      nullif(input->>'to_location_id', '')::uuid,
      nullif(input->>'to_pallet_id', '')::uuid,
      v_qty,
      v_movement_id
    );
  elsif v_movement_type in ('PUTAWAY', 'TRANSFER') then
    perform tgd_decrease_stock(
      nullif(input->>'customer_id', '')::uuid,
      nullif(input->>'product_id', '')::uuid,
      nullif(input->>'lot_id', '')::uuid,
      nullif(input->>'from_warehouse_id', '')::uuid,
      nullif(input->>'from_location_id', '')::uuid,
      nullif(input->>'from_pallet_id', '')::uuid,
      v_qty,
      v_movement_id
    );
    perform tgd_increase_stock(
      nullif(input->>'customer_id', '')::uuid,
      nullif(input->>'product_id', '')::uuid,
      nullif(input->>'lot_id', '')::uuid,
      nullif(input->>'to_warehouse_id', '')::uuid,
      nullif(input->>'to_location_id', '')::uuid,
      nullif(input->>'to_pallet_id', '')::uuid,
      v_qty,
      v_movement_id
    );
  elsif v_movement_type = 'ADJUST_OUT' then
    perform tgd_decrease_stock(
      nullif(input->>'customer_id', '')::uuid,
      nullif(input->>'product_id', '')::uuid,
      nullif(input->>'lot_id', '')::uuid,
      nullif(input->>'from_warehouse_id', '')::uuid,
      nullif(input->>'from_location_id', '')::uuid,
      nullif(input->>'from_pallet_id', '')::uuid,
      v_qty,
      v_movement_id
    );
  elsif v_movement_type = 'PICK_ALLOCATE' then
    perform tgd_allocate_stock(
      nullif(input->>'customer_id', '')::uuid,
      nullif(input->>'product_id', '')::uuid,
      nullif(input->>'lot_id', '')::uuid,
      nullif(input->>'from_warehouse_id', '')::uuid,
      nullif(input->>'from_location_id', '')::uuid,
      nullif(input->>'from_pallet_id', '')::uuid,
      v_qty,
      v_movement_id
    );
  elsif v_movement_type = 'PICK_CONFIRM' then
    perform tgd_confirm_pick_stock(
      nullif(input->>'customer_id', '')::uuid,
      nullif(input->>'product_id', '')::uuid,
      nullif(input->>'lot_id', '')::uuid,
      nullif(input->>'from_warehouse_id', '')::uuid,
      nullif(input->>'from_location_id', '')::uuid,
      nullif(input->>'from_pallet_id', '')::uuid,
      v_qty,
      v_movement_id
    );
  end if;

  movement_id := v_movement_id;
  movement_no := v_movement_no;
  return next;
end;
$$;
