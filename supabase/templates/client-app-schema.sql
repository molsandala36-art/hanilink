create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_shop_owner_id()
returns uuid
language sql
stable
as $$
  select coalesce(au.company_owner_id, au.id)
  from public.app_users au
  where au.id = auth.uid()
$$;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null unique,
  company_owner_id uuid null references auth.users(id) on delete set null,
  shop_name text not null default '',
  ice text not null default '',
  if_value text not null default '',
  rc text not null default '',
  address text not null default '',
  role text not null default 'admin',
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  address text not null default '',
  email text not null default '',
  ice text not null default '',
  linked_products jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  credit_limit numeric(12,2) not null default 0,
  opening_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  entry_type text not null default 'credit',
  payment_method text not null default 'cash',
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid null references public.suppliers(id) on delete set null,
  name text not null,
  price numeric(12,2) not null default 0,
  purchase_price numeric(12,2) not null default 0,
  stock integer not null default 0,
  category text not null default 'General',
  tva_rate numeric(5,2) not null default 20,
  supplier_tva numeric(5,2) not null default 20,
  barcode text not null default '',
  place text not null default '',
  photo_url text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(12,2) not null default 0,
  tva_amount numeric(12,2) not null default 0,
  payment_method text not null default 'cash',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  subtotal_amount numeric(12,2) not null default 0,
  tva_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  refund_method text not null default 'cash',
  reason text not null default '',
  notes text not null default '',
  restocked boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null default 0,
  category text not null default 'General',
  expense_date timestamptz not null default timezone('utc', now()),
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid null references public.suppliers(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'Pending',
  expected_delivery_date timestamptz null,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  document_number text not null,
  source_document_id uuid null references public.business_documents(id) on delete set null,
  source_document_type text null,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_address text not null default '',
  customer_ice text not null default '',
  customer_if text not null default '',
  customer_rc text not null default '',
  issue_date timestamptz not null default timezone('utc', now()),
  due_date timestamptz null,
  status text not null default 'draft',
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_method text not null default '',
  payment_reference text not null default '',
  restock_on_validate boolean not null default false,
  notes text not null default '',
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  validated_by uuid null references auth.users(id) on delete set null,
  validated_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (document_number)
);

create index if not exists suppliers_user_id_idx on public.suppliers(user_id, created_at desc);
create index if not exists customers_user_id_idx on public.customers(user_id, created_at desc);
create index if not exists customer_credits_user_id_idx on public.customer_credits(user_id, created_at desc);
create index if not exists customer_credits_customer_id_idx on public.customer_credits(customer_id, created_at desc);
create index if not exists products_user_id_idx on public.products(user_id, created_at desc);
create index if not exists sales_user_id_idx on public.sales(user_id, created_at desc);
create index if not exists sales_returns_user_id_idx on public.sales_returns(user_id, created_at desc);
create index if not exists sales_returns_sale_id_idx on public.sales_returns(sale_id, created_at desc);
create index if not exists expenses_user_id_idx on public.expenses(user_id, expense_date desc);
create index if not exists purchase_orders_user_id_idx on public.purchase_orders(user_id, created_at desc);
create index if not exists business_documents_user_id_idx on public.business_documents(user_id, issue_date desc);

drop trigger if exists set_app_users_updated_at on public.app_users;
create trigger set_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_customer_credits_updated_at on public.customer_credits;
create trigger set_customer_credits_updated_at
before update on public.customer_credits
for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_sales_updated_at on public.sales;
create trigger set_sales_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

drop trigger if exists set_sales_returns_updated_at on public.sales_returns;
create trigger set_sales_returns_updated_at
before update on public.sales_returns
for each row execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_purchase_orders_updated_at on public.purchase_orders;
create trigger set_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

drop trigger if exists set_business_documents_updated_at on public.business_documents;
create trigger set_business_documents_updated_at
before update on public.business_documents
for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.customer_credits enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sales_returns enable row level security;
alter table public.expenses enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.business_documents enable row level security;

drop policy if exists "app_users_select_own" on public.app_users;
create policy "app_users_select_own"
on public.app_users for select
using (auth.uid() = id);

drop policy if exists "app_users_insert_own" on public.app_users;
create policy "app_users_insert_own"
on public.app_users for insert
with check (auth.uid() = id);

drop policy if exists "app_users_update_own" on public.app_users;
create policy "app_users_update_own"
on public.app_users for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "suppliers_owner_all" on public.suppliers;
create policy "suppliers_owner_all"
on public.suppliers for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "customers_owner_all" on public.customers;
create policy "customers_owner_all"
on public.customers for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "customer_credits_owner_all" on public.customer_credits;
create policy "customer_credits_owner_all"
on public.customer_credits for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "products_owner_all" on public.products;
create policy "products_owner_all"
on public.products for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "sales_owner_all" on public.sales;
create policy "sales_owner_all"
on public.sales for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "sales_returns_owner_all" on public.sales_returns;
create policy "sales_returns_owner_all"
on public.sales_returns for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "expenses_owner_all" on public.expenses;
create policy "expenses_owner_all"
on public.expenses for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "purchase_orders_owner_all" on public.purchase_orders;
create policy "purchase_orders_owner_all"
on public.purchase_orders for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);

drop policy if exists "business_documents_owner_all" on public.business_documents;
create policy "business_documents_owner_all"
on public.business_documents for all
using (public.current_shop_owner_id() = user_id)
with check (public.current_shop_owner_id() = user_id);
