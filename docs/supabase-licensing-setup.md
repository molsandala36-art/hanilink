# Supabase Licensing Setup

This project now includes multi-platform licensing for:

- web
- desktop
- Android
- iPhone / iPad

## 1. Apply the migration

In Supabase SQL Editor, run:

- [supabase/migrations/20260419_multiplatform_licensing.sql](C:/Users/grous%20info/.codex/worktrees/b969/hanilink-saas/supabase/migrations/20260419_multiplatform_licensing.sql:1)

## 2. Create your first test license

Open the SQL Editor and run:

- [supabase/seed/20260419_initial_license.sql](C:/Users/grous%20info/.codex/worktrees/b969/hanilink-saas/supabase/seed/20260419_initial_license.sql:1)

Replace:

- `YOUR_ADMIN_USER_ID` with your admin `auth.users.id`
- `YOUR_LICENSE_KEY` with something like `HANI-DEMO-2026`

## 3. Deploy the Edge Functions

Install the Supabase CLI if needed:

```bash
npm install -g supabase
```

Login:

```bash
supabase login
```

Link the project:

```bash
supabase link --project-ref fsepdkctrlsrysbvnnmk
```

Set required secrets:

```bash
supabase secrets set HANI_SUPABASE_URL=https://fsepdkctrlsrysbvnnmk.supabase.co
supabase secrets set HANI_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
supabase secrets set HANI_SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

Deploy the functions:

```bash
supabase functions deploy activate-license
supabase functions deploy verify-license
supabase functions deploy heartbeat-license
supabase functions deploy admin-licenses
```

## 4. Enable license enforcement in the app

In your frontend environment:

```env
VITE_ENABLE_LICENSE_ENFORCEMENT=true
VITE_SUPABASE_URL=https://fsepdkctrlsrysbvnnmk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

On Vercel, add the same variables in Project Settings -> Environment Variables.

## 5. Test the activation flow

1. Sign in with your admin account
2. Open the licensing screen in the app
3. Use the generated key, for example `HANI-DEMO-2026`
4. Activate once on web, desktop, Android, or iPhone/iPad
5. Confirm rows are created in:

- `public.app_licenses`
- `public.license_activations`

## 6. Expected behavior

- one license can activate multiple devices up to `max_devices`
- one license can activate multiple platform types up to `max_platforms`
- every platform keeps its own `device_id`
- revoking or expiring a license blocks future verification
