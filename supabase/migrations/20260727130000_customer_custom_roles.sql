-- Customer-side custom roles: a customer_admin can define named roles
-- scoped to their own company, each with a checklist of which
-- customer-portal menu items (keyed the same as navigationGroups' item
-- `key` in src/app/navigation.js) that role can see, then assign a role to
-- one of their company's customer_user accounts. A customer_admin can
-- never be targeted (only customer_user), and can never touch another
-- company's roles or users — every RPC resolves customer_id from the
-- caller's own profile server-side, never from a client-supplied value.
--
-- NULL customer_custom_role_id (the default, and what every existing
-- customer_user already has) means unrestricted — full access to every
-- customer-portal menu, exactly like today. Nothing changes for anyone
-- until an admin explicitly assigns a role.

begin;

create table if not exists public.tgd_customer_custom_roles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.tgd_customers(id) on delete cascade,
  role_name text not null,
  allowed_menu_keys text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tgd_customer_custom_roles_name_unique unique (customer_id, role_name)
);

create index if not exists tgd_customer_custom_roles_customer_idx
  on public.tgd_customer_custom_roles (customer_id);

drop trigger if exists set_tgd_customer_custom_roles_updated_at on public.tgd_customer_custom_roles;
create trigger set_tgd_customer_custom_roles_updated_at
  before update on public.tgd_customer_custom_roles
  for each row execute function public.set_updated_at();

alter table public.tgd_user_profiles
  add column if not exists customer_custom_role_id uuid references public.tgd_customer_custom_roles(id) on delete set null;

alter table public.tgd_customer_custom_roles enable row level security;

drop policy if exists rls_customer_custom_roles_select on public.tgd_customer_custom_roles;
create policy rls_customer_custom_roles_select
  on public.tgd_customer_custom_roles
  for select
  to authenticated
  using (
    public.tgd_current_user_role() in ('admin', 'accounting', 'warehouse_admin', 'warehouse_manager')
    or (
      public.tgd_current_user_role() in ('customer_admin', 'customer_user')
      and public.tgd_current_user_customer_id() = customer_id
    )
  );

drop policy if exists rls_customer_custom_roles_write on public.tgd_customer_custom_roles;
create policy rls_customer_custom_roles_write
  on public.tgd_customer_custom_roles
  for all
  to authenticated
  using (public.tgd_current_user_role() = 'admin')
  with check (public.tgd_current_user_role() = 'admin');

-- Writes for customer_admin go through the RPCs below (security definer,
-- so they can enforce "own company only" + "target must be customer_user"
-- server-side) rather than a direct RLS write policy, which couldn't
-- express "and the target profile's role is customer_user" against a
-- DIFFERENT table's row.

commit;
