import type { User } from '@supabase/supabase-js';
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured, isSupabaseFunctionsBaseUrl } from '../lib/backend';
import { AppUser, getCurrentSupabaseUserProfile, getStoredSupabaseSession, getSupabaseClient } from './supabase';

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
  customers: 'customers',
  customerCredits: 'customer_credits',
  products: 'products',
  suppliers: 'suppliers',
  sales: 'sales',
  returns: 'sales_returns',
  expenses: 'expenses',
  purchaseOrders: 'purchase_orders',
  businessDocuments: 'business_documents',
} as const;

const TYPE_PREFIX = {
  quote: 'DEV',
  delivery_note: 'BL',
  invoice: 'FAC',
  credit_note: 'AV',
  purchase_note: 'BA',
  transfer_note: 'BT',
} as const;

const TABLE_ALIASES = {
  appUsers: ['app_users', 'users'],
  customers: ['customers', 'customer', 'clients'],
  customerCredits: ['customer_credits', 'credits', 'customer_credit', 'client_credits'],
  products: ['products', 'product'],
  suppliers: ['suppliers', 'supplier'],
  sales: ['sales', 'sale'],
  returns: ['sales_returns', 'returns', 'sale_returns', 'salesreturns'],
  expenses: ['expenses', 'expense'],
  purchaseOrders: ['purchase_orders', 'purchaseorders', 'purchase_orders'],
  businessDocuments: ['business_documents', 'businessdocuments', 'documents', 'business_document'],
} as const;

const resolvedTableNames = new Map<keyof typeof TABLES, string>();

let cachedAuthUser: User | null = null;
let authUserPromise: Promise<User> | null = null;

const ensureSupabase = () => {
  const client = getSupabaseClient();
  if (!isSupabaseConfigured() || !client) {
    throw createApiError("Supabase n'est pas configure pour cette application.");
  }
  return client;
};

const invokeSupabaseFunction = async <T>(name: string, body: JsonRecord = {}) => {
  ensureSupabase();
  const accessToken = (await getStoredSupabaseSession())?.access_token;
  if (!accessToken) {
    throw createApiError('Session Supabase introuvable. Reconnecte-toi.', 401);
  }

  const response = await fetch(`${getSupabaseUrl()}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: getSupabasePublishableKey(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `Erreur Supabase Function (${response.status})`;
    const missingFunction =
      response.status === 404 ||
      String(message).toLowerCase().includes('not found');
    if (missingFunction) {
      throw createApiError(
        `La fonction Supabase "${name}" n'est pas encore deployee. Deploie les Edge Functions de licensing pour activer cette fonctionnalite.`,
        501
      );
    }
    throw createApiError(message, response.status);
  }

  return (data || {}) as T;
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

const normalizeRecord = (row?: JsonRecord | null): JsonRecord => {
  const safeRow = row && typeof row === 'object' ? row : {};
  return {
    ...safeRow,
    _id: parseId(safeRow.id || safeRow._id),
    createdAt: pickCreatedAt(safeRow),
  };
};

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
    barcode: String(normalized.barcode ?? normalized.bar_code ?? normalized.barcode_value ?? ''),
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
    barcode: String(payload.barcode || '').trim(),
    place: payload.place || '',
    photo_url: payload.photoUrl || '',
    supplier_id: payload.supplierId || null,
    user_id: user.id,
  };
};

const withoutBarcodeColumn = (row: JsonRecord) => {
  const { barcode, ...rest } = row;
  return rest;
};

const runProductMutation = async (
  executor: (row: JsonRecord | JsonRecord[]) => PromiseLike<{ data: any; error: any }>,
  row: JsonRecord | JsonRecord[]
) => {
  const firstAttempt = await executor(row);
  if (!firstAttempt.error) {
    return firstAttempt.data;
  }

  const hasBarcodeColumn = Array.isArray(row)
    ? row.some((candidate) => candidate.barcode !== undefined)
    : row.barcode !== undefined;

  if (hasBarcodeColumn && isMissingSupabaseColumnError(firstAttempt.error)) {
    return runQuery(
      executor(Array.isArray(row) ? row.map(withoutBarcodeColumn) : withoutBarcodeColumn(row)),
      'La table products existe mais certaines colonnes attendues sont absentes.'
    );
  }

  throw createApiError(firstAttempt.error.message || 'Erreur Supabase');
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

const returnFromRow = (row: JsonRecord) => {
  const normalized = normalizeRecord(row);
  return {
    _id: normalized._id,
    saleId: parseId(normalized.saleId ?? normalized.sale_id),
    items: asArray<JsonRecord>(normalized.items).map((item) => ({
      productId: parseId(item.productId ?? item.product_id),
      name: item.name || '',
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      purchasePrice: Number(item.purchasePrice ?? item.purchase_price ?? 0),
      tvaRate: Number(item.tvaRate ?? item.tva_rate ?? 20),
      lineTotal: Number(item.lineTotal ?? item.line_total ?? 0),
    })),
    subtotalAmount: Number(normalized.subtotalAmount ?? normalized.subtotal_amount ?? 0),
    tvaAmount: Number(normalized.tvaAmount ?? normalized.tva_amount ?? 0),
    totalAmount: Number(normalized.totalAmount ?? normalized.total_amount ?? 0),
    refundMethod: normalized.refundMethod ?? normalized.refund_method ?? 'cash',
    reason: normalized.reason || '',
    notes: normalized.notes || '',
    restocked: normalized.restocked !== false,
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
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

const customerFromRow = (row: JsonRecord) => {
  const normalized = normalizeRecord(row);
  return {
    _id: normalized._id,
    name: normalized.name || '',
    phone: normalized.phone || '',
    email: normalized.email || '',
    address: normalized.address || '',
    notes: normalized.notes || '',
    creditLimit: Number(normalized.creditLimit ?? normalized.credit_limit ?? 0),
    openingBalance: Number(normalized.openingBalance ?? normalized.opening_balance ?? 0),
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
  };
};

const customerToRow = async (payload: JsonRecord) => {
  const user = await getCurrentUser();
  return {
    name: String(payload.name || '').trim(),
    phone: String(payload.phone || '').trim(),
    email: String(payload.email || '').trim(),
    address: String(payload.address || '').trim(),
    notes: String(payload.notes || '').trim(),
    credit_limit: Number(payload.creditLimit || 0),
    opening_balance: Number(payload.openingBalance || 0),
    user_id: user.id,
  };
};

const creditEntryFromRow = (row: JsonRecord) => {
  const normalized = normalizeRecord(row);
  return {
    _id: normalized._id,
    customerId: parseId(normalized.customerId ?? normalized.customer_id),
    amount: Number(normalized.amount || 0),
    entryType: normalized.entryType ?? normalized.entry_type ?? 'credit',
    paymentMethod: normalized.paymentMethod ?? normalized.payment_method ?? 'cash',
    note: normalized.note || '',
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
  };
};

const creditEntryToRow = async (payload: JsonRecord) => {
  const user = await getCurrentUser();
  return {
    customer_id: parseId(payload.customerId ?? payload.customer_id),
    amount: Number(payload.amount || 0),
    entry_type: String(payload.entryType || payload.entry_type || 'credit').trim(),
    payment_method: String(payload.paymentMethod || payload.payment_method || 'cash').trim(),
    note: String(payload.note || '').trim(),
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

const getDocumentStatus = (value: any) => String(value || '').toLowerCase();

const isValidatedDocumentStatus = (value: any) => getDocumentStatus(value) === 'validated';

const assertDocumentIsMutable = (document: JsonRecord) => {
  if (isValidatedDocumentStatus(document.status)) {
    throw createApiError(
      'Ce document est valide et ne peut plus etre modifie ou supprime. Utilise un retour, un avoir ou un nouveau document correctif.',
      409
    );
  }
};

const buildDocumentSequencePrefix = (documentType: keyof typeof TYPE_PREFIX, issuedAt: string) => {
  const year = new Date(issuedAt || new Date().toISOString()).getUTCFullYear();
  return `${TYPE_PREFIX[documentType]}-${year}`;
};

const parseDocumentSequence = (documentNumber: string, prefix: string) => {
  const normalizedNumber = String(documentNumber || '').trim();
  if (!normalizedNumber.startsWith(`${prefix}-`)) return null;
  const candidate = normalizedNumber.slice(prefix.length + 1);
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
};

const generateNextDocumentNumber = async (documentType: keyof typeof TYPE_PREFIX, issuedAt: string) => {
  const prefix = buildDocumentSequencePrefix(documentType, issuedAt);
  const rows = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase().from(tableName).select('document_number').eq('document_type', documentType)
  );
  const maxSequence = asArray<JsonRecord>(rows).reduce((currentMax, row) => {
    const nextValue = parseDocumentSequence(String(row.document_number || ''), prefix);
    return nextValue && nextValue > currentMax ? nextValue : currentMax;
  }, 0);

  return `${prefix}-${String(maxSequence + 1).padStart(6, '0')}`;
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
    customerIce: normalized.customerIce ?? normalized.customer_ice ?? '',
    customerIf: normalized.customerIf ?? normalized.customer_if ?? '',
    customerRc: normalized.customerRc ?? normalized.customer_rc ?? '',
    issueDate: normalized.issueDate ?? normalized.issue_date ?? normalized.createdAt,
    dueDate: normalized.dueDate ?? normalized.due_date,
    status: normalized.status || 'draft',
    items: asArray<JsonRecord>(normalized.items).map((item) => ({
      productId: parseId(item.productId ?? item.product_id),
      description: item.description || '',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0),
      lineTotal: Number(item.lineTotal ?? item.line_total ?? 0),
      sourcePlace: String(item.sourcePlace ?? item.source_place ?? ''),
      destinationPlace: String(item.destinationPlace ?? item.destination_place ?? ''),
    })),
    subtotal: Number(normalized.subtotal || 0),
    taxAmount: Number(normalized.taxAmount ?? normalized.tax_amount ?? 0),
    totalAmount: Number(normalized.totalAmount ?? normalized.total_amount ?? 0),
    paymentMethod: normalized.paymentMethod ?? normalized.payment_method ?? '',
    paymentReference: normalized.paymentReference ?? normalized.payment_reference ?? '',
    restockOnValidate: normalized.restockOnValidate ?? normalized.restock_on_validate ?? true,
    notes: normalized.notes || '',
    createdBy: parseId(normalized.createdBy ?? normalized.created_by),
    updatedBy: parseId(normalized.updatedBy ?? normalized.updated_by),
    validatedBy: parseId(normalized.validatedBy ?? normalized.validated_by),
    validatedAt: normalized.validatedAt ?? normalized.validated_at ?? null,
    cancelledAt: normalized.cancelledAt ?? normalized.cancelled_at ?? null,
    userId: parseId(normalized.userId ?? normalized.user_id),
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt ?? normalized.updated_at ?? normalized.createdAt,
  };
};

const computeDocumentTotals = (
  items: JsonRecord[],
  taxRate: any,
  documentType?: string,
  customerAddress?: string
) => {
  const normalizedItems = asArray<JsonRecord>(items)
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      return {
        productId: parseId(item.productId ?? item.product_id),
        description: String(item.description || '').trim(),
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
        sourcePlace: String(item.sourcePlace ?? item.source_place ?? ''),
        destinationPlace:
          documentType === 'transfer_note'
            ? String(item.destinationPlace ?? item.destination_place ?? customerAddress ?? '').trim()
            : String(item.destinationPlace ?? item.destination_place ?? ''),
      };
    })
    .filter((item) => item.description && item.quantity > 0);
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = subtotal * (Number(taxRate || 0) / 100);
  return { normalizedItems, subtotal, taxAmount, totalAmount: subtotal + taxAmount };
};

const documentToRow = async (payload: JsonRecord, existing?: JsonRecord) => {
  const user = await getCurrentUser();
  const documentType = (payload.documentType || existing?.documentType || existing?.document_type) as keyof typeof TYPE_PREFIX;
  const customerAddress = payload.customerAddress || existing?.customerAddress || existing?.customer_address || '';
  const issueDate = payload.issueDate || existing?.issueDate || existing?.issue_date || new Date().toISOString();
  const { normalizedItems, subtotal, taxAmount, totalAmount } = computeDocumentTotals(
    payload.items,
    payload.taxRate,
    documentType,
    customerAddress
  );
  if (!payload.customerName || normalizedItems.length === 0) {
    throw createApiError('Customer name and at least one item are required');
  }

  const paymentMethod = String(
    payload.paymentMethod || existing?.paymentMethod || existing?.payment_method || ''
  ).trim();
  const paymentReference = String(
    payload.paymentReference || existing?.paymentReference || existing?.payment_reference || ''
  ).trim();

  if (documentType === 'invoice' && !paymentMethod) {
    throw createApiError('Le mode de paiement est obligatoire pour une facture.', 400);
  }

  const nextStatus = payload.status || existing?.status || 'draft';

  return {
    document_type: documentType,
    document_number:
      existing?.documentNumber ||
      existing?.document_number ||
      await generateNextDocumentNumber(documentType, issueDate),
    source_document_id: payload.sourceDocumentId || existing?.sourceDocumentId || existing?.source_document_id || null,
    source_document_type: payload.sourceDocumentType || existing?.sourceDocumentType || existing?.source_document_type || null,
    customer_name: payload.customerName,
    customer_phone: payload.customerPhone || '',
    customer_address: customerAddress,
    customer_ice: String(payload.customerIce || existing?.customerIce || existing?.customer_ice || '').trim(),
    customer_if: String(payload.customerIf || existing?.customerIf || existing?.customer_if || '').trim(),
    customer_rc: String(payload.customerRc || existing?.customerRc || existing?.customer_rc || '').trim(),
    issue_date: issueDate,
    due_date: payload.dueDate || null,
    status: nextStatus,
    items: normalizedItems,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    payment_reference: paymentReference,
    restock_on_validate:
      documentType === 'credit_note'
        ? payload.restockOnValidate !== false
        : Boolean(existing?.restockOnValidate ?? existing?.restock_on_validate ?? false),
    notes: payload.notes || '',
    created_by: existing?.createdBy || existing?.created_by || user.id,
    updated_by: user.id,
    validated_by: isValidatedDocumentStatus(nextStatus)
      ? existing?.validatedBy || existing?.validated_by || user.id
      : null,
    validated_at: isValidatedDocumentStatus(nextStatus)
      ? existing?.validatedAt || existing?.validated_at || new Date().toISOString()
      : null,
    user_id: user.id,
  };
};

const shouldApplyDocumentEffects = (status: string) => String(status || '').toLowerCase() === 'validated';

const loadProductRecord = async (productId: string) => {
  if (!productId) return null;
  const rows = await withTable('products', 'products', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('id', productId).limit(1)
  );
  return asArray<JsonRecord>(rows)[0] || null;
};

const updateProductRecord = async (productId: string, changes: JsonRecord) => {
  await withTable('products', 'products', (tableName) =>
    ensureSupabase().from(tableName).update(changes).eq('id', productId)
  );
};

const applyBusinessDocumentEffects = async (document: ReturnType<typeof documentFromRow>, direction: 1 | -1) => {
  if (!shouldApplyDocumentEffects(document.status)) return;

  if (document.documentType === 'purchase_note') {
    for (const item of asArray<JsonRecord>(document.items)) {
      const productId = parseId(item.productId);
      if (!productId) continue;
      const product = await loadProductRecord(productId);
      if (!product) continue;
      const nextStock = Math.max(0, Number(product.stock || 0) + Number(item.quantity || 0) * direction);
      await updateProductRecord(productId, { stock: nextStock });
    }
  }

  if (document.documentType === 'credit_note' && document.restockOnValidate !== false) {
    for (const item of asArray<JsonRecord>(document.items)) {
      const productId = parseId(item.productId);
      if (!productId) continue;
      const product = await loadProductRecord(productId);
      if (!product) continue;
      const nextStock = Math.max(0, Number(product.stock || 0) + Number(item.quantity || 0) * direction);
      await updateProductRecord(productId, { stock: nextStock });
    }
  }

  if (document.documentType === 'transfer_note') {
    for (const item of asArray<JsonRecord>(document.items)) {
      const productId = parseId(item.productId);
      if (!productId) continue;
      const product = await loadProductRecord(productId);
      if (!product) continue;
      const targetPlace =
        direction > 0
          ? String(item.destinationPlace || document.customerAddress || '').trim()
          : String(item.sourcePlace || '').trim();
      if (!targetPlace) continue;
      await updateProductRecord(productId, { place: targetPlace });
    }
  }
};

const listProducts = async (): Promise<ApiResponse<any[]>> => {
  const rows = await withTable('products', 'products', (tableName) => ensureSupabase().from(tableName).select('*'));
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(productFromRow), ['createdAt']) };
};

const listCustomers = async (): Promise<ApiResponse<any[]>> => {
  const rows = await withTable('customers', 'customers', (tableName) => ensureSupabase().from(tableName).select('*'));
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(customerFromRow), ['createdAt']) };
};

const createCustomer = async (payload: JsonRecord) => {
  const row = await customerToRow(payload);
  if (!row.name) throw createApiError('Le nom du client est obligatoire.', 400);
  const data = await withTable('customers', 'customers', (tableName) =>
    ensureSupabase().from(tableName).insert(row).select('*').single()
  );
  return { data: customerFromRow(data as JsonRecord) };
};

const updateCustomer = async (id: string, payload: JsonRecord) => {
  const row = await customerToRow(payload);
  if (!row.name) throw createApiError('Le nom du client est obligatoire.', 400);
  const data = await withTable('customers', 'customers', (tableName) =>
    ensureSupabase().from(tableName).update(row).eq('id', id).select('*').single()
  );
  return { data: customerFromRow(data as JsonRecord) };
};

const deleteCustomer = async (id: string) => {
  await withTable('customers', 'customers', (tableName) => ensureSupabase().from(tableName).delete().eq('id', id));
  return { data: { message: 'Customer deleted' } };
};

const listCustomerCredits = async (): Promise<ApiResponse<any[]>> => {
  const rows = await withTable('customerCredits', 'credits', (tableName) => ensureSupabase().from(tableName).select('*'));
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(creditEntryFromRow), ['createdAt']) };
};

const createCustomerCredit = async (payload: JsonRecord) => {
  const row = await creditEntryToRow(payload);
  if (!row.customer_id) throw createApiError('Le client est obligatoire pour ce mouvement de credit.', 400);
  if (!row.amount || row.amount <= 0) throw createApiError('Le montant doit etre superieur a zero.', 400);
  const data = await withTable('customerCredits', 'credits', (tableName) =>
    ensureSupabase().from(tableName).insert(row).select('*').single()
  );
  return { data: creditEntryFromRow(data as JsonRecord) };
};

const createProduct = async (payload: JsonRecord) => {
  const row = await productToRow(payload);
  const data = await withTable('products', 'products', (tableName) =>
    runProductMutation((candidateRow) => ensureSupabase().from(tableName).insert(candidateRow).select('*').single(), row)
  );
  return { data: productFromRow(data as JsonRecord) };
};

const updateProduct = async (id: string, payload: JsonRecord) => {
  const row = await productToRow(payload);
  const data = await withTable('products', 'products', (tableName) =>
    runProductMutation(
      (candidateRow) => ensureSupabase().from(tableName).update(candidateRow).eq('id', id).select('*').single(),
      row
    )
  );
  return { data: productFromRow((data as JsonRecord) || { id, ...row }) };
};

const deleteProduct = async (id: string) => {
  await withTable('products', 'products', (tableName) => ensureSupabase().from(tableName).delete().eq('id', id));
  return { data: { message: 'Product deleted' } };
};

const bulkCreateProducts = async (payload: JsonRecord[]) => {
  const rows = await Promise.all(asArray<JsonRecord>(payload).map(productToRow));
  const data = await withTable('products', 'products', (tableName) =>
    runProductMutation((candidateRows) => ensureSupabase().from(tableName).insert(candidateRows).select('*'), rows)
  );
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

const listReturns = async (): Promise<ApiResponse<any[]>> => {
  const rows = await withTable('returns', 'returns', (tableName) => ensureSupabase().from(tableName).select('*'));
  return { data: sortByDateDesc(asArray<JsonRecord>(rows).map(returnFromRow), ['createdAt']) };
};

const getReturnedQuantitiesForSale = async (saleId: string) => {
  const rows = await withTable('returns', 'returns', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('sale_id', saleId)
  );

  const returnedByProduct = new Map<string, number>();
  asArray<JsonRecord>(rows).forEach((row) => {
    asArray<JsonRecord>(row.items).forEach((item) => {
      const productId = parseId(item.product_id ?? item.productId);
      if (!productId) return;
      returnedByProduct.set(productId, (returnedByProduct.get(productId) || 0) + Number(item.quantity || 0));
    });
  });

  return returnedByProduct;
};

const createReturn = async (payload: JsonRecord) => {
  const saleId = parseId(payload.saleId ?? payload.sale_id);
  if (!saleId) {
    throw createApiError('La vente source est obligatoire pour enregistrer un retour.', 400);
  }

  const saleRows = await withTable('sales', 'sales', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('id', saleId).limit(1)
  );
  const saleRow = asArray<JsonRecord>(saleRows)[0];
  if (!saleRow) {
    throw createApiError('Vente introuvable pour ce retour.', 404);
  }

  const sale = saleFromRow(saleRow);
  const alreadyReturnedByProduct = await getReturnedQuantitiesForSale(saleId);
  const requestedItems = asArray<JsonRecord>(payload.items)
    .map((item) => ({
      productId: parseId(item.productId ?? item.product_id),
      quantity: Number(item.quantity || 0),
    }))
    .filter((item) => item.productId && item.quantity > 0);

  if (requestedItems.length === 0) {
    throw createApiError('Selectionne au moins un article a retourner.', 400);
  }

  const normalizedItems = requestedItems.map((requestedItem) => {
    const saleItem = sale.items.find((item) => parseId(item.productId) === requestedItem.productId);
    if (!saleItem) {
      throw createApiError(`Article introuvable dans la vente: ${requestedItem.productId}`, 404);
    }

    const alreadyReturned = alreadyReturnedByProduct.get(requestedItem.productId) || 0;
    const remainingQuantity = Number(saleItem.quantity || 0) - alreadyReturned;
    if (remainingQuantity <= 0) {
      throw createApiError(`Tout le stock de ${saleItem.name} a deja ete retourne pour cette vente.`, 400);
    }
    if (requestedItem.quantity > remainingQuantity) {
      throw createApiError(
        `Quantite retournee invalide pour ${saleItem.name}. Maximum disponible: ${remainingQuantity}.`,
        400
      );
    }

    const lineTotal = Number(saleItem.price || 0) * requestedItem.quantity;
    return {
      product_id: requestedItem.productId,
      name: saleItem.name || '',
      quantity: requestedItem.quantity,
      price: Number(saleItem.price || 0),
      purchase_price: Number(saleItem.purchasePrice || 0),
      tva_rate: Number(saleItem.tvaRate || 20),
      line_total: lineTotal,
    };
  });

  const subtotalAmount = normalizedItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const tvaAmount = normalizedItems.reduce(
    (sum, item) => sum + Number(item.line_total || 0) * (Number(item.tva_rate || 0) / 100),
    0
  );
  const totalAmount = subtotalAmount + tvaAmount;
  const restocked = payload.restocked !== false;
  const currentUser = await getCurrentUser();

  if (restocked) {
    for (const item of normalizedItems) {
      const productRows = await withTable('products', 'products', (tableName) =>
        ensureSupabase().from(tableName).select('*').eq('id', item.product_id).limit(1)
      );
      const product = asArray<JsonRecord>(productRows)[0];
      if (!product) {
        throw createApiError(`Produit introuvable pour remise en stock: ${item.name}`, 404);
      }
      await withTable('products', 'products', (tableName) =>
        ensureSupabase()
          .from(tableName)
          .update({ stock: Number(product.stock || 0) + Number(item.quantity || 0) })
          .eq('id', item.product_id)
      );
    }
  }

  const row = {
    sale_id: saleId,
    items: normalizedItems,
    subtotal_amount: subtotalAmount,
    tva_amount: tvaAmount,
    total_amount: totalAmount,
    refund_method: payload.refundMethod || payload.refund_method || sale.paymentMethod || 'cash',
    reason: String(payload.reason || '').trim(),
    notes: String(payload.notes || '').trim(),
    restocked,
    user_id: currentUser.id,
  };

  const data = await withTable('returns', 'returns', (tableName) =>
    ensureSupabase().from(tableName).insert(row).select('*').single()
  );
  return { data: returnFromRow(data as JsonRecord) };
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
  const createdDocument = documentFromRow(data as JsonRecord);
  await applyBusinessDocumentEffects(createdDocument, 1);
  return { data: createdDocument };
};

const updateBusinessDocument = async (id: string, payload: JsonRecord) => {
  const rows = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('id', id).limit(1)
  );
  const current = asArray<JsonRecord>(rows)[0];
  if (!current) throw createApiError('Document not found', 404);
  const currentDocument = documentFromRow(current);
  assertDocumentIsMutable(currentDocument);
  const row = await documentToRow(payload, current);
  await applyBusinessDocumentEffects(currentDocument, -1);
  const data = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase().from(tableName).update(row).eq('id', id).select('*').single()
  );
  const updatedDocument = documentFromRow(data as JsonRecord);
  await applyBusinessDocumentEffects(updatedDocument, 1);
  return { data: updatedDocument };
};

const deleteBusinessDocument = async (id: string) => {
  const rows = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('id', id).limit(1)
  );
  const current = asArray<JsonRecord>(rows)[0];
  if (current) {
    const currentDocument = documentFromRow(current);
    assertDocumentIsMutable(currentDocument);
    await applyBusinessDocumentEffects(currentDocument, -1);
  }
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
  const invoiceNumber = await generateNextDocumentNumber('invoice', new Date().toISOString());
  const data = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase()
      .from(tableName)
      .insert({
        document_type: 'invoice',
        document_number: invoiceNumber,
        source_document_id: source._id,
        source_document_type: source.documentType,
        customer_name: source.customerName,
        customer_phone: source.customerPhone || '',
        customer_address: source.customerAddress || '',
        customer_ice: source.customerIce || '',
        customer_if: source.customerIf || '',
        customer_rc: source.customerRc || '',
        issue_date: new Date().toISOString(),
        due_date: source.dueDate || null,
        status: 'draft',
        items: source.items,
        subtotal: source.subtotal,
        tax_amount: source.taxAmount,
        total_amount: source.totalAmount,
        payment_method: source.paymentMethod || '',
        payment_reference: source.paymentReference || '',
        notes: source.notes || '',
        created_by: user.id,
        updated_by: user.id,
        validated_by: null,
        validated_at: null,
        user_id: user.id,
      })
      .select('*')
      .single()
  );
  return { data: documentFromRow(data as JsonRecord) };
};

const convertInvoiceToCreditNote = async (id: string) => {
  const rows = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase().from(tableName).select('*').eq('id', id).limit(1)
  );
  const current = asArray<JsonRecord>(rows)[0];
  if (!current) throw createApiError('Document not found', 404);
  const source = documentFromRow(current);
  if (source.documentType !== 'invoice') {
    throw createApiError('Only invoice can be converted to credit note');
  }

  const user = await getCurrentUser();
  const creditNoteNumber = await generateNextDocumentNumber('credit_note', new Date().toISOString());
  const sourceLabel = source.documentNumber || source._id;
  const data = await withTable('businessDocuments', 'documents', (tableName) =>
    ensureSupabase()
      .from(tableName)
      .insert({
        document_type: 'credit_note',
        document_number: creditNoteNumber,
        source_document_id: source._id,
        source_document_type: source.documentType,
        customer_name: source.customerName,
        customer_phone: source.customerPhone || '',
        customer_address: source.customerAddress || '',
        customer_ice: source.customerIce || '',
        customer_if: source.customerIf || '',
        customer_rc: source.customerRc || '',
        issue_date: new Date().toISOString(),
        due_date: source.dueDate || null,
        status: 'draft',
        items: source.items,
        subtotal: source.subtotal,
        tax_amount: source.taxAmount,
        total_amount: source.totalAmount,
        payment_method: source.paymentMethod || '',
        payment_reference: source.paymentReference || '',
        restock_on_validate: true,
        notes: source.notes
          ? `${source.notes}\n\nAvoir genere depuis la facture ${sourceLabel}.`
          : `Avoir genere depuis la facture ${sourceLabel}.`,
        created_by: user.id,
        updated_by: user.id,
        validated_by: null,
        validated_at: null,
        user_id: user.id,
      })
      .select('*')
      .single()
  );

  return { data: documentFromRow(data as JsonRecord) };
};

const getAnalytics = async () => {
  const [salesRes, productsRes, expensesRes, returnsRes] = await Promise.all([
    listSales(),
    listProducts(),
    listExpenses(),
    listReturns(),
  ]);
  const sales = salesRes.data;
  const products = productsRes.data;
  const expenses = expensesRes.data;
  const returns = returnsRes.data;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSales = sales.filter((sale) => new Date(sale.createdAt || '').getTime() >= thirtyDaysAgo.getTime());
  const recentExpenses = expenses.filter((expense) => new Date(expense.expenseDate || expense.createdAt || '').getTime() >= thirtyDaysAgo.getTime());
  const recentReturns = returns.filter((entry) => new Date(entry.createdAt || '').getTime() >= thirtyDaysAgo.getTime());
  const totalRevenue = recentSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  const totalReturns = recentReturns.reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0);
  const netRevenue = totalRevenue - totalReturns;
  const totalSales = recentSales.length;
  const averageOrderValue = totalSales ? netRevenue / totalSales : 0;
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
  recentReturns
    .filter((entry) => new Date(entry.createdAt || '').getTime() >= sevenDaysAgo.getTime())
    .forEach((entry) => {
      const key = new Date(entry.createdAt || '').toISOString().slice(0, 10);
      const current = trendMap.get(key) || { _id: key, revenue: 0, count: 0 };
      current.revenue -= Number(entry.totalAmount || 0);
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
        totalReturns,
        netRevenue,
        totalSales,
        averageOrderValue,
        totalExpenses,
        totalCostOfGoods,
        totalOperationalCosts,
        netProfit: netRevenue - totalOperationalCosts,
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
    return {
      data: await invokeSupabaseFunction('admin-users', {
        action: 'update',
        id,
        ...payload,
      }),
    };
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

const updateUserRole = async (id: string, payload?: JsonRecord) => {
  const authUser = await getCurrentAuthUser();
  if (authUser.id === id) throw createApiError('You cannot change your own role', 400);
  return {
    data: await invokeSupabaseFunction('admin-users', {
      action: 'role',
      id,
      role: payload?.role,
    }),
  };
};

const deleteUser = async (id: string) => {
  const authUser = await getCurrentAuthUser();
  if (authUser.id === id) throw createApiError('You cannot delete your own account', 400);
  return {
    data: await invokeSupabaseFunction('admin-users', {
      action: 'delete',
      id,
    }),
  };
};

const registerAdditionalUser = async (payload: JsonRecord) => {
  return {
    data: await invokeSupabaseFunction('admin-users', {
      action: 'create',
      ...payload,
    }),
  };
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
  data: await invokeSupabaseFunction('verify-license', {
    ...payload,
    userId: (await getCurrentUser()).id,
  }),
});
const activateLicense = async (payload: JsonRecord = {}) => ({
  data: await invokeSupabaseFunction('activate-license', {
    ...payload,
    userId: (await getCurrentUser()).id,
  }),
});

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
  if (method === 'GET' && cleanPath === '/customers') return listCustomers();
  if (method === 'POST' && cleanPath === '/customers') return createCustomer(payload);
  if (method === 'PUT' && cleanPath.startsWith('/customers/')) return updateCustomer(cleanPath.split('/')[2], payload);
  if (method === 'DELETE' && cleanPath.startsWith('/customers/')) return deleteCustomer(cleanPath.split('/')[2]);
  if (method === 'GET' && cleanPath === '/credits') return listCustomerCredits();
  if (method === 'POST' && cleanPath === '/credits') return createCustomerCredit(payload);
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
  if (method === 'GET' && cleanPath === '/returns') return listReturns();
  if (method === 'POST' && cleanPath === '/returns') return createReturn(payload);

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
  if (method === 'POST' && /\/documents\/[^/]+\/convert-to-credit-note$/.test(cleanPath)) return convertInvoiceToCreditNote(cleanPath.split('/')[2]);

  if (method === 'GET' && cleanPath === '/analytics') return getAnalytics();

  if (method === 'GET' && cleanPath === '/users') return listUsers();
  if (method === 'PUT' && /\/users\/[^/]+\/role$/.test(cleanPath)) {
    return updateUserRole(cleanPath.split('/')[2], payload);
  }
  if (method === 'PUT' && cleanPath.startsWith('/users/')) return updateUser(cleanPath.split('/')[2], payload);
  if (method === 'DELETE' && cleanPath.startsWith('/users/')) return deleteUser(cleanPath.split('/')[2]);

  if (method === 'POST' && cleanPath === '/auth/register') return registerAdditionalUser(payload);

  if (method === 'GET' && cleanPath === '/sync/status') return getSyncStatus();
  if (cleanPath.startsWith('/sync/')) return unsupportedSyncAction();

  if (method === 'POST' && cleanPath === '/license/verify') return verifyLicense(payload);
  if (method === 'POST' && cleanPath === '/license/activate') return activateLicense(payload);

  return unsupportedRoute(cleanPath);
};
