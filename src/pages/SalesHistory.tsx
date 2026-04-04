import { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  ChevronRight, 
  Loader2, 
  FileText, 
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  FileSpreadsheet
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { translations, Language } from '../lib/translations';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  tvaRate: number;
}

interface Sale {
  _id: string;
  items: SaleItem[];
  totalAmount: number;
  tvaAmount: number;
  paymentMethod: 'cash' | 'card' | 'cmi';
  createdAt: string;
}

const SalesHistory = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');

  const t = translations[language];

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await api.get('/sales');
        setSales(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSales();

    const handleLangChange = () => {
      setLanguage((localStorage.getItem('language') as Language) || 'fr');
    };
    window.addEventListener('storage', handleLangChange);
    const interval = setInterval(handleLangChange, 1000);
    return () => {
      window.removeEventListener('storage', handleLangChange);
      clearInterval(interval);
    };
  }, []);

  const filteredSales = sales.filter(sale => 
    sale._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handlePrintInvoice = (sale: Sale) => {
    console.log('Printing Invoice for Sale:', sale);
    
    const savedSettings = localStorage.getItem('invoiceSettings') ?? localStorage.getItem('receiptSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {
      logoUrl: '',
      fontSize: '14px',
      primaryColor: '#f97316'
    };

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Simple print window simulation
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const receiptHtml = `
        <html>
          <head>
            <title>Facture HaniLink - ${sale._id}</title>
            <style>
              body { 
                font-family: sans-serif; 
                padding: 20px; 
                text-align: ${language === 'ar' ? 'right' : 'left'}; 
                direction: ${language === 'ar' ? 'rtl' : 'ltr'};
                font-size: ${settings.fontSize};
                color: #333;
              }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
              .logo { max-height: 60px; margin-bottom: 10px; }
              .shop-info { font-size: 10px; color: #666; margin-top: 5px; }
              .legal-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 5px; }
              .details { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { padding: 10px 8px; border-bottom: 1px solid #eee; text-align: ${language === 'ar' ? 'right' : 'left'}; }
              th { background-color: #f9f9f9; font-size: 11px; text-transform: uppercase; color: #888; }
              .total-section { margin-top: 20px; border-top: 2px solid #eee; pt: 10px; }
              .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
              .total-row.grand-total { font-size: 18px; font-weight: bold; margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; }
              .accent { color: ${settings.primaryColor}; }
              @media print {
                body { padding: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              ${settings.logoUrl ? `<img src="${settings.logoUrl}" class="logo" />` : `<h1 class="accent" style="margin:0">${user.shopName || 'HaniLink'}</h1>`}
              <p style="margin: 5px 0; font-weight: bold; color: #888; text-transform: uppercase; letter-spacing: 1px;">${language === 'ar' ? 'فاتورة قانونية' : 'Facture Légale'}</p>
              
              <div class="shop-info">
                ${user.address ? `<p style="margin: 2px 0">${user.address}</p>` : ''}
                <div class="legal-grid">
                  ${user.ice ? `<span><strong>ICE:</strong> ${user.ice}</span>` : ''}
                  ${user.if ? `<span><strong>IF:</strong> ${user.if}</span>` : ''}
                  ${user.rc ? `<span><strong>RC:</strong> ${user.rc}</span>` : ''}
                </div>
              </div>
            </div>

            <div class="details">
              <div style="display: flex; justify-content: space-between;">
                <div>
                  <p><strong>N° Facture:</strong> #${sale._id.slice(-8).toUpperCase()}</p>
                  <p><strong>Date:</strong> ${formatDate(sale.createdAt)}</p>
                </div>
                <div style="text-align: ${language === 'ar' ? 'left' : 'right'}">
                  <p><strong>${t.payment_method}:</strong> ${t[sale.paymentMethod]}</p>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>${t.product_name}</th>
                  <th style="text-align: center">${language === 'ar' ? 'الكمية' : 'Qté'}</th>
                  <th style="text-align: right">${t.price}</th>
                  <th style="text-align: right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items.map(item => `
                  <tr>
                    <td>
                      <div style="font-weight: bold">${item.name}</div>
                      <div style="font-size: 10px; color: #888">TVA: ${item.tvaRate}%</div>
                    </td>
                    <td style="text-align: center">${item.quantity}</td>
                    <td style="text-align: right">${formatCurrency(item.price)}</td>
                    <td style="text-align: right; font-weight: bold">${formatCurrency(item.price * item.quantity)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="total-section">
              <div class="total-row">
                <span>${t.total_ht}:</span>
                <span>${formatCurrency(sale.totalAmount - sale.tvaAmount)}</span>
              </div>
              <div class="total-row">
                <span>${t.total_tva}:</span>
                <span>${formatCurrency(sale.tvaAmount)}</span>
              </div>
              <div class="total-row grand-total">
                <span>${t.total_ttc}:</span>
                <span class="accent">${formatCurrency(sale.totalAmount)}</span>
              </div>
            </div>

            <div style="margin-top: 50px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px;">
              ${language === 'ar' ? 'شكرا لثقتكم بنا' : 'Merci de votre confiance'}
              <p style="margin-top: 5px;">HaniLink POS - Logiciel de Gestion</p>
            </div>
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    } else {
      alert(language === 'ar' ? 'يرجى السماح بالنوافذ المنبثقة للطباعة' : 'Veuillez autoriser les pop-ups pour imprimer');
    }
  };

  const exportToCSV = () => {
    const data = sales.map(sale => ({
      ID: sale._id,
      Date: formatDate(sale.createdAt),
      Total: sale.totalAmount,
      TVA: sale.tvaAmount,
      PaymentMethod: t[sale.paymentMethod],
      Items: sale.items.map(i => `${i.name} (${i.quantity})`).join('; ')
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `sales_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const data = sales.map(sale => ({
      ID: sale._id,
      Date: formatDate(sale.createdAt),
      Total: sale.totalAmount,
      TVA: sale.tvaAmount,
      PaymentMethod: t[sale.paymentMethod],
      Items: sale.items.map(i => `${i.name} (${i.quantity})`).join('; ')
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
    XLSX.writeFile(workbook, `sales_history_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'cmi': return <Smartphone className="w-4 h-4" />;
      default: return <Banknote className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.sales_history}</h1>
          <p className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تتبع جميع المبيعات والفواتير' : 'Suivez toutes vos ventes et factures'}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <FileText className="w-4 h-4" />
            CSV
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="relative">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5", language === 'ar' ? "right-3" : "left-3")} />
              <input 
                type="text" 
                placeholder={language === 'ar' ? 'البحث عن رقم العملية أو المنتج...' : 'Rechercher par ID ou produit...'}
                className={cn(
                  "w-full py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white",
                  language === 'ar' ? "pr-10 pl-4" : "pl-10 pr-4"
                )}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    <th className={cn("px-6 py-4 text-sm font-bold text-gray-500 dark:text-gray-400", language === 'ar' && "text-right")}>{language === 'ar' ? 'رقم العملية' : 'ID Vente'}</th>
                    <th className={cn("px-6 py-4 text-sm font-bold text-gray-500 dark:text-gray-400", language === 'ar' && "text-right")}>{t.date}</th>
                    <th className={cn("px-6 py-4 text-sm font-bold text-gray-500 dark:text-gray-400", language === 'ar' && "text-right")}>{t.total}</th>
                    <th className={cn("px-6 py-4 text-sm font-bold text-gray-500 dark:text-gray-400", language === 'ar' && "text-right")}>{t.payment_method}</th>
                    <th className={cn("px-6 py-4 text-sm font-bold text-gray-500 dark:text-gray-400", language === 'ar' && "text-right")}>{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
                      </td>
                    </tr>
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        {language === 'ar' ? 'لا توجد مبيعات' : 'Aucune vente trouvée'}
                      </td>
                    </tr>
                  ) : filteredSales.map((sale) => (
                    <tr 
                      key={sale._id} 
                      className={cn(
                        "hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer",
                        selectedSale?._id === sale._id && "bg-orange-50 dark:bg-orange-900/10"
                      )}
                      onClick={() => setSelectedSale(sale)}
                    >
                      <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">#{sale._id.slice(-6)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{formatDate(sale.createdAt)}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{formatCurrency(sale.totalAmount)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                          {getPaymentIcon(sale.paymentMethod)}
                          {t[sale.paymentMethod]}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handlePrintInvoice(sale);
            }}
                            className="p-2 hover:bg-orange-100 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg transition-colors"
                            title={t.print_invoice}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <ChevronRight className={cn("w-4 h-4 text-gray-400", language === 'ar' && "rotate-180")} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {selectedSale ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-300">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" />
                  {language === 'ar' ? 'تفاصيل الفاتورة' : 'Détails de la facture'}
                </h2>
                        <button
                          onClick={() => handlePrintInvoice(selectedSale)}
                  className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'رقم العملية' : 'ID Vente'}</span>
                    <span className="font-mono text-gray-900 dark:text-white">#{selectedSale._id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{t.date}</span>
                    <span className="text-gray-900 dark:text-white">{formatDate(selectedSale.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{t.payment_method}</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">{t[selectedSale.paymentMethod]}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{language === 'ar' ? 'المنتجات' : 'Articles'}</p>
                  {selectedSale.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.quantity} x {formatCurrency(item.price)}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{t.subtotal}</span>
                    <span>{formatCurrency(selectedSale.totalAmount - selectedSale.tvaAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{t.tva}</span>
                    <span>{formatCurrency(selectedSale.tvaAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2">
                    <span>{t.total}</span>
                    <span className="text-orange-600 dark:text-orange-400">{formatCurrency(selectedSale.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-400 p-6 text-center">
              <FileText className="w-12 h-12 mb-4 opacity-20" />
              <p>{language === 'ar' ? 'اختر مبيعة لعرض التفاصيل' : 'Sélectionnez une vente pour voir les détails'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesHistory;
