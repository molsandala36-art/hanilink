-- Replace these values before running:
--   YOUR_ADMIN_USER_ID   -> auth.users.id of your admin account
--   YOUR_LICENSE_KEY     -> the license key you want to activate in the app

insert into public.app_licenses (
  key,
  hwid,
  status,
  owner_id,
  plan,
  max_devices,
  max_platforms,
  is_subscription,
  created_at,
  updated_at
)
values (
  'YOUR_LICENSE_KEY',
  '',
  'Active',
  'YOUR_ADMIN_USER_ID',
  'lifetime',
  5,
  4,
  false,
  timezone('utc', now()),
  timezone('utc', now())
)
on conflict (key) do update
set
  owner_id = excluded.owner_id,
  status = excluded.status,
  plan = excluded.plan,
  max_devices = excluded.max_devices,
  max_platforms = excluded.max_platforms,
  is_subscription = excluded.is_subscription,
  updated_at = timezone('utc', now());
