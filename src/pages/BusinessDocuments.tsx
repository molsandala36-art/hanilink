import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Plus, Search, Edit2, Trash2, Printer, Loader2, X, FileUp } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate, getDefaultVatRate } from '../lib/utils';
import { translations, Language } from '../lib/translations';
import { buildPrintableDocumentHtml, getStoredDocumentSettings } from '../lib/documentSettings';

type DocumentType = 'quote' | 'delivery_note' | 'invoice' | 'purchase_note' | 'transfer_note';
type DocumentStatus = 'draft' | 'sent' | 'validated';

interface BusinessDocumentItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sourcePlace?: string;
  destinationPlace?: string;
}

interface ProductOption {
  _id: string;
  name: string;
  price: number;
  place?: string;
}

interface BusinessDocument {
  _id: string;
  documentType: DocumentType;
  documentNumber: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  issueDate: string;
  dueDate?: string;
  status: DocumentStatus;
  items: BusinessDocumentItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
}

const TYPE_KEYS: Record<DocumentType, string> = {
  quote: 'quote',
  delivery_note: 'delivery_note',
  invoice: 'invoice',
  purchase_note: 'purchase_note',
  transfer_note: 'transfer_note'
};

const STATUS_KEYS: Record<DocumentStatus, string> = {
  draft: 'status_draft',
  sent: 'status_sent',
  validated: 'status_validated'
};

const createEmptyForm = () => ({
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  status: 'draft' as DocumentStatus,
  taxRate: getDefaultVatRate(),
  notes: '',
  items: [{ productId: '', description: '', quantity: '1', unitPrice: '0', sourcePlace: '', destinationPlace: '' }]
});

const BusinessDocuments = () => {
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<BusinessDocument | null>(null);
  const [activeType, setActiveType] = useState<DocumentType>('quote');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(createEmptyForm);
  const [language] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');

  const t = translations[language];
  const isTransferNote = activeType === 'transfer_note';
  const isPurchaseNote = activeType === 'purchase_note';
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const receiptSettings = useMemo(() => getStoredDocumentSettings(), []);

  const fetchDocuments = async (type = activeType) => {
    try {
      const res = await api.get('/documents', { params: { type } });
      setDocuments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDocuments(activeType);
  }, [activeType]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredDocuments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((doc) =>
      doc.documentNumber.toLowerCase().includes(term) ||
      doc.customerName.toLowerCase().includes(term)
    );
  }, [documents, searchTerm]);

  const listTotal = useMemo(
    () => filteredDocuments.reduce((acc, doc) => acc + doc.totalAmount, 0),
    [filteredDocuments]
  );

  const formTotals = useMemo(() => {
    const subtotal = formData.items.reduce((acc, item) => {
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      return acc + qty * unitPrice;
    }, 0);
    const taxAmount = subtotal * (Number(formData.taxRate || 0) / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }, [formData.items, formData.taxRate]);

  const openCreateModal = () => {
    setEditingDocument(null);
    setFormData(createEmptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (doc: BusinessDocument) => {
    setEditingDocument(doc);
    const taxRate = doc.subtotal > 0 ? ((doc.taxAmount / doc.subtotal) * 100).toFixed(2) : getDefaultVatRate();
    setFormData({
      customerName: doc.customerName || '',
      customerPhone: doc.customerPhone || '',
      customerAddress: doc.customerAddress || '',
      issueDate: new Date(doc.issueDate).toISOString().slice(0, 10),
      dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString().slice(0, 10) : '',
      status: doc.status || 'draft',
      taxRate,
      notes: doc.notes || '',
      items: doc.items.length
        ? doc.items.map((item) => ({
            productId: item.productId || '',
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            sourcePlace: item.sourcePlace || '',
            destinationPlace: item.destinationPlace || ''
          }))
        : [{ productId: '', description: '', quantity: '1', unitPrice: '0', sourcePlace: '', destinationPlace: '' }]
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDocument(null);
    setFormData(createEmptyForm());
  };

  const updateItem = (index: number, key: 'productId' | 'description' | 'quantity' | 'unitPrice', value: string) => {
    setFormData((prev) => {
      const nextItems = [...prev.items];
      const nextItem = { ...nextItems[index], [key]: value };

      if (key === 'productId') {
        const selectedProduct = products.find((product) => product._id === value);
        nextItem.description = selectedProduct?.name || '';
        nextItem.unitPrice = selectedProduct ? String(selectedProduct.price ?? 0) : nextItem.unitPrice;
        nextItem.sourcePlace = selectedProduct?.place || nextItem.sourcePlace || '';
      }

      nextItems[index] = nextItem;
      return { ...prev, items: nextItems };
    });
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', description: '', quantity: '1', unitPrice: '0', sourcePlace: '', destinationPlace: '' }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      documentType: activeType,
      customerName: formData.customerName.trim(),
      customerPhone: formData.customerPhone.trim(),
      customerAddress: formData.customerAddress.trim(),
      issueDate: formData.issueDate,
      dueDate: formData.dueDate || null,
      status: formData.status,
      taxRate: Number(formData.taxRate || 0),
      notes: formData.notes.trim(),
      items: formData.items
        .map((item) => ({
          productId: item.productId || '',
          description: item.description.trim(),
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          sourcePlace: item.sourcePlace || '',
          destinationPlace: item.destinationPlace || ''
        }))
        .filter((item) => item.description && item.quantity > 0)
    };

    if (!payload.customerName || payload.items.length === 0) return;

    try {
      if (editingDocument) {
        await api.put(`/documents/${editingDocument._id}`, payload);
      } else {
        await api.post('/documents', payload);
      }
      closeModal();
      fetchDocuments(activeType);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.confirm_delete_product)) return;
    try {
      await api.delete(`/documents/${id}`);
      fetchDocuments(activeType);
    } catch (err) {
      console.error(err);
    }
  };

  const convertToInvoice = async (id: string) => {
    try {
      await api.post(`/documents/${id}/convert-to-invoice`);
      setActiveType('invoice');
      fetchDocuments('invoice');
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'فشل تحويل الوثيقة إلى فاتورة' : 'Échec de la conversion en facture');
    }
  };

  const printDocument = (doc: BusinessDocument) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const documentTitle = t[TYPE_KEYS[doc.documentType]];
    const taxRate = doc.subtotal > 0 ? ((doc.taxAmount / doc.subtotal) * 100).toFixed(2) : getDefaultVatRate();
    const html = buildPrintableDocumentHtml(receiptSettings, user, {
      title: documentTitle,
      documentNumber: doc.documentNumber,
      issueDate: doc.issueDate,
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      customerAddress: doc.customerAddress,
      notes: doc.notes,
      subtotal: doc.subtotal,
      taxAmount: doc.taxAmount,
      totalAmount: doc.totalAmount,
      taxRateLabel: `${taxRate}%`,
      items: doc.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        secondaryText:
          doc.documentType === 'transfer_note'
            ? [item.sourcePlace, item.destinationPlace].filter(Boolean).join(' -> ')
            : undefined,
      })),
    });

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FileText className="w-10 h-10 text-orange-500" />
            {t.documents}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar'
              ? 'إدارة عروض الأسعار وبونات التسليم والفواتير وبونات الشراء والتحويل.'
              : "Gestion des devis, bons de livraison, factures, bons d'achat et bons de transfert."}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {t.add_document}
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['quote', 'delivery_note', 'invoice', 'purchase_note', 'transfer_note'] as DocumentType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
              activeType === type
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }`}
          >
            {t[TYPE_KEYS[type]]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t.search_product}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white shadow-sm transition-all"
          />
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t.total}</span>
          <span className="text-lg font-bold text-orange-600">{formatCurrency(listTotal)}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4">N°</th>
                <th className="px-6 py-4">{t.customer}</th>
                <th className="px-6 py-4">{t.date}</th>
                <th className="px-6 py-4">{t.total_ttc}</th>
                <th className="px-6 py-4">{t.status}</th>
                <th className="px-6 py-4">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
                  </td>
                </tr>
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">{t.no_documents}</td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr key={doc._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{doc.documentNumber}</td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{doc.customerName}</td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{formatDate(doc.issueDate)}</td>
                    <td className="px-6 py-4 font-bold text-orange-600">{formatCurrency(doc.totalAmount)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {t[STATUS_KEYS[doc.status]]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {['quote', 'delivery_note'].includes(doc.documentType) && (
                          <button
                            onClick={() => convertToInvoice(doc._id)}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors"
                            title={t.convert_to_invoice}
                          >
                            <FileUp className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => printDocument(doc)}
                          className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(doc)}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc._id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingDocument ? t.edit_document : t.add_document} - {t[TYPE_KEYS[activeType]]}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-4 mb-4">
                  {receiptSettings.logoUrl ? (
                    <img
                      src={receiptSettings.logoUrl}
                      alt="Invoice logo"
                      className="h-14 w-auto max-w-[140px] object-contain rounded-lg bg-white p-2 border border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div
                      className="px-4 py-3 rounded-xl text-white font-bold text-lg"
                      style={{ backgroundColor: receiptSettings.primaryColor }}
                    >
                      {currentUser.shopName || 'HaniLink'}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {language === 'ar' ? 'المعلومات القانونية على الفاتورة' : 'Informations legales sur la facture'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {language === 'ar' ? 'سيظهر هذا الشعار على الفاتورة المطبوعة' : 'Ce logo apparaitra aussi sur la facture imprimee'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div><strong>{t.shop_name}:</strong> {currentUser.shopName || 'HaniLink'}</div>
                  <div><strong>{t.address}:</strong> {currentUser.address || '-'}</div>
                  <div><strong>{t.ice}:</strong> {currentUser.ice || '-'}</div>
                  <div><strong>{t.if}:</strong> {currentUser.if || '-'}</div>
                  <div><strong>{t.rc}:</strong> {currentUser.rc || '-'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {isPurchaseNote
                      ? (language === 'ar' ? 'المرجع' : 'Fournisseur / Référence')
                      : isTransferNote
                        ? (language === 'ar' ? 'عنوان التحويل' : 'Libellé du transfert')
                        : t.customer}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {isTransferNote
                      ? (language === 'ar' ? 'مرجع داخلي' : 'Référence interne')
                      : t.phone_label}
                  </label>
                  <input
                    type="text"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.date}</label>
                  <input
                    type="date"
                    required
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.due_date}</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.tva}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.status}</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as DocumentStatus })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  >
                    <option value="draft">{t.status_draft}</option>
                    <option value="sent">{t.status_sent}</option>
                    <option value="validated">{t.status_validated}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {isTransferNote
                    ? (language === 'ar' ? 'موقع الوجهة' : 'Emplacement de destination')
                    : t.address}
                </label>
                <textarea
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white h-20 resize-none"
                />
              </div>

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-6 grid grid-cols-1 gap-2">
                      <select
                        value={item.productId || ''}
                        onChange={(e) => updateItem(index, 'productId', e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                      >
                        <option value="">{language === 'ar' ? 'اختر منتجاً موجوداً' : 'Choisir un produit existant'}</option>
                        {products.map((product) => (
                          <option key={product._id} value={product._id}>{product.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder={t.product_name}
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                      />
                      {isTransferNote && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={item.sourcePlace || ''}
                            onChange={(e) =>
                              setFormData((prev) => {
                                const nextItems = [...prev.items];
                                nextItems[index] = { ...nextItems[index], sourcePlace: e.target.value };
                                return { ...prev, items: nextItems };
                              })
                            }
                            placeholder={language === 'ar' ? 'الموقع الحالي' : 'Emplacement source'}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                          />
                          <input
                            type="text"
                            value={item.destinationPlace || formData.customerAddress || ''}
                            onChange={(e) =>
                              setFormData((prev) => {
                                const nextItems = [...prev.items];
                                nextItems[index] = { ...nextItems[index], destinationPlace: e.target.value };
                                return { ...prev, items: nextItems };
                              })
                            }
                            placeholder={language === 'ar' ? 'الموقع الجديد' : 'Emplacement destination'}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="md:col-span-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                      className="md:col-span-3 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="md:col-span-1 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="px-4 py-2 border border-dashed border-orange-300 text-orange-600 rounded-xl text-sm font-bold hover:bg-orange-50 dark:hover:bg-orange-900/20"
                >
                  + {t.add_line}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.expense_notes}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white h-20 resize-none"
                />
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 space-y-1">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>{t.total_ht}</span>
                  <span>{formatCurrency(formTotals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>{t.total_tva}</span>
                  <span>{formatCurrency(formTotals.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-orange-600">
                  <span>{t.total_ttc}</span>
                  <span>{formatCurrency(formTotals.total)}</span>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none"
                >
                  {editingDocument ? t.edit_document : t.add_document}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default BusinessDocuments;
