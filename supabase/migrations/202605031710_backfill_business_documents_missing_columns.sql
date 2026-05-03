alter table public.business_documents
add column if not exists customer_ice text not null default '',
add column if not exists customer_if text not null default '',
add column if not exists customer_rc text not null default '',
add column if not exists payment_method text not null default '',
add column if not exists payment_reference text not null default '',
add column if not exists restock_on_validate boolean not null default false,
add column if not exists created_by uuid null references auth.users(id) on delete set null,
add column if not exists updated_by uuid null references auth.users(id) on delete set null,
add column if not exists validated_by uuid null references auth.users(id) on delete set null,
add column if not exists validated_at timestamptz null,
add column if not exists cancelled_at timestamptz null;
