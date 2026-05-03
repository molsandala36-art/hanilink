export type AppUserRole = 'admin' | 'employee';

export interface CurrentAppUser {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  shopName?: string;
  companyOwnerId?: string;
  role: AppUserRole;
}

const normalizeRole = (value: unknown): AppUserRole =>
  typeof value === 'string' && value.toLowerCase() === 'admin' ? 'admin' : 'employee';

export const normalizeCurrentUser = (value: unknown): CurrentAppUser | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawUser = value as Record<string, unknown>;
  const id = typeof rawUser.id === 'string' ? rawUser.id : typeof rawUser._id === 'string' ? rawUser._id : undefined;
  const companyOwnerId =
    typeof rawUser.companyOwnerId === 'string'
      ? rawUser.companyOwnerId
      : typeof rawUser.company_owner_id === 'string'
        ? rawUser.company_owner_id
        : undefined;

  const inferredRole = normalizeRole(rawUser.role);
  const role: AppUserRole = inferredRole === 'admin' || (id && companyOwnerId && id === companyOwnerId) ? 'admin' : 'employee';

  return {
    _id: typeof rawUser._id === 'string' ? rawUser._id : id,
    id,
    name: typeof rawUser.name === 'string' ? rawUser.name : '',
    email: typeof rawUser.email === 'string' ? rawUser.email : '',
    shopName:
      typeof rawUser.shopName === 'string'
        ? rawUser.shopName
        : typeof rawUser.shop_name === 'string'
          ? rawUser.shop_name
          : '',
    companyOwnerId,
    role,
  };
};

export const getStoredCurrentUser = (): CurrentAppUser | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return normalizeCurrentUser(JSON.parse(localStorage.getItem('user') || 'null'));
  } catch {
    return null;
  }
};
