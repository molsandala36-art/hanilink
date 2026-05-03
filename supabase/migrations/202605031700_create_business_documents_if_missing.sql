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

create index if not exists business_documents_user_id_idx
on public.business_documents(user_id, issue_date desc);

drop trigger if exists set_business_documents_updated_at on public.business_documents;
create trigger set_business_documents_updated_at
before update on public.business_documents
for each row execute function public.set_updated_at();

alter table public.business_documents enable row level security;

drop policy if exists "business_documents_owner_all" on public.business_documents;
create policy "business_documents_owner_all"
on public.business_documents for all
using (public.row_belongs_to_current_shop(user_id))
with check (public.row_belongs_to_current_shop(user_id));
