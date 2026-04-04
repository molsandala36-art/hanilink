import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Plus, Search, Edit2, Trash2, Printer, Loader2, X, FileUp } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate, getDefaultVatRate } from '../lib/utils';
import { translations, Language } from '../lib/translations';

type DocumentType = 'quote' | 'delivery_note' | 'invoice';
type DocumentStatus = 'draft' | 'sent' | 'validated';

interface BusinessDocumentItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface ProductOption {
  _id: string;
  name: string;
  price: number;
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
  invoice: 'invoice'
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
  items: [{ productId: '', description: '', quantity: '1', unitPrice: '0' }]
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
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const receiptSettings = useMemo(() => {
    const saved = localStorage.getItem('receiptSettings');
    return saved ? JSON.parse(saved) : { logoUrl: '', primaryColor: '#f97316' };
  }, []);

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
            productId: '',
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice)
          }))
        : [{ productId: '', description: '', quantity: '1', unitPrice: '0' }]
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
      }

      nextItems[index] = nextItem;
      return { ...prev, items: nextItems };
    });
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', description: '', quantity: '1', unitPrice: '0' }]
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
          description: item.description.trim(),
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0)
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
    const brandBlock = receiptSettings.logoUrl
      ? `<div class="brand-logo"><img src="${receiptSettings.logoUrl}" alt="Logo" /></div>`
      : `<div class="brand-mark" style="background:${receiptSettings.primaryColor}">${user.shopName || 'HaniLink'}</div>`;
    const legalInfo = [
      `<div class="meta-row"><span>${t.shop_name}</span><strong>${user.shopName || 'HaniLink'}</strong></div>`,
      user.address ? `<div class="meta-row"><span>${t.address}</span><strong>${user.address}</strong></div>` : '',
      user.ice ? `<div class="meta-row"><span>${t.ice}</span><strong>${user.ice}</strong></div>` : '',
      user.if ? `<div class="meta-row"><span>${t.if}</span><strong>${user.if}</strong></div>` : '',
      user.rc ? `<div class="meta-row"><span>${t.rc}</span><strong>${user.rc}</strong></div>` : ''
    ].filter(Boolean).join('');
    const customerInfo = [
      `<div class="meta-row"><span>${t.customer}</span><strong>${doc.customerName}</strong></div>`,
      doc.customerPhone ? `<div class="meta-row"><span>${t.phone_label}</span><strong>${doc.customerPhone}</strong></div>` : '',
      doc.customerAddress ? `<div class="meta-row"><span>${t.address}</span><strong>${doc.customerAddress}</strong></div>` : '',
      `<div class="meta-row"><span>No.</span><strong>${doc.documentNumber}</strong></div>`,
      `<div class="meta-row"><span>${t.date}</span><strong>${formatDate(doc.issueDate)}</strong></div>`
    ].filter(Boolean).join('');
    const taxRate = doc.subtotal > 0 ? ((doc.taxAmount / doc.subtotal) * 100).toFixed(2) : getDefaultVatRate();
    const html = `
      <html>
        <head>
          <title>${documentTitle} - ${doc.documentNumber}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 32px; font-family: Inter, Arial, sans-serif; color: #111827; background: #f3f4f6; }
            .sheet { max-width: 920px; margin: 0 auto; background: #fff; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12); }
            .hero { padding: 28px 32px 22px; background: linear-gradient(135deg, ${receiptSettings.primaryColor} 0%, #111827 100%); color: white; }
            .hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
            .brand-logo { display: inline-flex; align-items: center; justify-content: center; min-height: 72px; min-width: 132px; padding: 12px 16px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.16); border-radius: 20px; }
            .brand-logo img { max-height: 64px; max-width: 180px; object-fit: contain; }
            .brand-mark { display: inline-flex; align-items: center; padding: 16px 20px; border-radius: 20px; font-size: 28px; font-weight: 800; color: white; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18); }
            .doc-title { text-align: right; }
            .doc-title .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; opacity: 0.72; margin-bottom: 8px; }
            .doc-title h1 { margin: 0; font-size: 34px; line-height: 1; font-weight: 800; }
            .doc-title p { margin: 8px 0 0; font-size: 14px; opacity: 0.84; }
            .content { padding: 28px 32px 32px; }
            .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-bottom: 24px; }
            .meta-card { padding: 18px 20px; border: 1px solid #e5e7eb; border-radius: 20px; background: #f9fafb; }
            .meta-card h2 { margin: 0 0 14px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; }
            .meta-row { display: flex; justify-content: space-between; gap: 16px; padding: 6px 0; font-size: 13px; border-bottom: 1px dashed #e5e7eb; }
            .meta-row:last-child { border-bottom: none; }
            .meta-row span { color: #6b7280; }
            .meta-row strong { text-align: right; font-weight: 700; color: #111827; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e5e7eb; border-radius: 22px; overflow: hidden; }
            thead th { padding: 14px 16px; background: #111827; color: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; text-align: left; }
            tbody td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #111827; }
            tbody tr:nth-child(even) td { background: #fafafa; }
            tbody tr:last-child td { border-bottom: none; }
            .qty, .price, .line-total { text-align: right; white-space: nowrap; }
            .summary { margin-top: 24px; display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
            .notes { padding: 20px; border-radius: 20px; background: #f9fafb; border: 1px solid #e5e7eb; }
            .notes h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; }
            .notes p { margin: 0; color: #374151; font-size: 14px; line-height: 1.7; }
            .totals { padding: 20px; border-radius: 24px; background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%); border: 1px solid #fed7aa; }
            .totals div { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; font-size: 14px; }
            .totals span:first-child { color: #6b7280; }
            .totals strong { color: #111827; }
            .grand { margin-top: 8px; padding-top: 14px; border-top: 1px solid #fdba74; font-size: 18px !important; font-weight: 800; }
            .grand span:first-child, .grand strong { color: ${receiptSettings.primaryColor}; }
            .footer { padding: 0 32px 28px; font-size: 12px; color: #9ca3af; text-align: center; }
            @media print { body { background: white; padding: 0; } .sheet { box-shadow: none; border-radius: 0; } }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="hero">
              <div class="hero-top">
                <div>${brandBlock}</div>
                <div class="doc-title">
                  <div class="eyebrow">HaniLink</div>
                  <h1>${documentTitle}</h1>
                  <p>${doc.documentNumber}</p>
                </div>
              </div>
            </div>
            <div class="content">
              <div class="meta-grid">
                <div class="meta-card">
                  <h2>${language === 'ar' ? 'Entreprise' : 'Entreprise'}</h2>
                  ${legalInfo}
                </div>
                <div class="meta-card">
                  <h2>${language === 'ar' ? 'Client' : 'Client'}</h2>
                  ${customerInfo}
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>${t.product_name}</th>
                    <th class="qty">${t.quantity}</th>
                    <th class="price">${t.price}</th>
                    <th class="line-total">${t.total}</th>
                  </tr>
                </thead>
                <tbody>
                  ${doc.items.map((item) => `
                    <tr>
                      <td>${item.description}</td>
                      <td class="qty">${item.quantity}</td>
                      <td class="price">${formatCurrency(item.unitPrice)}</td>
                      <td class="line-total">${formatCurrency(item.lineTotal)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="summary">
                <div class="notes">
                  <h3>${language === 'ar' ? 'Informations' : 'Informations'}</h3>
                  <p>${doc.notes || (language === 'ar' ? '????? ??????.' : 'Merci pour votre confiance.')}</p>
                </div>
                <div class="totals">
                  <div><span>${t.total_ht}</span><strong>${formatCurrency(doc.subtotal)}</strong></div>
                  <div><span>${t.total_tva} (${taxRate}%)</span><strong>${formatCurrency(doc.taxAmount)}</strong></div>
                  <div class="grand"><span>${t.total_ttc}</span><strong>${formatCurrency(doc.totalAmount)}</strong></div>
                </div>
              </div>
            </div>
            <div class="footer">Document g?n?r? par HaniLink</div>
          </div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 400); }</script>
        </body>
      </html>
    `;

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
            {language === 'ar' ? 'إدارة عروض الأسعار وبونات التسليم والفواتير.' : 'Gestion des devis, bons de livraison et factures.'}
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
        {(['quote', 'delivery_note', 'invoice'] as DocumentType[]).map((type) => (
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
                        {doc.documentType !== 'invoice' && (
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.customer}</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.phone_label}</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.address}</label>
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
