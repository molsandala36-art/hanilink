import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, isSupabaseFunctionsBaseUrl } from '../lib/backend';
import { AppUser, normalizeSupabaseUser, supabase } from './supabase';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ApiConfig {
  params?: Record<string, any>;
}

interface ApiResponse<T = any> {
  data: T;
}

type JsonRecord = Record<string, any>;

const TABLES = {
  products: 'products',
  suppliers: 'suppliers',
  sales: 'sales',
  expenses: 'expenses',
  purchaseOrders: 'purchase_orders',
  businessDocuments: 'business_documents',
} as const;

const TYPE_PREFIX = {
  quote: 'DEV',
  delivery_note: 'BL',
  invoice: 'FAC',
} as const;

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw createApiError("Supabase n'est pas configure pour cette application.");
  }
  return supabase;
};

const createApiError = (message: string, status = 400) => {
  const error: any = new Error(message);
  error.response = { status, data: { message } };
  return error;
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const parseId = (value: any) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.id || value._id || '';
  return String(value);
};

const pickCreatedAt = (row: JsonRecord) => row.createdAt || row.created_at || new Date().toISOString();

const normalizeRecord = (row: JsonRecord) => ({
  ...row,
  _id: parseId(row.id || row._id),
  createdAt: pickCreatedAt(row),
});

const runQuery = async <T>(query: PromiseLike<{ data: T; error: any }>) => {
  const { data, error } = await query;
  if (error) throw createApiError(error.message || 'Erreur Supabase');
  return data;
};

const getCurrentAuthUser = async (): Promise<User> => {
  const client = ensureSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw createApiError('Session Supabase introuvable. Reconnecte-toi.', 401);
  }
  return data.user;
};

const getCurrentUser = async (): Promise<AppUser> => normalizeSupabaseUser(await getCurrentAuthUser());

const productFromRow = (row: JsonRecord) => {
  const normalized = normalizeRecord(row);
  return {
    _id: normalized._id,
    name: normalized.name || '',
    price: Number(normalized.price || 0),
    purchasePrice: Number(normalized.purchasePrice ?? normalized.purchase_price ?? 0),
    stock: Number(normalized.stock || 0),
    category: normalized.category || 'General',
    tvaRate: Number(normalized.tvaRate ?? normalized.tva_rate ?? 20),
    supplierTva: Number(normalized.supplierTva ?? normalized.supplier_tva ?? 20),
    place: normalized.place || '',
    photoUrl: normalized.photoUrl ?? normalized.photo_url ?? '',
    supplierId: parseId(normalized.supplierId ?? normalized.supplier_id),
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
  };
};

const productToRow = async (payload: JsonRecord) => {
  const user = await getCurrentUser();
  return {
    name: payload.name,
    price: Number(payload.price || 0),
    purchasePrice: Number(payload.purchasePrice ?? 0),
    stock: Number(payload.stock || 0),
    category: payload.category || 'General',
    tvaRate: Number(payload.tvaRate ?? 20),
    supplierTva: Number(payload.supplierTva ?? 20),
    place: payload.place || '',
    photoUrl: payload.photoUrl || '',
    supplierId: payload.supplierId || null,
    userId: user.id,
  };
};

const supplierFromRow = (row: JsonRecord) => {
  const normalized = normalizeRecord(row);
  return {
    _id: normalized._id,
    name: normalized.name || '',
    contact: normalized.contact || '',
    phone: normalized.phone || '',
    address: normalized.address || '',
    email: normalized.email || '',
    ice: normalized.ice || '',
    linkedProducts: asArray<string>(normalized.linkedProducts ?? normalized.linked_products),
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
  };
};

const supplierToRow = async (payload: JsonRecord) => {
  const user = await getCurrentUser();
  return {
    name: payload.name,
    contact: payload.contact || '',
    phone: payload.phone || '',
    address: payload.address || '',
    email: payload.email || '',
    ice: payload.ice || '',
    linkedProducts: asArray<string>(payload.linkedProducts),
    userId: user.id,
  };
};

const saleFromRow = (row: JsonRecord) => {
  const normalized = normalizeRecord(row);
  return {
    _id: normalized._id,
    items: asArray<JsonRecord>(normalized.items).map((item) => ({
      productId: parseId(item.productId ?? item.product_id),
      name: item.name || '',
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      tvaRate: Number(item.tvaRate ?? item.tva_rate ?? 20),
    })),
    totalAmount: Number(normalized.totalAmount ?? normalized.total_amount ?? 0),
    tvaAmount: Number(normalized.tvaAmount ?? normalized.tva_amount ?? 0),
    paymentMethod: normalized.paymentMethod ?? normalized.payment_method ?? 'cash',
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
  };
};

const saleToRow = async (payload: JsonRecord) => {
  const user = await getCurrentUser();
  return {
    items: asArray<JsonRecord>(payload.items).map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      tvaRate: Number(item.tvaRate ?? 20),
    })),
    totalAmount: Number(payload.totalAmount || 0),
    tvaAmount: Number(payload.tvaAmount || 0),
    paymentMethod: payload.paymentMethod || 'cash',
    userId: user.id,
  };
};

const expenseFromRow = (row: JsonRecord) => {
  const normalized = normalizeRecord(row);
  return {
    _id: normalized._id,
    title: normalized.title || '',
    amount: Number(normalized.amount || 0),
    category: normalized.category || 'General',
    expenseDate: normalized.expenseDate ?? normalized.expense_date ?? normalized.createdAt,
    notes: normalized.notes || '',
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
  };
};

const expenseToRow = async (payload: JsonRecord) => {
  const user = await getCurrentUser();
  return {
    title: payload.title,
    amount: Number(payload.amount || 0),
    category: payload.category || 'General',
    expenseDate: payload.expenseDate || new Date().toISOString(),
    notes: payload.notes || '',
    userId: user.id,
  };
};

const purchaseOrderFromRow = (row: JsonRecord) => {
  const normalized = normalizeRecord(row);
  return {
    _id: normalized._id,
    supplierId: parseId(normalized.supplierId ?? normalized.supplier_id),
    items: asArray<JsonRecord>(normalized.items).map((item) => ({
      productId: parseId(item.productId ?? item.product_id),
      name: item.name || '',
      quantity: Number(item.quantity || 0),
      unitCost: Number(item.unitCost ?? item.unit_cost ?? 0),
    })),
    status: normalized.status || 'Pending',
    expectedDeliveryDate: normalized.expectedDeliveryDate ?? normalized.expected_delivery_date,
    totalAmount: Number(normalized.totalAmount ?? normalized.total_amount ?? 0),
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
  };
};

const purchaseOrderToRow = async (payload: JsonRecord) => {
  const user = await getCurrentUser();
  return {
    supplierId: payload.supplierId,
    items: asArray<JsonRecord>(payload.items).map((item) => ({
      productId: item.productId,
      name: item.name || '',
      quantity: Number(item.quantity || 0),
      unitCost: Number(item.unitCost ?? item.purchasePrice ?? 0),
    })),
    status: payload.status || 'Pending',
    expectedDeliveryDate: payload.expectedDeliveryDate || payload.expectedDate || null,
    totalAmount: Number(payload.totalAmount || 0),
    userId: user.id,
  };
};

const documentFromRow = (row: JsonRecord) => {
  const normalized = normalizeRecord(row);
  return {
    _id: normalized._id,
    documentType: normalized.documentType ?? normalized.document_type,
    documentNumber: normalized.documentNumber ?? normalized.document_number ?? '',
    sourceDocumentId: parseId(normalized.sourceDocumentId ?? normalized.source_document_id),
    sourceDocumentType: normalized.sourceDocumentType ?? normalized.source_document_type,
    customerName: normalized.customerName ?? normalized.customer_name ?? '',
    customerPhone: normalized.customerPhone ?? normalized.customer_phone ?? '',
    customerAddress: normalized.customerAddress ?? normalized.customer_address ?? '',
    issueDate: normalized.issueDate ?? normalized.issue_date ?? normalized.createdAt,
    dueDate: normalized.dueDate ?? normalized.due_date,
    status: normalized.status || 'draft',
    items: asArray<JsonRecord>(normalized.items).map((item) => ({
      description: item.description || '',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0),
      lineTotal: Number(item.lineTotal ?? item.line_total ?? 0),
    })),
    subtotal: Number(normalized.subtotal || 0),
    taxAmount: Number(normalized.taxAmount ?? normalized.tax_amount ?? 0),
    totalAmount: Number(normalized.totalAmount ?? normalized.total_amount ?? 0),
    notes: normalized.notes || '',
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
  };
};

const computeDocumentTotals = (items: JsonRecord[], taxRate: any) => {
  const normalizedItems = asArray<JsonRecord>(items)
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      return {
        description: String(item.description || '').trim(),
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
      };
    })
    .filter((item) => item.description && item.quantity > 0);
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = subtotal * (Number(taxRate || 0) / 100);
  return { normalizedItems, subtotal, taxAmount, totalAmount: subtotal + taxAmount };
};

const documentToRow = async (payload: JsonRecord, existing?: JsonRecord) => {
  const user = await getCurrentUser();
  const { normalizedItems, subtotal, taxAmount, totalAmount } = computeDocumentTotals(payload.items, payload.taxRate);
  if (!payload.customerName || normalizedItems.length === 0) {
    throw createApiError('Customer name and at least one item are required');
  }
  return {
    documentType: payload.documentType || existing?.documentType,
    documentNumber:
      existing?.documentNumber ||
      `${TYPE_PREFIX[payload.documentType as keyof typeof TYPE_PREFIX]}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`,
    sourceDocumentId: payload.sourceDocumentId || existing?.sourceDocumentId || null,
    sourceDocumentType: payload.sourceDocumentType || existing?.sourceDocumentType || null,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone || '',
    customerAddress: payload.customerAddress || '',
    issueDate: payload.issueDate || existing?.issueDate || new Date().toISOString(),
    dueDate: payload.dueDate || null,
    status: payload.status || existing?.status || 'draft',
    items: normalizedItems,
    subtotal,
    taxAmount,
    totalAmount,
    notes: payload.notes || '',
    userId: user.id,
  };
};

const listProducts = async (): Promise<ApiResponse<any[]>> => {
  const rows = await runQuery(ensureSupabase().from(TABLES.products).select('*').order('createdAt', { ascending: false }));
  return { data: asArray<JsonRecord>(rows).map(productFromRow) };
};

const createProduct = async (payload: JsonRecord) => {
  const row = await productToRow(payload);
  const data = await runQuery(ensureSupabase().from(TABLES.products).insert(row).select('*').single());
  return { data: productFromRow(data as JsonRecord) };
};

const updateProduct = async (id: string, payload: JsonRecord) => {
  const row = await productToRow(payload);
  const data = await runQuery(ensureSupabase().from(TABLES.products).update(row).eq('id', id).select('*').single());
  return { data: productFromRow(data as JsonRecord) };
};

const deleteProduct = async (id: string) => {
  await runQuery(ensureSupabase().from(TABLES.products).delete().eq('id', id));
  return { data: { message: 'Product deleted' } };
};

const bulkCreateProducts = async (payload: JsonRecord[]) => {
  const rows = await Promise.all(asArray<JsonRecord>(payload).map(productToRow));
  const data = await runQuery(ensureSupabase().from(TABLES.products).insert(rows).select('*'));
  return { data: asArray<JsonRecord>(data).map(productFromRow) };
};

const listSuppliers = async (): Promise<ApiResponse<any[]>> => {
  const rows = await runQuery(ensureSupabase().from(TABLES.suppliers).select('*').order('createdAt', { ascending: false }));
  return { data: asArray<JsonRecord>(rows).map(supplierFromRow) };
};

const createSupplier = async (payload: JsonRecord) => {
  const row = await supplierToRow(payload);
  const data = await runQuery(ensureSupabase().from(TABLES.suppliers).insert(row).select('*').single());
  return { data: supplierFromRow(data as JsonRecord) };
};

const updateSupplier = async (id: string, payload: JsonRecord) => {
  const row = await supplierToRow(payload);
  const data = await runQuery(ensureSupabase().from(TABLES.suppliers).update(row).eq('id', id).select('*').single());
  return { data: supplierFromRow(data as JsonRecord) };
};

const deleteSupplier = async (id: string) => {
  await runQuery(ensureSupabase().from(TABLES.suppliers).delete().eq('id', id));
  return { data: { message: 'Supplier deleted' } };
};

const listSales = async (): Promise<ApiResponse<any[]>> => {
  const rows = await runQuery(ensureSupabase().from(TABLES.sales).select('*').order('createdAt', { ascending: false }));
  return { data: asArray<JsonRecord>(rows).map(saleFromRow) };
};

const createSale = async (payload: JsonRecord) => {
  const row = await saleToRow(payload);
  for (const item of row.items) {
    const productRows = await runQuery(ensureSupabase().from(TABLES.products).select('*').eq('id', item.productId).limit(1));
    const product = asArray<JsonRecord>(productRows)[0];
    if (!product) throw createApiError(`Produit introuvable: ${item.productId}`, 404);
    await runQuery(
      ensureSupabase().from(TABLES.products).update({ stock: Number(product.stock || 0) - Number(item.quantity || 0) }).eq('id', item.productId)
    );
  }
  const data = await runQuery(ensureSupabase().from(TABLES.sales).insert(row).select('*').single());
  return { data: saleFromRow(data as JsonRecord) };
};

const listExpenses = async (): Promise<ApiResponse<any[]>> => {
  const rows = await runQuery(ensureSupabase().from(TABLES.expenses).select('*').order('expenseDate', { ascending: false }));
  return { data: asArray<JsonRecord>(rows).map(expenseFromRow) };
};

const createExpense = async (payload: JsonRecord) => {
  const row = await expenseToRow(payload);
  const data = await runQuery(ensureSupabase().from(TABLES.expenses).insert(row).select('*').single());
  return { data: expenseFromRow(data as JsonRecord) };
};

const updateExpense = async (id: string, payload: JsonRecord) => {
  const row = await expenseToRow(payload);
  const data = await runQuery(ensureSupabase().from(TABLES.expenses).update(row).eq('id', id).select('*').single());
  return { data: expenseFromRow(data as JsonRecord) };
};

const deleteExpense = async (id: string) => {
  await runQuery(ensureSupabase().from(TABLES.expenses).delete().eq('id', id));
  return { data: { message: 'Expense deleted' } };
};

const listPurchaseOrders = async (): Promise<ApiResponse<any[]>> => {
  const rows = await runQuery(ensureSupabase().from(TABLES.purchaseOrders).select('*').order('createdAt', { ascending: false }));
  return { data: asArray<JsonRecord>(rows).map(purchaseOrderFromRow) };
};

const createPurchaseOrder = async (payload: JsonRecord) => {
  const row = await purchaseOrderToRow(payload);
  const data = await runQuery(ensureSupabase().from(TABLES.purchaseOrders).insert(row).select('*').single());
  return { data: purchaseOrderFromRow(data as JsonRecord) };
};

const receivePurchaseOrder = async (id: string) => {
  const poRows = await runQuery(ensureSupabase().from(TABLES.purchaseOrders).select('*').eq('id', id).limit(1));
  const current = asArray<JsonRecord>(poRows)[0];
  if (!current) throw createApiError('Purchase Order not found', 404);
  const order = purchaseOrderFromRow(current);
  if (String(order.status).toLowerCase() === 'received') throw createApiError('Order already received');
  for (const item of order.items) {
    const productRows = await runQuery(ensureSupabase().from(TABLES.products).select('*').eq('id', item.productId).limit(1));
    const product = asArray<JsonRecord>(productRows)[0];
    if (product) {
      await runQuery(
        ensureSupabase().from(TABLES.products).update({ stock: Number(product.stock || 0) + Number(item.quantity || 0) }).eq('id', item.productId)
      );
    }
  }
  const data = await runQuery(ensureSupabase().from(TABLES.purchaseOrders).update({ status: 'Received' }).eq('id', id).select('*').single());
  return { data: purchaseOrderFromRow(data as JsonRecord) };
};

const deletePurchaseOrder = async (id: string) => {
  await runQuery(ensureSupabase().from(TABLES.purchaseOrders).delete().eq('id', id));
  return { data: { message: 'Purchase order deleted' } };
};

const listBusinessDocuments = async (config?: ApiConfig): Promise<ApiResponse<any[]>> => {
  let query = ensureSupabase().from(TABLES.businessDocuments).select('*').order('issueDate', { ascending: false });
  if (config?.params?.type) query = query.eq('documentType', config.params.type);
  const rows = await runQuery(query);
  return { data: asArray<JsonRecord>(rows).map(documentFromRow) };
};

const createBusinessDocument = async (payload: JsonRecord) => {
  const row = await documentToRow(payload);
  const data = await runQuery(ensureSupabase().from(TABLES.businessDocuments).insert(row).select('*').single());
  return { data: documentFromRow(data as JsonRecord) };
};

const updateBusinessDocument = async (id: string, payload: JsonRecord) => {
  const rows = await runQuery(ensureSupabase().from(TABLES.businessDocuments).select('*').eq('id', id).limit(1));
  const current = asArray<JsonRecord>(rows)[0];
  if (!current) throw createApiError('Document not found', 404);
  const row = await documentToRow(payload, current);
  const data = await runQuery(ensureSupabase().from(TABLES.businessDocuments).update(row).eq('id', id).select('*').single());
  return { data: documentFromRow(data as JsonRecord) };
};

const deleteBusinessDocument = async (id: string) => {
  await runQuery(ensureSupabase().from(TABLES.businessDocuments).delete().eq('id', id));
  return { data: { message: 'Document deleted' } };
};

const convertBusinessDocument = async (id: string) => {
  const rows = await runQuery(ensureSupabase().from(TABLES.businessDocuments).select('*').eq('id', id).limit(1));
  const current = asArray<JsonRecord>(rows)[0];
  if (!current) throw createApiError('Document not found', 404);
  const source = documentFromRow(current);
  if (!['quote', 'delivery_note'].includes(source.documentType)) {
    throw createApiError('Only quote and delivery note can be converted to invoice');
  }
  const user = await getCurrentUser();
  const data = await runQuery(
    ensureSupabase()
      .from(TABLES.businessDocuments)
      .insert({
        documentType: 'invoice',
        documentNumber: `${TYPE_PREFIX.invoice}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`,
        sourceDocumentId: source._id,
        sourceDocumentType: source.documentType,
        customerName: source.customerName,
        customerPhone: source.customerPhone || '',
        customerAddress: source.customerAddress || '',
        issueDate: new Date().toISOString(),
        dueDate: source.dueDate || null,
        status: 'draft',
        items: source.items,
        subtotal: source.subtotal,
        taxAmount: source.taxAmount,
        totalAmount: source.totalAmount,
        notes: source.notes || '',
        userId: user.id,
      })
      .select('*')
      .single()
  );
  return { data: documentFromRow(data as JsonRecord) };
};

const getAnalytics = async () => {
  const [salesRes, productsRes, expensesRes] = await Promise.all([listSales(), listProducts(), listExpenses()]);
  const sales = salesRes.data;
  const products = productsRes.data;
  const expenses = expensesRes.data;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSales = sales.filter((sale) => new Date(sale.createdAt || '').getTime() >= thirtyDaysAgo.getTime());
  const recentExpenses = expenses.filter((expense) => new Date(expense.expenseDate || expense.createdAt || '').getTime() >= thirtyDaysAgo.getTime());
  const totalRevenue = recentSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  const totalSales = recentSales.length;
  const averageOrderValue = totalSales ? totalRevenue / totalSales : 0;
  const totalExpenses = recentExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const trendMap = new Map<string, { _id: string; revenue: number; count: number }>();
  recentSales.filter((sale) => new Date(sale.createdAt || '').getTime() >= sevenDaysAgo.getTime()).forEach((sale) => {
    const key = new Date(sale.createdAt || '').toISOString().slice(0, 10);
    const current = trendMap.get(key) || { _id: key, revenue: 0, count: 0 };
    current.revenue += Number(sale.totalAmount || 0);
    current.count += 1;
    trendMap.set(key, current);
  });
  const topProducts = new Map<string, { _id: string; name: string; totalQuantity: number; totalRevenue: number }>();
  sales.forEach((sale) => {
    sale.items.forEach((item: JsonRecord) => {
      const current = topProducts.get(item.productId) || { _id: item.productId, name: item.name, totalQuantity: 0, totalRevenue: 0 };
      current.totalQuantity += Number(item.quantity || 0);
      current.totalRevenue += Number(item.quantity || 0) * Number(item.price || 0);
      topProducts.set(item.productId, current);
    });
  });
  return {
    data: {
      summary: {
        totalRevenue,
        totalSales,
        averageOrderValue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
      },
      dailyTrend: Array.from(trendMap.values()).sort((a, b) => a._id.localeCompare(b._id)),
      topProducts: Array.from(topProducts.values()).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5),
      lowStock: products.filter((product) => Number(product.stock || 0) < 10).slice(0, 5),
    },
  };
};

const listUsers = async () => ({ data: [await getCurrentUser()] });

const updateUser = async (id: string, payload: JsonRecord) => {
  const authUser = await getCurrentAuthUser();
  if (authUser.id !== id) {
    throw createApiError("La gestion d'autres utilisateurs n'est pas encore disponible en mode Supabase direct.", 501);
  }
  const { error } = await ensureSupabase().auth.updateUser({ data: { ...authUser.user_metadata, ...payload } });
  if (error) throw createApiError(error.message);
  return { data: { message: 'User updated' } };
};

const updateUserRole = async (id: string) => {
  const authUser = await getCurrentAuthUser();
  if (authUser.id === id) throw createApiError('You cannot change your own role', 400);
  throw createApiError("Le changement de role d'un autre utilisateur necessite une fonction admin Supabase.", 501);
};

const deleteUser = async (id: string) => {
  const authUser = await getCurrentAuthUser();
  if (authUser.id === id) throw createApiError('You cannot delete your own account', 400);
  throw createApiError("La suppression d'un autre utilisateur necessite une fonction admin Supabase.", 501);
};

const registerAdditionalUser = async () => {
  throw createApiError("La creation d'autres utilisateurs depuis le tableau de bord demande une fonction admin Supabase ou un backend securise.", 501);
};

const getSyncStatus = async () => ({
  data: {
    localDbPath: '',
    mongoConnected: false,
    fileSizeBytes: 0,
    lastPullAt: null,
    lastPushAt: null,
    lastDrivePullAt: null,
    lastDrivePushAt: null,
    collectionCounts: {},
    googleDriveFolderPath: '',
    googleDriveFilePath: '',
    googleDriveFileExists: false,
    googleDriveFileSizeBytes: 0,
  },
});

const unsupportedSyncAction = async () => {
  throw createApiError("La synchronisation locale/Google Drive n'est pas disponible en mode Supabase direct.", 501);
};

const verifyLicense = async () => ({ data: { active: true } });
const activateLicense = async () => ({ data: { success: true } });
const getAdminLicenses = async () => ({ data: [] });
const unsupportedLicensingAction = async () => {
  throw createApiError("La gestion avancee des licences n'est pas encore migree vers Supabase.", 501);
};

const unsupportedRoute = async (path: string) => {
  if (isSupabaseFunctionsBaseUrl) {
    throw createApiError(`La route ${path} n'est pas encore migree vers Supabase direct.`, 501);
  }
  throw createApiError(`Route non prise en charge: ${path}`, 404);
};

export const handleSupabaseApiRequest = async (
  method: HttpMethod,
  path: string,
  payload?: any,
  config?: ApiConfig
): Promise<ApiResponse<any>> => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (method === 'GET' && cleanPath === '/products') return listProducts();
  if (method === 'POST' && cleanPath === '/products') return createProduct(payload);
  if (method === 'POST' && cleanPath === '/products/bulk') return bulkCreateProducts(payload);
  if (method === 'PUT' && cleanPath.startsWith('/products/')) return updateProduct(cleanPath.split('/')[2], payload);
  if (method === 'DELETE' && cleanPath.startsWith('/products/')) return deleteProduct(cleanPath.split('/')[2]);

  if (method === 'GET' && cleanPath === '/suppliers') return listSuppliers();
  if (method === 'POST' && cleanPath === '/suppliers') return createSupplier(payload);
  if (method === 'PUT' && cleanPath.startsWith('/suppliers/')) return updateSupplier(cleanPath.split('/')[2], payload);
  if (method === 'DELETE' && cleanPath.startsWith('/suppliers/')) return deleteSupplier(cleanPath.split('/')[2]);

  if (method === 'GET' && cleanPath === '/sales') return listSales();
  if (method === 'POST' && cleanPath === '/sales') return createSale(payload);

  if (method === 'GET' && cleanPath === '/expenses') return listExpenses();
  if (method === 'POST' && cleanPath === '/expenses') return createExpense(payload);
  if (method === 'PUT' && cleanPath.startsWith('/expenses/')) return updateExpense(cleanPath.split('/')[2], payload);
  if (method === 'DELETE' && cleanPath.startsWith('/expenses/')) return deleteExpense(cleanPath.split('/')[2]);

  if (method === 'GET' && cleanPath === '/purchase-orders') return listPurchaseOrders();
  if (method === 'POST' && cleanPath === '/purchase-orders') return createPurchaseOrder(payload);
  if (method === 'PUT' && /\/purchase-orders\/[^/]+\/receive$/.test(cleanPath)) return receivePurchaseOrder(cleanPath.split('/')[2]);
  if (method === 'DELETE' && cleanPath.startsWith('/purchase-orders/')) return deletePurchaseOrder(cleanPath.split('/')[2]);

  if (method === 'GET' && cleanPath === '/documents') return listBusinessDocuments(config);
  if (method === 'POST' && cleanPath === '/documents') return createBusinessDocument(payload);
  if (method === 'PUT' && cleanPath.startsWith('/documents/')) return updateBusinessDocument(cleanPath.split('/')[2], payload);
  if (method === 'DELETE' && cleanPath.startsWith('/documents/')) return deleteBusinessDocument(cleanPath.split('/')[2]);
  if (method === 'POST' && /\/documents\/[^/]+\/convert-to-invoice$/.test(cleanPath)) return convertBusinessDocument(cleanPath.split('/')[2]);

  if (method === 'GET' && cleanPath === '/analytics') return getAnalytics();

  if (method === 'GET' && cleanPath === '/users') return listUsers();
  if (method === 'PUT' && /\/users\/[^/]+\/role$/.test(cleanPath)) return updateUserRole(cleanPath.split('/')[2]);
  if (method === 'PUT' && cleanPath.startsWith('/users/')) return updateUser(cleanPath.split('/')[2], payload);
  if (method === 'DELETE' && cleanPath.startsWith('/users/')) return deleteUser(cleanPath.split('/')[2]);

  if (method === 'POST' && cleanPath === '/auth/register') return registerAdditionalUser();

  if (method === 'GET' && cleanPath === '/sync/status') return getSyncStatus();
  if (cleanPath.startsWith('/sync/')) return unsupportedSyncAction();

  if (method === 'POST' && cleanPath === '/license/verify') return verifyLicense();
  if (method === 'POST' && cleanPath === '/license/activate') return activateLicense();
  if (method === 'GET' && cleanPath === '/admin/licenses') return getAdminLicenses();
  if (cleanPath.startsWith('/admin/licenses')) return unsupportedLicensingAction();

  return unsupportedRoute(cleanPath);
};
