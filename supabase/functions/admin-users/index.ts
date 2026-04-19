import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdminUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { admin, currentUser } = await requireAdminUser(req.headers.get('Authorization'));
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'list').trim().toLowerCase();

    const { data: currentProfile, error: currentProfileError } = await admin
      .from('app_users')
      .select('company_owner_id, shop_name')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (currentProfileError) throw currentProfileError;

    const companyOwnerId = currentProfile?.company_owner_id || currentUser.id;
    const defaultShopName = currentProfile?.shop_name || 'HaniLink';

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const name = String(body.name || '').trim();
      const role = String(body.role || 'employee').trim().toLowerCase();
      const shopName = String(body.shopName || defaultShopName).trim() || defaultShopName;

      if (!email || !password || !name) {
        return json({ message: 'name, email and password are required' }, 400);
      }

      const { data: createdAuthUser, error: createAuthError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          shopName,
          role,
        },
      });

      if (createAuthError) throw createAuthError;
      if (!createdAuthUser.user?.id) {
        return json({ message: 'Unable to create auth user' }, 500);
      }

      const { data: createdProfile, error: createProfileError } = await admin
        .from('app_users')
        .insert({
          id: createdAuthUser.user.id,
          name,
          email,
          company_owner_id: companyOwnerId,
          shop_name: shopName,
          role,
        })
        .select('*')
        .single();

      if (createProfileError) throw createProfileError;

      return json(
        {
          _id: createdProfile.id,
          id: createdProfile.id,
          name: createdProfile.name,
          email: createdProfile.email,
          shopName: createdProfile.shop_name || '',
          role: createdProfile.role || 'employee',
          createdAt: createdProfile.created_at,
        },
        201
      );
    }

    if (action === 'update') {
      const id = String(body.id || '').trim();
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const shopName = String(body.shopName || defaultShopName).trim() || defaultShopName;

      if (!id || !name || !email) {
        return json({ message: 'id, name and email are required' }, 400);
      }

      const { data: targetProfile, error: targetProfileError } = await admin
        .from('app_users')
        .select('*')
        .eq('id', id)
        .eq('company_owner_id', companyOwnerId)
        .maybeSingle();

      if (targetProfileError) throw targetProfileError;
      if (!targetProfile) return json({ message: 'User not found' }, 404);

      const { error: updateAuthError } = await admin.auth.admin.updateUserById(id, {
        email,
        user_metadata: {
          ...(targetProfile.permissions || {}),
          name,
          shopName,
          role: targetProfile.role || 'employee',
        },
      });

      if (updateAuthError) throw updateAuthError;

      const { data: updatedProfile, error: updateProfileError } = await admin
        .from('app_users')
        .update({
          name,
          email,
          shop_name: shopName,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateProfileError) throw updateProfileError;

      return json({
        _id: updatedProfile.id,
        id: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email,
        shopName: updatedProfile.shop_name || '',
        role: updatedProfile.role || 'employee',
        createdAt: updatedProfile.created_at,
      });
    }

    if (action === 'role') {
      const id = String(body.id || '').trim();
      const role = String(body.role || '').trim().toLowerCase();

      if (!id || !role) {
        return json({ message: 'id and role are required' }, 400);
      }

      if (id === currentUser.id) {
        return json({ message: 'You cannot change your own role' }, 400);
      }

      const { data: targetProfile, error: targetProfileError } = await admin
        .from('app_users')
        .select('*')
        .eq('id', id)
        .eq('company_owner_id', companyOwnerId)
        .maybeSingle();

      if (targetProfileError) throw targetProfileError;
      if (!targetProfile) return json({ message: 'User not found' }, 404);

      const { error: updateProfileError } = await admin
        .from('app_users')
        .update({ role })
        .eq('id', id);

      if (updateProfileError) throw updateProfileError;

      const { error: updateAuthError } = await admin.auth.admin.updateUserById(id, {
        user_metadata: {
          name: targetProfile.name,
          shopName: targetProfile.shop_name || defaultShopName,
          role,
        },
      });

      if (updateAuthError) throw updateAuthError;

      return json({ success: true });
    }

    if (action === 'delete') {
      const id = String(body.id || '').trim();

      if (!id) {
        return json({ message: 'id is required' }, 400);
      }

      if (id === currentUser.id) {
        return json({ message: 'You cannot delete your own account' }, 400);
      }

      const { data: targetProfile, error: targetProfileError } = await admin
        .from('app_users')
        .select('id')
        .eq('id', id)
        .eq('company_owner_id', companyOwnerId)
        .maybeSingle();

      if (targetProfileError) throw targetProfileError;
      if (!targetProfile) return json({ message: 'User not found' }, 404);

      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(id);
      if (deleteAuthError) throw deleteAuthError;

      return json({ success: true });
    }

    return json({ message: 'Unsupported action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message === 'Unauthorized' ? 401 :
      message === 'Forbidden' ? 403 :
      500;
    return json({ message }, status);
  }
});
