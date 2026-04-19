import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdminUser } from '../_shared/auth.ts';

const randomKey = () =>
  `HANI-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { admin, currentUser } = await requireAdminUser(req.headers.get('Authorization'));
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'list');

    if (action === 'list') {
      const { data, error } = await admin
        .from('app_licenses')
        .select('id, key, status, hwid, created_at, activated_at, owner_id, plan, max_devices, max_platforms')
        .order('created_at', { ascending: false });
      if (error) throw error;

      return json(
        (data || []).map((license) => ({
          _id: license.id,
          key: license.key,
          status: license.status,
          active: String(license.status || '').toLowerCase() === 'active',
          hwid: license.hwid,
          ownerId: license.owner_id,
          plan: license.plan,
          maxDevices: license.max_devices,
          maxPlatforms: license.max_platforms,
          createdAt: license.created_at,
          activatedAt: license.activated_at,
        }))
      );
    }

    if (action === 'generate') {
      const key = String(body.key || randomKey()).trim().toUpperCase();
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from('app_licenses')
        .insert({
          key,
          status: 'Active',
          owner_id: currentUser.id,
          plan: body.plan || 'lifetime',
          max_devices: Number(body.maxDevices || 3),
          max_platforms: Number(body.maxPlatforms || 3),
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single();

      if (error) throw error;
      return json({
        _id: data.id,
        key: data.key,
        status: data.status,
        active: true,
        hwid: data.hwid,
        createdAt: data.created_at,
        activatedAt: data.activated_at,
      }, 201);
    }

    if (action === 'delete') {
      const id = String(body.id || '').trim();
      if (!id) return json({ message: 'id is required' }, 400);

      const { error } = await admin.from('app_licenses').delete().eq('id', id);
      if (error) throw error;
      return json({ message: 'License deleted' });
    }

    return json({ message: 'Unsupported action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return json({ message }, status);
  }
});
