import { getActiveTenantConfig } from '../lib/backend';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ApiConfig {
  params?: Record<string, any>;
}

interface ApiResponse<T = any> {
  data: T;
}

interface PendingOperation {
  id: string;
  method: Exclude<HttpMethod, 'GET'>;
  path: string;
  payload?: any;
  config?: ApiConfig;
  optimisticId?: string;
  createdAt: string;
}

interface OfflineState {
  collections: Record<string, any[]>;
  queue: PendingOperation[];
  lastSyncAt: string | null;
  lastError: string | null;
}

const COLLECTIONS = {
  products: '/products',
  suppliers: '/suppliers',
  sales: '/sales',
  returns: '/returns',
  expenses: '/expenses',
  purchaseOrders: '/purchase-orders',
  documents: '/documents',
  customers: '/customers',
  credits: '/credits',
  users: '/users',
} as const;

const COLLECTION_BY_PATH = Object.fromEntries(
  Object.entries(COLLECTIONS).map(([key, value]) => [value, key])
) as Record<string, keyof typeof COLLECTIONS>;

const DEFAULT_STATE: OfflineState = {
  collections: {
    products: [],
    suppliers: [],
    sales: [],
    returns: [],
    expenses: [],
    purchaseOrders: [],
    documents: [],
    customers: [],
    credits: [],
    users: [],
  },
  queue: [],
  lastSyncAt: null,
  lastError: null,
};

const tempIdPrefix = 'offline-';
const idRemap = new Map<string, string>();
let flushPromise: Promise<void> | null = null;
let executorRef: ((method: HttpMethod, path: string, payload?: any, config?: ApiConfig) => Promise<ApiResponse<any>>) | null = null;
let initialized = false;

const getTenantKey = () => getActiveTenantConfig()?.slug || 'default';
const getStorageKey = () => `hani-offline-sync-${getTenantKey()}`;

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;
const isOfflineNetworkError = (error: any) =>
  !navigator.onLine ||
  !error?.response ||
  String(error?.message || '').toLowerCase().includes('network') ||
  String(error?.message || '').toLowerCase().includes('fetch');

const safeNow = () => new Date().toISOString();

const readState = (): OfflineState => {
  if (!canUseStorage()) return { ...DEFAULT_STATE };

  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return {
      collections: { ...DEFAULT_STATE.collections, ...(parsed.collections || {}) },
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      lastSyncAt: parsed.lastSyncAt || null,
      lastError: parsed.lastError || null,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
};

const writeState = (nextState: OfflineState) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(getStorageKey(), JSON.stringify(nextState));
};

const updateState = (updater: (state: OfflineState) => OfflineState) => {
  const next = updater(readState());
  writeState(next);
  return next;
};

const getPathBase = (path: string) => {
  const withoutQuery = path.split('?')[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  return `/${segments[0]}`;
};

const getPathId = (path: string) => {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  return segments[1] || '';
};

const getCollectionKey = (path: string) => COLLECTION_BY_PATH[getPathBase(path)];

const withId = (entity: any) => entity?._id || entity?.id || '';

const normalizeEntity = (collectionKey: keyof typeof COLLECTIONS, entity: any, fallbackId?: string) => {
  const id = withId(entity) || fallbackId || `${tempIdPrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const base = {
    ...entity,
    _id: id,
    id,
  };

  if (collectionKey === 'sales') {
    const items = Array.isArray(base.items) ? base.items : [];
    const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.lineTotal ?? Number(item.quantity || 0) * Number(item.price || 0)), 0);
    return {
      paymentMethod: 'cash',
      totalAmount: subtotal,
      tvaAmount: 0,
      createdAt: safeNow(),
      ...base,
    };
  }

  if (collectionKey === 'documents') {
    const items = Array.isArray(base.items) ? base.items : [];
    const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.lineTotal ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
    const taxRate = Number(base.taxRate || 0);
    const taxAmount = Number(base.taxAmount ?? subtotal * (taxRate / 100));
    return {
      status: 'draft',
      subtotal,
      taxAmount,
      totalAmount: Number(base.totalAmount ?? subtotal + taxAmount),
      createdAt: safeNow(),
      ...base,
    };
  }

  if (collectionKey === 'returns') {
    const items = Array.isArray(base.items) ? base.items : [];
    const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.lineTotal ?? Number(item.quantity || 0) * Number(item.price || 0)), 0);
    return {
      subtotalAmount: subtotal,
      tvaAmount: Number(base.tvaAmount ?? 0),
      totalAmount: Number(base.totalAmount ?? subtotal + Number(base.tvaAmount ?? 0)),
      createdAt: safeNow(),
      ...base,
    };
  }

  return {
    createdAt: safeNow(),
    ...base,
  };
};

const replaceReferencedIds = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(replaceReferencedIds);
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && idRemap.has(value)) {
      return idRemap.get(value);
    }
    return value;
  }

  const next: Record<string, any> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (typeof nestedValue === 'string' && idRemap.has(nestedValue)) {
      next[key] = idRemap.get(nestedValue);
    } else {
      next[key] = replaceReferencedIds(nestedValue);
    }
  }
  return next;
};

const replacePathIds = (path: string) => {
  let nextPath = path;
  for (const [tempId, realId] of idRemap.entries()) {
    nextPath = nextPath.replace(tempId, realId);
  }
  return nextPath;
};

const upsertEntityInCollection = (collection: any[], entity: any) => {
  const entityId = withId(entity);
  if (!entityId) return collection;
  const index = collection.findIndex((item) => withId(item) === entityId);
  if (index === -1) {
    return [entity, ...collection];
  }
  const next = [...collection];
  next[index] = { ...next[index], ...entity, _id: entityId, id: entityId };
  return next;
};

const removeEntityFromCollection = (collection: any[], id: string) =>
  collection.filter((item) => withId(item) !== id);

const applyOptimisticMutation = (method: Exclude<HttpMethod, 'GET'>, path: string, payload?: any) => {
  const collectionKey = getCollectionKey(path);
  if (!collectionKey) {
    throw new Error(`Offline mutation unsupported for ${path}`);
  }

  let optimisticId = '';
  let data: any = null;

  updateState((state) => {
    const collection = [...(state.collections[collectionKey] || [])];

    if (method === 'POST' && path === '/products/bulk' && Array.isArray(payload)) {
      const createdRows = payload.map((entry) =>
        normalizeEntity(collectionKey, entry, `${tempIdPrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      );
      data = createdRows;
      return {
        ...state,
        collections: {
          ...state.collections,
          [collectionKey]: createdRows.reduce((acc, row) => upsertEntityInCollection(acc, row), collection),
        },
      };
    }

    if (method === 'POST') {
      optimisticId = withId(payload) || `${tempIdPrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      data = normalizeEntity(collectionKey, payload, optimisticId);
      return {
        ...state,
        collections: {
          ...state.collections,
          [collectionKey]: upsertEntityInCollection(collection, data),
        },
      };
    }

    const targetId = getPathId(path);
    if (method === 'PUT') {
      data = normalizeEntity(collectionKey, payload, targetId);
      return {
        ...state,
        collections: {
          ...state.collections,
          [collectionKey]: upsertEntityInCollection(collection, data),
        },
      };
    }

    data = { message: 'Deleted', id: targetId };
    return {
      ...state,
      collections: {
        ...state.collections,
        [collectionKey]: removeEntityFromCollection(collection, targetId),
      },
    };
  });

  return { data, optimisticId };
};

const cacheCollectionResult = (path: string, data: any, config?: ApiConfig) => {
  const collectionKey = getCollectionKey(path);
  if (!collectionKey) return;

  if (collectionKey === 'documents' && config?.params?.type) {
    const currentState = readState();
    const otherDocs = (currentState.collections.documents || []).filter(
      (doc) => doc.documentType !== config.params?.type
    );
    const typedDocs = Array.isArray(data) ? data : [];
    writeState({
      ...currentState,
      collections: {
        ...currentState.collections,
        documents: [...typedDocs, ...otherDocs],
      },
    });
    return;
  }

  updateState((state) => ({
    ...state,
    collections: {
      ...state.collections,
      [collectionKey]: Array.isArray(data) ? data : state.collections[collectionKey],
    },
  }));
};

const readCollection = (collectionKey: keyof typeof COLLECTIONS) => readState().collections[collectionKey] || [];

const buildOfflineAnalytics = () => {
  const sales = readCollection('sales');
  const products = readCollection('products');
  const expenses = readCollection('expenses');
  const returns = readCollection('returns');

  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalReturns = returns.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const totalCostOfGoods = sales.reduce((sum, sale) => {
    const items = Array.isArray(sale.items) ? sale.items : [];
    return sum + items.reduce((lineSum: number, item: any) => lineSum + Number(item.purchasePrice || 0) * Number(item.quantity || 0), 0);
  }, 0);

  return {
    totalRevenue,
    totalExpenses,
    totalReturns,
    totalCostOfGoods,
    netProfit: totalRevenue - totalExpenses - totalCostOfGoods - totalReturns,
    totalSales: sales.length,
    activeProducts: products.length,
    lowStockProducts: products.filter((product) => Number(product.stock || 0) <= 5).length,
  };
};

export const getOfflineSyncStatus = () => {
  const state = readState();
  return {
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    pendingOperations: state.queue.length,
    lastSyncAt: state.lastSyncAt,
    lastError: state.lastError,
    collectionCounts: Object.fromEntries(
      Object.entries(state.collections).map(([key, items]) => [key, Array.isArray(items) ? items.length : 0])
    ),
    localDbPath: 'browser-local-store',
    fileSizeBytes: new Blob([JSON.stringify(state)]).size,
  };
};

export const getOfflineCapableResponse = (path: string, config?: ApiConfig): ApiResponse<any> => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (cleanPath === '/analytics') {
    return { data: buildOfflineAnalytics() };
  }

  if (cleanPath === '/sync/status') {
    return { data: getOfflineSyncStatus() };
  }

  const collectionKey = getCollectionKey(cleanPath);
  if (!collectionKey) {
    throw new Error(`Offline read unsupported for ${cleanPath}`);
  }

  let data = readCollection(collectionKey);
  if (collectionKey === 'documents' && config?.params?.type) {
    data = data.filter((doc) => doc.documentType === config.params?.type);
  }

  return { data };
};

export const queueOfflineMutation = (
  method: Exclude<HttpMethod, 'GET'>,
  path: string,
  payload?: any,
  config?: ApiConfig
): ApiResponse<any> => {
  const { data, optimisticId } = applyOptimisticMutation(method, path, payload);
  updateState((state) => ({
    ...state,
    lastError: null,
    queue: [
      ...state.queue,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        method,
        path,
        payload,
        config,
        optimisticId: optimisticId || undefined,
        createdAt: safeNow(),
      },
    ],
  }));
  return { data };
};

const applyRemoteMutationResult = (method: Exclude<HttpMethod, 'GET'>, path: string, responseData: any, fallbackPayload?: any) => {
  const collectionKey = getCollectionKey(path);
  if (!collectionKey) return;

  updateState((state) => {
    const collection = [...(state.collections[collectionKey] || [])];
    if (method === 'DELETE') {
      return {
        ...state,
        collections: {
          ...state.collections,
          [collectionKey]: removeEntityFromCollection(collection, getPathId(path)),
        },
      };
    }

    if (Array.isArray(responseData)) {
      return {
        ...state,
        collections: {
          ...state.collections,
          [collectionKey]: responseData.reduce((acc, row) => upsertEntityInCollection(acc, row), collection),
        },
      };
    }

    const entity = responseData || normalizeEntity(collectionKey, fallbackPayload, getPathId(path));
    return {
      ...state,
      collections: {
        ...state.collections,
        [collectionKey]: upsertEntityInCollection(collection, entity),
      },
    };
  });
};

const replaceOptimisticIdsInCaches = (tempId: string, realId: string) => {
  updateState((state) => {
    const nextCollections: Record<string, any[]> = {};
    for (const [collectionKey, items] of Object.entries(state.collections)) {
      nextCollections[collectionKey] = (items || []).map((item) => replaceReferencedIds({
        ...item,
        _id: withId(item) === tempId ? realId : item._id,
        id: withId(item) === tempId ? realId : item.id,
      }));
    }
    return { ...state, collections: nextCollections };
  });
};

export const cacheOnlineResponse = (path: string, data: any, config?: ApiConfig) => {
  cacheCollectionResult(path, data, config);
};

export const cacheOnlineMutation = (method: Exclude<HttpMethod, 'GET'>, path: string, responseData: any, payload?: any) => {
  applyRemoteMutationResult(method, path, responseData, payload);
};

export const flushPendingOperations = async () => {
  if (!executorRef || flushPromise || !canUseStorage() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return flushPromise || Promise.resolve();
  }

  flushPromise = (async () => {
    let state = readState();
    const nextQueue: PendingOperation[] = [];

    for (const operation of state.queue) {
      const resolvedPath = replacePathIds(operation.path);
      const resolvedPayload = replaceReferencedIds(operation.payload);

      try {
        const response = await executorRef!(operation.method, resolvedPath, resolvedPayload, operation.config);
        const responseId = withId(response?.data);

        if (operation.optimisticId && responseId && operation.optimisticId !== responseId) {
          idRemap.set(operation.optimisticId, responseId);
          replaceOptimisticIdsInCaches(operation.optimisticId, responseId);
        }

        applyRemoteMutationResult(operation.method, resolvedPath, response?.data, resolvedPayload);
        state = updateState((current) => ({
          ...current,
          lastError: null,
          lastSyncAt: safeNow(),
        }));
      } catch (error: any) {
        if (isOfflineNetworkError(error)) {
          nextQueue.push(operation, ...state.queue.slice(state.queue.indexOf(operation) + 1));
          break;
        }

        nextQueue.push(operation);
        state = updateState((current) => ({
          ...current,
          lastError: String(error?.message || 'Erreur de synchronisation'),
        }));
        break;
      }
    }

    updateState((current) => ({
      ...current,
      queue: nextQueue,
    }));
  })();

  try {
    await flushPromise;
  } finally {
    flushPromise = null;
  }
};

export const initializeOfflineSync = (
  executor: (method: HttpMethod, path: string, payload?: any, config?: ApiConfig) => Promise<ApiResponse<any>>
) => {
  executorRef = executor;

  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  const onlineHandler = () => {
    void flushPendingOperations();
  };

  window.addEventListener('online', onlineHandler);

  if (navigator.onLine) {
    void flushPendingOperations();
  }
};
