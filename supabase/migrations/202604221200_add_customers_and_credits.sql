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

create index if not exists customers_user_id_idx
on public.customers (user_id, created_at desc);

create index if not exists customer_credits_user_id_idx
on public.customer_credits (user_id, created_at desc);

create index if not exists customer_credits_customer_id_idx
on public.customer_credits (customer_id, created_at desc);

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_customer_credits_updated_at on public.customer_credits;
create trigger set_customer_credits_updated_at
before update on public.customer_credits
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.customer_credits enable row level security;

drop policy if exists "customers_owner_all" on public.customers;
create policy "customers_owner_all"
on public.customers for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "customer_credits_owner_all" on public.customer_credits;
create policy "customer_credits_owner_all"
on public.customer_credits for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
