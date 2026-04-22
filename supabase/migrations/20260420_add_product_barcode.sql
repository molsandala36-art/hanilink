alter table public.products
add column if not exists barcode text not null default '';

create index if not exists products_user_barcode_idx
on public.products (user_id, barcode);
