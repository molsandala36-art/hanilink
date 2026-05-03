alter table public.sales
add column if not exists created_by uuid null references auth.users(id) on delete set null;

update public.sales
set created_by = user_id
where created_by is null;
