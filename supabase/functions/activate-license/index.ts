import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUserByIdOrAuth } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { admin, currentUser } = await requireUserByIdOrAuth(body.userId, req.headers.get('Authorization'));
    const key = String(body.key || '').trim().toUpperCase();
    const deviceId = String(body.deviceId || '').trim();
    const platform = String(body.platform || '').trim();
    const deviceName = String(body.deviceName || '').trim();
    const appVersion = String(body.appVersion || '').trim();

    if (!key || !deviceId || !platform) {
      return json({ success: false, message: 'key, deviceId and platform are required' }, 400);
    }

    const { data: license, error: licenseError } = await admin
      .from('app_licenses')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (licenseError) throw licenseError;
    if (!license) return json({ success: false, message: 'Invalid license key' }, 404);
    if (String(license.status || '').toLowerCase() !== 'active' || license.revoked_at) {
      return json({ success: false, message: 'License disabled or revoked' }, 403);
    }
    if (license.expires_at && new Date(String(license.expires_at)).getTime() < Date.now()) {
      return json({ success: false, message: 'License expired' }, 403);
    }
    if (license.owner_id && license.owner_id !== currentUser.id) {
      return json({ success: false, message: 'License already assigned to another account' }, 403);
    }

    const { data: activeActivations, error: activationsError } = await admin
      .from('license_activations')
      .select('id, platform, device_id')
      .eq('license_id', license.id)
      .eq('status', 'active');

    if (activationsError) throw activationsError;

    const activationList = activeActivations || [];
    const deviceCount = new Set(activationList.map((entry) => `${entry.platform}:${entry.device_id}`)).size;
    const platformCount = new Set(activationList.map((entry) => entry.platform)).size;
    const existingActivation = activationList.find((entry) => entry.platform === platform && entry.device_id === deviceId);

    if (!existingActivation && deviceCount >= Number(license.max_devices || 1)) {
      return json({ success: false, message: 'Device limit reached for this license' }, 403);
    }

    if (!existingActivation && !activationList.some((entry) => entry.platform === platform) && platformCount >= Number(license.max_platforms || 1)) {
      return json({ success: false, message: 'Platform limit reached for this license' }, 403);
    }

    const now = new Date().toISOString();
    const { data: activation, error: upsertError } = await admin
      .from('license_activations')
      .upsert({
        license_id: license.id,
        user_id: currentUser.id,
        platform,
        device_id: deviceId,
        device_name: deviceName,
        app_version: appVersion,
        status: 'active',
        activated_at: existingActivation ? undefined : now,
        last_seen_at: now,
      }, { onConflict: 'license_id,platform,device_id' })
      .select('*')
      .single();

    if (upsertError) throw upsertError;

    const { error: licenseUpdateError } = await admin
      .from('app_licenses')
      .update({
        owner_id: currentUser.id,
        hwid: deviceId,
        activated_at: now,
      })
      .eq('id', license.id);

    if (licenseUpdateError) throw licenseUpdateError;

    return json({
      success: true,
      active: true,
      activation,
      license: {
        id: license.id,
        key: license.key,
        plan: license.plan,
        maxDevices: license.max_devices,
        maxPlatforms: license.max_platforms,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return json({ success: false, message }, status);
  }
});
