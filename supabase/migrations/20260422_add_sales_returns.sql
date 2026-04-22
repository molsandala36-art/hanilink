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

create index if not exists sales_returns_user_id_idx
on public.sales_returns (user_id, created_at desc);

create index if not exists sales_returns_sale_id_idx
on public.sales_returns (sale_id, created_at desc);

drop trigger if exists set_sales_returns_updated_at on public.sales_returns;
create trigger set_sales_returns_updated_at
before update on public.sales_returns
for each row execute function public.set_updated_at();

alter table public.sales_returns enable row level security;

drop policy if exists "sales_returns_owner_all" on public.sales_returns;
create policy "sales_returns_owner_all"
on public.sales_returns for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
