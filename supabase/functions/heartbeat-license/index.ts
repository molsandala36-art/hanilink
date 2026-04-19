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
      return json({ success: false, message: 'deviceId and platform are required' }, 400);
    }

    const { data, error } = await admin
      .from('license_activations')
      .update({
        last_seen_at: new Date().toISOString(),
        app_version: appVersion,
      })
      .eq('user_id', currentUser.id)
      .eq('device_id', deviceId)
      .eq('platform', platform)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return json({ success: false, message: 'Activation not found' }, 404);

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return json({ success: false, message }, status);
  }
});
