import { createClient } from 'npm:@supabase/supabase-js@2';

export const requireEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

export const createClients = (authHeader?: string | null) => {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const user = createClient(supabaseUrl, anonKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });

  return { admin, user };
};

export const requireUser = async (authHeader?: string | null) => {
  const { admin, user } = createClients(authHeader);
  const { data, error } = await user.auth.getUser();
  if (error || !data.user) {
    throw new Error('Unauthorized');
  }
  return { admin, currentUser: data.user };
};

export const requireAdminUser = async (authHeader?: string | null) => {
  const { admin, currentUser } = await requireUser(authHeader);
  const { data, error } = await admin
    .from('app_users')
    .select('role')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.role !== 'admin') {
    throw new Error('Forbidden');
  }

  return { admin, currentUser };
};
