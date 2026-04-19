import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { admin, currentUser } = await requireUser(req.headers.get('Authorization'));
    const body = await req.json().catch(() => ({}));
    const deviceId = String(body.deviceId || '').trim();
    const platform = String(body.platform || '').trim();
    const appVersion = String(body.appVersion || '').trim();

    if (!deviceId || !platform) {
      return json({ active: false, message: 'deviceId and platform are required' }, 400);
    }

    const { data: activation, error } = await admin
      .from('license_activations')
      .select('id, status, platform, device_id, app_version, license:app_licenses(id, key, status, owner_id, expires_at, revoked_at, plan)')
      .eq('user_id', currentUser.id)
      .eq('device_id', deviceId)
      .eq('platform', platform)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    const license = activation?.license as Record<string, unknown> | undefined;
    const isExpired = license?.expires_at ? new Date(String(license.expires_at)).getTime() < Date.now() : false;
    const isRevoked = Boolean(license?.revoked_at) || String(license?.status || '').toLowerCase() !== 'active';

    if (!activation || !license || isExpired || isRevoked) {
      return json({ active: false, message: 'No active license for this device' }, 403);
    }

    await admin
      .from('license_activations')
      .update({
        last_seen_at: new Date().toISOString(),
        app_version: appVersion || '',
      })
      .eq('id', activation.id);

    return json({
      active: true,
      activation,
      license,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return json({ active: false, message }, status);
  }
});
