create extension if not exists pgcrypto;

alter table public.app_licenses
  add column if not exists owner_id uuid null references auth.users(id) on delete set null,
  add column if not exists plan text not null default 'lifetime',
  add column if not exists max_devices integer not null default 3,
  add column if not exists max_platforms integer not null default 3,
  add column if not exists is_subscription boolean not null default false,
  add column if not exists revoked_at timestamptz null,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.license_activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.app_licenses(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  platform text not null,
  device_id text not null,
  device_name text not null default '',
  app_version text not null default '',
  status text not null default 'active',
  activated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  unique (license_id, platform, device_id)
);

create index if not exists license_activations_license_idx
  on public.license_activations (license_id, status, last_seen_at desc);

create index if not exists license_activations_user_idx
  on public.license_activations (user_id, activated_at desc);

drop trigger if exists set_app_licenses_updated_at on public.app_licenses;
create trigger set_app_licenses_updated_at
before update on public.app_licenses
for each row execute function public.set_updated_at();

alter table public.license_activations enable row level security;

drop policy if exists "license_activations_owner_select" on public.license_activations;
create policy "license_activations_owner_select"
on public.license_activations for select
using (auth.uid() = user_id);

drop policy if exists "app_licenses_owner_all" on public.app_licenses;
create policy "app_licenses_owner_all"
on public.app_licenses for select
using (auth.uid() = owner_id);
