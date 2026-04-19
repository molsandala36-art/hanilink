import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, isSupabaseFunctionsBaseUrl, supabasePublishableKey } from '../lib/backend';
import { AppUser, getCurrentSupabaseUserProfile, getStoredSupabaseSession, supabase } from './supabase';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ApiConfig {
  params?: Record<string, any>;
}

interface ApiResponse<T = any> {
  data: T;
}

type JsonRecord = Record<string, any>;

const TABLES = {
  appUsers: 'app_users',
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

const TABLE_ALIASES = {
  appUsers: ['app_users', 'users'],
  products: ['products', 'product'],
  suppliers: ['suppliers', 'supplier'],
  sales: ['sales', 'sale'],
  expenses: ['expenses', 'expense'],
  purchaseOrders: ['purchase_orders', 'purchaseorders', 'purchase_orders'],
  businessDocuments: ['business_documents', 'businessdocuments', 'documents', 'business_document'],
} as const;

const resolvedTableNames = new Map<keyof typeof TABLES, string>();

let cachedAuthUser: User | null = null;
let authUserPromise: Promise<User> | null = null;

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw createApiError("Supabase n'est pas configure pour cette application.");
  }
  return supabase;
};

const invokeSupabaseFunction = async <T>(name: string, body: JsonRecord = {}) => {
  const client = ensureSupabase();
  const accessToken = (await getStoredSupabaseSession())?.access_token;
  if (!accessToken) {
    throw createApiError('Session Supabase introuvable. Reconnecte-toi.', 401);
  }

  const { data, error } = await client.functions.invoke(name, {
    body,
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (error) {
    const message = error.message || 'Erreur Supabase Function';
    const missingFunction =
      String(message).toLowerCase().includes('not found') ||
      String((error as any)?.context?.status || '').includes('404');
    if (missingFunction) {
      throw createApiError(
        `La fonction Supabase "${name}" n'est pas encore deployee. Deploie les Edge Functions de licensing pour activer cette fonctionnalite.`,
        501
      );
    }
    throw createApiError(message, Number((error as any)?.context?.status || 400));
  }
  return data as T;
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

const normalizeRecord = (row: JsonRecord): JsonRecord => ({
  ...row,
  _id: parseId(row.id || row._id),
  createdAt: pickCreatedAt(row),
});

const isMissingSupabaseResourceError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  const status = Number(error?.status || error?.response?.status || 0);

  return (
    status === 404 ||
    code === 'PGRST205' ||
    message.includes('could not find the table') ||
    message.includes('relation') && message.includes('does not exist') ||
    message.includes('schema cache')
  );
};

const isMissingSupabaseColumnError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
};

const buildMissingTableMessage = (resourceLabel: string, attemptedTableNames: string[]) =>
  `Supabase ne trouve pas encore la ressource "${resourceLabel}". Tables essayees: ${attemptedTableNames.join(', ')}. Cree la table correspondante dans Supabase ou adapte le mapping frontend.`;

const runQuery = async <T>(query: PromiseLike<{ data: T; error: any }>, fallbackMessage?: string) => {
  const { data, error } = await query;
  if (error) {
    if (fallbackMessage && (isMissingSupabaseResourceError(error) || isMissingSupabaseColumnError(error))) {
      throw createApiError(fallbackMessage, 404);
    }
    throw createApiError(error.message || 'Erreur Supabase');
  }
  return data;
};

const getTableCandidates = (tableKey: keyof typeof TABLES) => {
  const resolved = resolvedTableNames.get(tableKey);
  if (resolved) return [resolved];

  const primary = TABLES[tableKey];
  const aliases = TABLE_ALIASES[tableKey] || [];
  return Array.from(new Set([primary, ...aliases]));
};

const withTable = async <T>(
  tableKey: keyof typeof TABLES,
  resourceLabel: string,
  executor: (tableName: string) => PromiseLike<{ data: T; error: any }>
) => {
  const candidates = getTableCandidates(tableKey);
  let lastError: any = null;

  for (const tableName of candidates) {
    const { data, error } = await executor(tableName);
    if (!error) {
      resolvedTableNames.set(tableKey, tableName);
      return data;
    }

    lastError = error;
    if (!isMissingSupabaseResourceError(error) && !isMissingSupabaseColumnError(error)) {
      throw createApiError(error.message || 'Erreur Supabase');
    }
  }

  throw createApiError(buildMissingTableMessage(resourceLabel, candidates), 404);
};

const sortByDateDesc = <T extends JsonRecord>(rows: T[], keys: string[]) =>
  [...rows].sort((left, right) => {
    const leftValue = keys.map((key) => left[key]).find(Boolean);
    const rightValue = keys.map((key) => right[key]).find(Boolean);
    return new Date(String(rightValue || 0)).getTime() - new Date(String(leftValue || 0)).getTime();
  });

const getCurrentAuthUser = async (): Promise<User> => {
  if (cachedAuthUser) {
    return cachedAuthUser;
  }

  if (authUserPromise) {
    return authUserPromise;
  }

  authUserPromise = (async () => {
    const client = ensureSupabase();
    const sessionUser = (await getStoredSupabaseSession())?.user;
    if (sessionUser) {
      cachedAuthUser = sessionUser;
      return sessionUser;
    }

    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      throw createApiError('Session Supabase introuvable. Reconnecte-toi.', 401);
    }

    cachedAuthUser = data.user;
    return data.user;
  })();

  try {
    return await authUserPromise;
  } finally {
    authUserPromise = null;
  }
};

const getCurrentUser = async (): Promise<AppUser> => getCurrentSupabaseUserProfile(await getCurrentAuthUser());

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
    purchase_price: Number(payload.purchasePrice ?? 0),
    stock: Number(payload.stock || 0),
    category: payload.category || 'General',
    tva_rate: Number(payload.tvaRate ?? 20),
    supplier_tva: Number(payload.supplierTva ?? 20),
    place: payload.place || '',
    photo_url: payload.photoUrl || '',
    supplier_id: payload.supplierId || null,
    user_id: user.id,
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
    linked_products: asArray<string>(payload.linkedProducts),
    user_id: user.id,
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
      purchasePrice: Number(item.purchasePrice ?? item.purchase_price ?? 0),
      supplierTva: Number(item.supplierTva ?? item.supplier_tva ?? 0),
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
      product_id: item.productId,
      name: item.name,
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      purchase_price: Number(item.purchasePrice ?? 0),
      supplier_tva: Number(item.supplierTva ?? 0),
      tva_rate: Number(item.tvaRate ?? 20),
    })),
    total_amount: Number(payload.totalAmount || 0),
    tva_amount: Number(payload.tvaAmount || 0),
    payment_method: payload.paymentMethod || 'cash',
    user_id: user.id,
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
    expense_date: payload.expenseDate || new Date().toISOString(),
    notes: payload.notes || '',
    user_id: user.id,
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
    supplier_id: payload.supplierId,
    items: asArray<JsonRecord>(payload.items).map((item) => ({
      product_id: item.productId,
      name: item.name || '',
      quantity: Number(item.quantity || 0),
      unit_cost: Number(item.unitCost ?? item.purchasePrice ?? 0),
    })),
    status: payload.status || 'Pending',
    expected_delivery_date: payload.expectedDeliveryDate || payload.expectedDate || null,
    total_amount: Number(payload.totalAmount || 0),
    user_id: user.id,
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
    document_type: payload.documentType || existing?.documentType || existing?.document_type,
    document_number:
      existing?.documentNumber ||
      existing?.document_number ||
      `${TYPE_PREFIX[payload.documentType as keyof typeof TYPE_PREFIX]}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`,
    source_document_id: payload.sourceDocumentId || existing?.sourceDocumentId || existing?.source_document_id || null,
    source_document_type: payload.sourceDocumentType || existing?.sourceDocumentType || existing?.source_document_type || null,
    customer_name: payload.customerName,
    customer_phone: payload.customerPhone || '',
    customer_address: payload.customerAddress || '',
    issue_date: payload.issueDate || existing?.issueDate || existing?.issue_date || new Date().toISOString(),
    due_date: payload.dueDate || null,
    status: payload.status || existing?.status || 'draft',
    items: normalizedItems,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    notes: payload.notes || '',
    user_id: user.id,
  };
};

const listProducts = async (): Promise<ApiResponse<any[]>> => {
  const rows = await withTable('products', 'products', (tableName) => ensureSupabase().from(tableName).select('*'));
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(productFromRow), ['createdAt']) };
};

const createProduct = async (payload: JsonRecord) => {
  const row = await productToRow(payload);
  const data = await withTable('products', 'products', (tableName) => ensureSupabase().from(tableName).insert(row).select('*').single());
  return { data: productFromRow(data as JsonRecord) };
};

const updateProduct = async (id: string, payload: JsonRecord) => {
  const row = await productToRow(payload);
  const data = await withTable('products', 'products', (tableName) =>
    ensureSupabase().from(tableName).update(row).eq('id', id).select('*').single()
  );
  return { data: productFromRow(data as JsonRecord) };
};

const deleteProduct = async (id: string) => {
  await withTable('products', 'products', (tableName) => ensureSupabase().from(tableName).delete().eq('id', id));
  return { data: { message: 'Product deleted' } };
};

const bulkCreateProducts = async (payload: JsonRecord[]) => {
  const rows = await Promise.all(asArray<JsonRecord>(payload).map(productToRow));
  const data = await withTable('products', 'products', (tableName) => ensureSupabase().from(tableName).insert(rows).select('*'));
  return { data: asArray<JsonRecord>(data).map(productFromRow) };
};

const listSuppliers = async (): Promise<ApiResponse<any[]>> => {
  const rows = await withTable('suppliers', 'suppliers', (tableName) => ensureSupabase().from(tableName).select('*'));
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(supplierFromRow), ['createdAt']) };
};

const createSupplier = async (payload: JsonRecord) => {
  const row = await supplierToRow(payload);
  const data = await withTable('suppliers', 'suppliers', (tableName) => ensureSupabase().from(tableName).insert(row).select('*').single());
  return { data: supplierFromRow(data as JsonRecord) };
};

const updateSupplier = async (id: string, payload: JsonRecord) => {
  const row = await supplierToRow(payload);
  const data = await withTable('suppliers', 'suppliers', (tableName) =>
    ensureSupabase().from(tableName).update(row).eq('id', id).select('*').single()
  );
  return { data: supplierFromRow(data as JsonRecord) };
};

const deleteSupplier = async (id: string) => {
  await withTable('suppliers', 'suppliers', (tableName) => ensureSupabase().from(tableName).delete().eq('id', id));
  return { data: { message: 'Supplier deleted' } };
};

const listSales = async (): Promise<ApiResponse<any[]>> => {
  const rows = await withTable('sales', 'sales', (tableName) => ensureSupabase().from(tableName).select('*'));
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(saleFromRow), ['createdAt']) };
};

const createSale = async (payload: JsonRecord) => {
  const row = await saleToRow(payload);
  for (const item of row.items) {
    const productId = parseId(item.product_id);
    const productRows = await withTable('products', 'products', (tableName) =>
      ensureSupabase().from(tableName).select('*').eq('id', productId).limit(1)
    );
    const product = asArray<JsonRecord>(productRows)[0];
    if (!product) throw createApiError(`Produit introuvable: ${productId}`, 404);
    await withTable('products', 'products', (tableName) =>
      ensureSupabase().from(tableName).update({ stock: Number(product.stock || 0) - Number(item.quantity || 0) }).eq('id', productId)
    );
  }
  const data = await withTable('sales', 'sales', (tableName) => ensureSupabase().from(tableName).insert(row).select('*').single());
  return { data: saleFromRow(data as JsonRecord) };
};

const listExpenses = async (): Promise<ApiResponse<any[]>> => {
  const rows = await withTable('expenses', 'expenses', (tableName) => ensureSupabase().from(tableName).select('*'));
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(expenseFromRow), ['expenseDate', 'createdAt']) };
};

const createExpense = async (payload: JsonRecord) => {
  const row = await expenseToRow(payload);
  const data = await withTable('expenses', 'expenses', (tableName) => ensureSupabase().from(tableName).insert(row).select('*').single());
  return { data: expenseFromRow(data as JsonRecord) };
};

const updateExpense = async (id: string, payload: JsonRecord) => {
  const row = await expenseToRow(payload);
  const data = await withTable('expenses', 'expenses', (tableName) =>
    ensureSupabase().from(tableName).update(row).eq('id', id).select('*').single()
  );
  return { data: expenseFromRow(data as JsonRecord) };
};

const deleteExpense = async (id: string) => {
  await withTable('expenses', 'expenses', (tableName) => ensureSupabase().from(tableName).delete().eq('id', id));
  return { data: { message: 'Expense deleted' } };
};

const listPurchaseOrders = async (): Promise<ApiResponse<any[]>> => {
  const rows = await withTable('purchaseOrders', 'purchase-orders', (tableName) => ensureSupabase().from(tableName).select('*'));
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(purchaseOrderFromRow), ['createdAt']) };
};

const createPurchaseOrder = async (payload: JsonRecord) => {
  const row = await purchaseOrderToRow(payload);
  const data = await withTable('purchaseOrders', 'purchase-orders', (tableName) =>
    ensureSupabase().from(tableName).insert(row).select('*').single()
  );
  return { data: purchaseOrderFromRow(data as JsonRecord) };
};

const receivePurchaseOrder = async (id: string) => {
  const poRows = await withTable('purchaseOrders', 'purchase-orders', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('id', id).limit(1)
  );
  const current = asArray<JsonRecord>(poRows)[0];
  if (!current) throw createApiError('Purchase Order not found', 404);
  const order = purchaseOrderFromRow(current);
  if (String(order.status).toLowerCase() === 'received') throw createApiError('Order already received');
  for (const item of order.items) {
    const productRows = await withTable('products', 'products', (tableName) =>
      ensureSupabase().from(tableName).select('*').eq('id', item.productId).limit(1)
    );
    const product = asArray<JsonRecord>(productRows)[0];
    if (product) {
      await withTable('products', 'products', (tableName) =>
        ensureSupabase().from(tableName).update({ stock: Number(product.stock || 0) + Number(item.quantity || 0) }).eq('id', item.productId)
      );
    }
  }
  const data = await withTable('purchaseOrders', 'purchase-orders', (tableName) =>
    ensureSupabase().from(tableName).update({ status: 'Received' }).eq('id', id).select('*').single()
  );
  return { data: purchaseOrderFromRow(data as JsonRecord) };
};

const deletePurchaseOrder = async (id: string) => {
  await withTable('purchaseOrders', 'purchase-orders', (tableName) => ensureSupabase().from(tableName).delete().eq('id', id));
  return { data: { message: 'Purchase order deleted' } };
};

const listBusinessDocuments = async (config?: ApiConfig): Promise<ApiResponse<any[]>> => {
  let queryTableName = resolvedTableNames.get('businessDocuments');
  if (!queryTableName) {
    const rows = await withTable('businessDocuments', 'documents', (tableName) => ensureSupabase().from(tableName).select('*'));
    return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(documentFromRow), ['issueDate', 'createdAt']) };
  }
  let query = ensureSupabase().from(queryTableName).select('*');
  if (config?.params?.type) query = query.eq('document_type', config.params.type);
  const rows = await runQuery(query);
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(documentFromRow), ['issueDate', 'createdAt']) };
};

const createBusinessDocument = async (payload: JsonRecord) => {
  const row = await documentToRow(payload);
  const data = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase().from(tableName).insert(row).select('*').single()
  );
  return { data: documentFromRow(data as JsonRecord) };
};

const updateBusinessDocument = async (id: string, payload: JsonRecord) => {
  const rows = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('id', id).limit(1)
  );
  const current = asArray<JsonRecord>(rows)[0];
  if (!current) throw createApiError('Document not found', 404);
  const row = await documentToRow(payload, current);
  const data = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase().from(tableName).update(row).eq('id', id).select('*').single()
  );
  return { data: documentFromRow(data as JsonRecord) };
};

const deleteBusinessDocument = async (id: string) => {
  await withTable('businessDocuments', 'documents', (tableName) => ensureSupabase().from(tableName).delete().eq('id', id));
  return { data: { message: 'Document deleted' } };
};

const convertBusinessDocument = async (id: string) => {
  const rows = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('id', id).limit(1)
  );
  const current = asArray<JsonRecord>(rows)[0];
  if (!current) throw createApiError('Document not found', 404);
  const source = documentFromRow(current);
  if (!['quote', 'delivery_note'].includes(source.documentType)) {
    throw createApiError('Only quote and delivery note can be converted to invoice');
  }
  const user = await getCurrentUser();
  const data = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase()
      .from(tableName)
      .insert({
        document_type: 'invoice',
        document_number: `${TYPE_PREFIX.invoice}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`,
        source_document_id: source._id,
        source_document_type: source.documentType,
        customer_name: source.customerName,
        customer_phone: source.customerPhone || '',
        customer_address: source.customerAddress || '',
        issue_date: new Date().toISOString(),
        due_date: source.dueDate || null,
        status: 'draft',
        items: source.items,
        subtotal: source.subtotal,
        tax_amount: source.taxAmount,
        total_amount: source.totalAmount,
        notes: source.notes || '',
        user_id: user.id,
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
  const productPurchasePriceMap = new Map(
    products.map((product) => [product._id, Number(product.purchasePrice || 0)])
  );
  const totalCostOfGoods = recentSales.reduce((sum, sale) => {
    const saleCost = asArray<JsonRecord>(sale.items).reduce((itemSum, item) => {
      const quantity = Number(item.quantity || 0);
      const purchasePrice =
        Number(item.purchasePrice ?? 0) ||
        Number(productPurchasePriceMap.get(parseId(item.productId)) || 0);
      return itemSum + purchasePrice * quantity;
    }, 0);
    return sum + saleCost;
  }, 0);
  const totalOperationalCosts = totalExpenses + totalCostOfGoods;
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
        totalCostOfGoods,
        totalOperationalCosts,
        netProfit: totalRevenue - totalOperationalCosts,
      },
      dailyTrend: Array.from(trendMap.values()).sort((a, b) => a._id.localeCompare(b._id)),
      topProducts: Array.from(topProducts.values()).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5),
      lowStock: products.filter((product) => Number(product.stock || 0) < 10).slice(0, 5),
    },
  };
};

const listUsers = async () => {
  const currentUser = await getCurrentUser();
  const companyOwnerId = currentUser.companyOwnerId || currentUser.id;
  const rows = await withTable('appUsers', 'users', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('company_owner_id', companyOwnerId)
  );

  return {
    data: asArray<JsonRecord>(rows).map((row) => ({
      _id: parseId(row.id),
      id: parseId(row.id),
      name: row.name || '',
      email: row.email || '',
      shopName: row.shop_name || '',
      companyOwnerId: row.company_owner_id || '',
      ice: row.ice || '',
      if: row.if_value || '',
      rc: row.rc || '',
      address: row.address || '',
      role: row.role || 'employee',
      createdAt: row.created_at || new Date().toISOString(),
    })),
  };
};

const updateUser = async (id: string, payload: JsonRecord) => {
  const authUser = await getCurrentAuthUser();
  if (authUser.id !== id) {
    throw createApiError("La gestion d'autres utilisateurs n'est pas encore disponible en mode Supabase direct.", 501);
  }

  const row = {
    name: payload.name,
    email: payload.email || authUser.email || '',
    shop_name: payload.shopName || '',
    ice: payload.ice || '',
    if_value: payload.if || '',
    rc: payload.rc || '',
    address: payload.address || '',
  };

  const data = await withTable('appUsers', 'users', (tableName) =>
    ensureSupabase().from(tableName).update(row).eq('id', id).select('*').single()
  );

  return {
    data: {
      _id: parseId((data as JsonRecord).id),
      id: parseId((data as JsonRecord).id),
      name: (data as JsonRecord).name || '',
      email: (data as JsonRecord).email || '',
      shopName: (data as JsonRecord).shop_name || '',
      ice: (data as JsonRecord).ice || '',
      if: (data as JsonRecord).if_value || '',
      rc: (data as JsonRecord).rc || '',
      address: (data as JsonRecord).address || '',
      role: (data as JsonRecord).role || 'employee',
      createdAt: (data as JsonRecord).created_at || new Date().toISOString(),
    },
  };
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

const verifyLicense = async (payload: JsonRecord = {}) => ({
  data: await invokeSupabaseFunction('verify-license', payload),
});
const activateLicense = async (payload: JsonRecord = {}) => ({
  data: await invokeSupabaseFunction('activate-license', payload),
});
const getAdminLicenses = async () => ({
  data: await invokeSupabaseFunction<any[]>('admin-licenses', { action: 'list' }),
});
const generateAdminLicense = async (payload: JsonRecord = {}) => ({
  data: await invokeSupabaseFunction('admin-licenses', { action: 'generate', ...payload }),
});
const deleteAdminLicense = async (id: string) => ({
  data: await invokeSupabaseFunction('admin-licenses', { action: 'delete', id }),
});
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

  if (method === 'POST' && cleanPath === '/license/verify') return verifyLicense(payload);
  if (method === 'POST' && cleanPath === '/license/activate') return activateLicense(payload);
  if (method === 'GET' && cleanPath === '/admin/licenses') return getAdminLicenses();
  if (method === 'POST' && cleanPath === '/admin/licenses') return generateAdminLicense(payload);
  if (method === 'DELETE' && cleanPath.startsWith('/admin/licenses/')) return deleteAdminLicense(cleanPath.split('/')[3]);
  if (cleanPath.startsWith('/admin/licenses')) return unsupportedLicensingAction();

  return unsupportedRoute(cleanPath);
};
